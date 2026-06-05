import { AuditAction, AuditEntity, PenaltyType, RestrictionType } from "@prisma/client";
import { prisma } from "../db";
import { logAudit } from "./auditService";
import { RuleError } from "../utils/errors";

type ApplyPenaltyInput = {
  userId: string;
  violationId?: string | null;
  type: PenaltyType;
  durationDays?: number;
  amount?: number;
  currency?: string;
  reason?: string;
  createdById?: string | null;
  metadata?: object | null;
};

function toRestrictionType(type: PenaltyType): RestrictionType | null {
  if (type === PenaltyType.BAN) return RestrictionType.BAN;
  if (type === PenaltyType.SUSPENSION) return RestrictionType.SUSPENSION;
  if (type === PenaltyType.ACCESS_RESTRICTION) return RestrictionType.ACCESS_RESTRICTION;
  return null;
}

export async function applyPenalty(input: ApplyPenaltyInput) {
  const now = new Date();
  const restrictionType = toRestrictionType(input.type);
  const endAt = input.durationDays ? new Date(now.getTime() + input.durationDays * 24 * 60 * 60 * 1000) : null;

  const penalty = await prisma.penalty.create({
    data: {
      userId: input.userId,
      violationId: input.violationId ?? null,
      type: input.type,
      amount: input.amount ?? null,
      currency: input.currency ?? null,
      reason: input.reason,
      startAt: restrictionType ? now : null,
      endAt: restrictionType ? endAt : null,
      metadata: input.metadata as object | undefined,
    },
  });

  if (restrictionType) {
    await prisma.userRestriction.create({
      data: {
        userId: input.userId,
        type: restrictionType,
        reason: input.reason,
        startAt: now,
        endAt,
        createdById: input.createdById ?? null,
      },
    });

    if (restrictionType === RestrictionType.BAN) {
      await prisma.user.update({
        where: { id: input.userId },
        data: {
          isBanned: true,
          banReason: input.reason ?? "Rule violation",
          bannedAt: now,
          banExpiresAt: endAt,
        },
      });
    }
  }

  await logAudit({
    userId: input.createdById ?? null,
    action: AuditAction.UPDATE,
    entity: AuditEntity.USER,
    entityId: input.userId,
    description: `Penalty applied: ${input.type}`,
    metadata: {
      violationId: input.violationId,
      penaltyId: penalty.id,
      type: input.type,
      durationDays: input.durationDays,
      amount: input.amount,
    },
  });

  return penalty;
}

export async function requireCompensationAmount(amount?: number) {
  if (!amount || amount <= 0) {
    throw new RuleError("COMPENSATION_REQUIRED", "Compensation amount must be provided", 400);
  }
}
