import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/authMiddleware";
import { issueWarning, banUser, unbanUser } from "../services/adminService";
import { approveBooking, rejectBooking, resolveConflict } from "../services/bookingService";

const router = Router();

router.use(requireAuth);
// Most of these require admin/manager roles, enforcing ADMIN at router level
router.use(requireRole("ADMIN", "MANAGER"));

// PART 9: SYSTEM RULES
router.get("/rules", async (req, res) => {
  let rule = await prisma.systemRule.findFirst();
  if (!rule) {
    rule = await prisma.systemRule.create({ data: {} });
  }
  res.json(rule);
});

router.put("/rules", async (req, res, next) => {
  try {
    const schema = z.object({
      maxBookingsPerDay: z.number().int().optional(),
      autoBanThreshold: z.number().int().optional(),
      advanceBookingWindow: z.number().int().optional(),
      minimumNoticeTime: z.number().int().optional(),
    });
    const data = schema.parse(req.body);
    let rule = await prisma.systemRule.findFirst();
    if (!rule) {
      rule = await prisma.systemRule.create({ data });
    } else {
      rule = await prisma.systemRule.update({ where: { id: rule.id }, data });
    }
    res.json(rule);
  } catch (error) {
    next(error);
  }
});

// PART 10: WARNINGS & BANS
router.post("/users/:id/warn", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
    const result = await issueWarning(id, reason, req.auth!.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/users/:id/ban", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
    const result = await banUser(id, reason, req.auth!.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/users/:id/unban", async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await unbanUser(id, req.auth!.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// PART 3: CONFLICT RESOLUTION
router.get("/conflicts", async (req, res) => {
  const conflicts = await prisma.conflict.findMany({
    include: { bookings: { include: { user: true, facility: true } } },
    where: { resolved: false },
    orderBy: { createdAt: "desc" },
  });
  res.json(conflicts);
});

// FR-3.4 — Audit log: all admin actions (conflict resolutions, warnings, bans)
router.get("/audit-logs", async (req, res) => {
  const logs = await prisma.adminLog.findMany({
    include: { admin: { select: { fullName: true, studentId: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(logs);
});

router.post("/conflicts/:id/resolve", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { approvedBookingId, rejectedBookingId } = z.object({
      approvedBookingId: z.string(),
      rejectedBookingId: z.string()
    }).parse(req.body);

    const result = await resolveConflict(id, approvedBookingId, rejectedBookingId, req.auth!.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// PART 8: APPROVALS
router.post("/bookings/:id/approve", async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await approveBooking(id, req.auth!.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/bookings/:id/reject", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = z.object({ reason: z.string() }).parse(req.body);
    const result = await rejectBooking(id, req.auth!.userId, reason);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// PART 5: SPORTS MANAGEMENT
router.get("/sports", async (req, res) => {
  const sports = await prisma.sport.findMany();
  res.json(sports);
});

router.post("/sports", async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      icon: z.string().optional(),
      description: z.string().optional(),
      minParticipants: z.number().int().default(1),
      maxParticipants: z.number().int().default(20),
      durationOptions: z.string().default("60"),
      requiresCoach: z.boolean().default(false)
    });
    const data = schema.parse(req.body);
    const sport = await prisma.sport.create({ data });
    res.status(201).json(sport);
  } catch (error) {
    next(error);
  }
});

router.patch("/sports/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      name: z.string().optional(),
      icon: z.string().optional(),
      description: z.string().optional(),
      minParticipants: z.number().int().optional(),
      maxParticipants: z.number().int().optional(),
      durationOptions: z.string().optional(),
      requiresCoach: z.boolean().optional()
    });
    const data = schema.parse(req.body);
    const sport = await prisma.sport.update({ where: { id }, data });
    res.json(sport);
  } catch (error) {
    next(error);
  }
});

router.delete("/sports/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.sport.delete({ where: { id } });
    res.json({ message: "Sport deleted" });
  } catch (error) {
    next(error);
  }
});

// ─── FAIRNESS ENGINE PARAMETERS CONFIGURATION ────────────────────────────────
router.get("/fairness-config", async (req, res, next) => {
  try {
    let config = await prisma.fairnessConfig.findFirst();
    if (!config) {
      config = await prisma.fairnessConfig.create({
        data: {
          primeTimeStartHour: 17,
          primeTimeEndHour: 21,
          basketballQuotaPercent: 60.0,
          volleyballQuotaPercent: 40.0,
          cooldownPeriodHours: 24,
          maxWeeklyReservationsPerUser: 3,
          consecutiveSlotLimit: 2,
          teamOverlapThresholdPercent: 50.0,
          playerWeightCoeff: 0.4,
          unusedHoursWeightCoeff: 0.3,
          primeTimeDisadvantageCoeff: 0.3,
        },
      });
    }
    res.json(config);
  } catch (error) {
    console.warn("Falling back to demo fairness config:", error);
    res.json({
      primeTimeStartHour: 17,
      primeTimeEndHour: 21,
      basketballQuotaPercent: 60.0,
      volleyballQuotaPercent: 40.0,
      cooldownPeriodHours: 24,
      maxWeeklyReservationsPerUser: 3,
      consecutiveSlotLimit: 2,
      teamOverlapThresholdPercent: 50.0,
      playerWeightCoeff: 0.4,
      unusedHoursWeightCoeff: 0.3,
      primeTimeDisadvantageCoeff: 0.3,
    });
  }
});

router.put("/fairness-config", async (req, res, next) => {
  try {
    const schema = z.object({
      primeTimeStartHour: z.number().int().min(0).max(23).optional(),
      primeTimeEndHour: z.number().int().min(0).max(23).optional(),
      basketballQuotaPercent: z.number().min(0).max(100).optional(),
      volleyballQuotaPercent: z.number().min(0).max(100).optional(),
      cooldownPeriodHours: z.number().int().min(0).optional(),
      maxWeeklyReservationsPerUser: z.number().int().min(1).optional(),
      consecutiveSlotLimit: z.number().int().min(1).optional(),
      teamOverlapThresholdPercent: z.number().min(0).max(100).optional(),
      playerWeightCoeff: z.number().min(0).max(1).optional(),
      unusedHoursWeightCoeff: z.number().min(0).max(1).optional(),
      primeTimeDisadvantageCoeff: z.number().min(0).max(1).optional(),
    });
    const data = schema.parse(req.body);

    let config = await prisma.fairnessConfig.findFirst();
    if (!config) {
      config = await prisma.fairnessConfig.create({
        data: {
          primeTimeStartHour: 17,
          primeTimeEndHour: 21,
          basketballQuotaPercent: 60.0,
          volleyballQuotaPercent: 40.0,
          cooldownPeriodHours: 24,
          maxWeeklyReservationsPerUser: 3,
          consecutiveSlotLimit: 2,
          teamOverlapThresholdPercent: 50.0,
          playerWeightCoeff: 0.4,
          unusedHoursWeightCoeff: 0.3,
          primeTimeDisadvantageCoeff: 0.3,
        }
      });
    }

    const nextPlayerCoeff = data.playerWeightCoeff !== undefined ? data.playerWeightCoeff : config.playerWeightCoeff;
    const nextUnusedCoeff = data.unusedHoursWeightCoeff !== undefined ? data.unusedHoursWeightCoeff : config.unusedHoursWeightCoeff;
    const nextPrimeCoeff = data.primeTimeDisadvantageCoeff !== undefined ? data.primeTimeDisadvantageCoeff : config.primeTimeDisadvantageCoeff;

    if (Math.abs((nextPlayerCoeff + nextUnusedCoeff + nextPrimeCoeff) - 1.0) > 0.02) {
      return res.status(400).json({ message: "Fairness scoring coefficients (player, unused, and prime time) must sum to approximately 1.0." });
    }

    config = await prisma.fairnessConfig.update({
      where: { id: config.id },
      data,
    });

    // Audit log entry
    await prisma.adminLog.create({
      data: {
        adminId: req.auth!.userId,
        action: "UPDATE_FAIRNESS_CONFIG",
        targetId: config.id.toString(),
        details: JSON.stringify(data),
      },
    });

    res.json(config);
  } catch (error) {
    next(error);
  }
});

export default router;
