import { NextFunction, Request, Response } from "express";
import { prisma } from "../db";
import { getRuleConfig } from "../services/ruleConfigService";
import { normalizeSportKey } from "../config/rules";
import { RuleError } from "../utils/errors";
import { assertUserCanBook } from "../services/restrictionService";

export async function bookingValidation(req: Request, _res: Response, next: NextFunction) {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new RuleError("UNAUTHORIZED", "Authentication required", 401);
    }

    await assertUserCanBook(userId);

    const { facilityId, participants } = req.body as { facilityId: string; participants: number };
    if (!facilityId || !participants) {
      return next();
    }

    const facility = await prisma.facility.findUnique({
      where: { id: facilityId },
      include: { sport: true },
    });

    if (!facility) {
      throw new RuleError("FACILITY_NOT_FOUND", "Facility not found", 404);
    }

    if (!facility.sport?.name) {
      return next();
    }

    const config = await getRuleConfig();
    const key = normalizeSportKey(facility.sport.name);
    const rule = config.booking.sportParticipantRules[key];

    if (!rule) {
      return next();
    }

    if (rule.exact !== undefined && participants !== rule.exact) {
      throw new RuleError("INVALID_PARTICIPANTS", `Participants must be exactly ${rule.exact}`, 400);
    }

    if (rule.allowedTotals && !rule.allowedTotals.includes(participants)) {
      throw new RuleError("INVALID_PARTICIPANTS", `Allowed participants: ${rule.allowedTotals.join(", ")}`, 400);
    }

    if (rule.min !== undefined && participants < rule.min) {
      throw new RuleError("INVALID_PARTICIPANTS", `Minimum participants: ${rule.min}`, 400);
    }

    if (rule.max !== undefined && participants > rule.max) {
      throw new RuleError("INVALID_PARTICIPANTS", `Maximum participants: ${rule.max}`, 400);
    }

    next();
  } catch (error) {
    next(error);
  }
}
