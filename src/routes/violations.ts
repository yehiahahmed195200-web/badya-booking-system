import { Router } from "express";
import { z } from "zod";
import { ViolationSeverity, ViolationStatus, ViolationType, UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/authMiddleware";
import { createViolation, listUserViolations, listViolations, resolveViolation } from "../services/violationService";
import { prisma } from "../db";

const router = Router();

router.use(requireAuth);

const reportSchema = z.object({
  userId: z.string().min(1),
  type: z.nativeEnum(ViolationType),
  severity: z.nativeEnum(ViolationSeverity).optional(),
  description: z.string().optional(),
  bookingId: z.string().optional(),
  facilityId: z.string().optional(),
  evidenceUrl: z.string().url().optional(),
  compensationAmount: z.number().positive().optional(),
});

router.post("/", requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.COACH), async (req, res, next) => {
  try {
    const data = reportSchema.parse(req.body);
    const result = await createViolation({
      userId: data.userId,
      type: data.type,
      severity: data.severity,
      description: data.description,
      bookingId: data.bookingId ?? null,
      facilityId: data.facilityId ?? null,
      evidenceUrl: data.evidenceUrl ?? null,
      reportedById: req.auth!.userId,
      compensationAmount: data.compensationAmount ?? null,
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// Student dispute/report endpoint: POST /api/violations/conflicts/:id/report
router.post("/conflicts/:id/report", requireAuth, async (req, res, next) => {
  try {
    const { id: conflictId } = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({ bookingId: z.string().optional(), type: z.nativeEnum(ViolationType).optional(), description: z.string().optional(), evidenceUrl: z.string().url().optional() })
      .parse(req.body);

    const userId = req.auth!.userId;

    // Debug logging: show incoming dispute request details (bookingId and conflictId)
    console.info(`[VIOLATION-REPORT] user=${userId} conflict=${conflictId} bookingId=${body.bookingId || "-"} bodySummary=${JSON.stringify({ type: body.type, description: Boolean(body.description), evidenceUrl: Boolean(body.evidenceUrl) })}`);

    // If bookingId provided, ensure it belongs to this user and is part of the conflict
    if (body.bookingId) {
      const booking = await prisma.booking.findUnique({ where: { id: body.bookingId } });
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.userId !== userId) return res.status(403).json({ message: "Not allowed to report for this booking" });
      if (booking.conflictId !== conflictId) return res.status(400).json({ message: "Booking is not part of the specified conflict" });
    }

    const result = await createViolation({
      userId,
      type: body.type ?? ViolationType.FACILITY_RULE_BREACH,
      description: body.description ?? "Student dispute",
      bookingId: body.bookingId ?? null,
      facilityId: null,
      evidenceUrl: body.evidenceUrl ?? null,
      reportedById: userId,
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/me", async (req, res, next) => {
  try {
    const violations = await listUserViolations(req.auth!.userId);
    res.json(violations);
  } catch (error) {
    next(error);
  }
});

router.get("/", requireRole(UserRole.ADMIN, UserRole.MANAGER), async (req, res, next) => {
  try {
    const schema = z.object({
      type: z.nativeEnum(ViolationType).optional(),
      status: z.nativeEnum(ViolationStatus).optional(),
    });
    const filters = schema.parse(req.query);
    const violations = await listViolations(filters);
    res.json(violations);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/resolve", requireRole(UserRole.ADMIN, UserRole.MANAGER), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const violation = await resolveViolation(id, req.auth!.userId);
    res.json(violation);
  } catch (error) {
    next(error);
  }
});

export default router;
