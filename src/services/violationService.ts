import { ViolationSeverity, ViolationStatus, ViolationType } from "@prisma/client";
import { prisma } from "../db";
import { RuleError } from "../utils/errors";
import { applyRulePenalties } from "./ruleEngine";

export type ReportViolationInput = {
  userId: string;
  type: ViolationType;
  severity?: ViolationSeverity;
  description?: string;
  bookingId?: string | null;
  facilityId?: string | null;
  evidenceUrl?: string | null;
  reportedById?: string | null;
  metadata?: object | null;
  dedupeKey?: string | null;
  compensationAmount?: number | null;
};

export async function createViolation(input: ReportViolationInput) {
  if (input.dedupeKey) {
    const existing = await prisma.violation.findFirst({ where: { dedupeKey: input.dedupeKey } });
    if (existing) {
      return { violation: existing, penalties: [] };
    }
  }

  const violation = await prisma.violation.create({
    data: {
      userId: input.userId,
      type: input.type,
      severity: input.severity ?? ViolationSeverity.MINOR,
      status: ViolationStatus.OPEN,
      description: input.description,
      bookingId: input.bookingId ?? null,
      facilityId: input.facilityId ?? null,
      evidenceUrl: input.evidenceUrl ?? null,
      reportedById: input.reportedById ?? null,
      metadata: input.metadata as object | undefined,
      dedupeKey: input.dedupeKey ?? null,
    },
  });

  const penalties = await applyRulePenalties({
    violation,
    compensationAmount: input.compensationAmount ?? null,
  });

  return { violation, penalties };
}

export async function listUserViolations(userId: string) {
  return prisma.violation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function listViolations(filters: { type?: ViolationType; status?: ViolationStatus }) {
  return prisma.violation.findMany({
    where: {
      type: filters.type,
      status: filters.status,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function resolveViolation(violationId: string, resolverId: string) {
  const violation = await prisma.violation.update({
    where: { id: violationId },
    data: {
      status: ViolationStatus.RESOLVED,
      resolvedAt: new Date(),
    },
  });

  if (!violation) {
    throw new RuleError("VIOLATION_NOT_FOUND", "Violation not found", 404);
  }

  return violation;
}
