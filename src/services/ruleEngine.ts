import { PenaltyType, Violation } from "@prisma/client";
import { getRuleConfig } from "./ruleConfigService";
import { applyPenalty, requireCompensationAmount } from "./penaltyService";
import { prisma } from "../db";

type ApplyPenaltyContext = {
  violation: Violation;
  compensationAmount?: number | null;
};

export async function applyRulePenalties(context: ApplyPenaltyContext) {
  const config = await getRuleConfig();
  const policy = config.violations[context.violation.type];

  if (!policy) {
    return [];
  }

  const repeatWindowStart = new Date(Date.now() - config.repeatWindowDays * 24 * 60 * 60 * 1000);
  const priorCount = await prisma.violation.count({
    where: {
      userId: context.violation.userId,
      type: context.violation.type,
      createdAt: { gte: repeatWindowStart },
      id: { not: context.violation.id },
    },
  });

  const stepIndex = Math.min(priorCount, policy.escalation.length - 1);
  const selectedStep = policy.escalation[stepIndex];

  const penalties = [];

  if (selectedStep.type === PenaltyType.COMPENSATION) {
    await requireCompensationAmount(context.compensationAmount ?? undefined);
  }

  const penalty = await applyPenalty({
    userId: context.violation.userId,
    violationId: context.violation.id,
    type: selectedStep.type,
    durationDays: selectedStep.durationDays,
    amount: selectedStep.type === PenaltyType.COMPENSATION ? context.compensationAmount ?? undefined : selectedStep.amount,
    currency: selectedStep.currency,
    reason: selectedStep.note ?? "Rule penalty",
    metadata: {
      violationType: context.violation.type,
      severity: context.violation.severity,
      stepIndex,
    },
  });

  penalties.push(penalty);

  return penalties;
}
