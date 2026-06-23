import { Router } from "express";
import { UserRole, BookingStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/authMiddleware";
import { changeFacilityStatus } from "../services/facilityService";

const router = Router();

const createFacilitySchema = z.object({
  name: z.string().min(2),
  category: z.string().min(2),
  defaultSlotMins: z.number().int().positive().default(60),
  openTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  closeTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  minParticipants: z.number().int().positive(),
  maxParticipants: z.number().int().positive(),
  isActive: z.boolean().default(true),
  feedbackEnabled: z.boolean().default(true),
});

router.post("/", requireAuth, requireRole(UserRole.ADMIN), async (req, res, next) => {
  try {
    const data = createFacilitySchema.parse(req.body);
    if (data.minParticipants > data.maxParticipants) {
      throw new Error("minParticipants cannot be greater than maxParticipants");
    }

    const facility = await prisma.facility.create({ data });
    res.status(201).json(facility);
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res) => {
  const activeOnly = req.query.active === "true";
  const facilities = await prisma.facility.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { name: "asc" },
  });
  res.json(facilities);
});

router.patch("/:id/status", requireAuth, requireRole(UserRole.ADMIN), async (req, res, next) => {
  try {
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        status: z.enum(["OPEN", "MAINTENANCE", "TOURNAMENT", "CLOSED"]),
        statusReason: z.string().optional(),
        policy: z.enum(["CANCEL", "KEEP"]).optional(),
        notifyUsers: z.boolean().optional(),
      })
      .parse(req.body);

    const result = await changeFacilityStatus({
      facilityId: params.id,
      status: body.status,
      statusReason: body.statusReason,
      policy: body.policy,
      notifyUsers: body.notifyUsers,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/settings", requireAuth, requireRole(UserRole.ADMIN), async (req, res, next) => {
  try {
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        defaultSlotMins: z.number().int().positive().optional(),
        minParticipants: z.number().int().positive().optional(),
        maxParticipants: z.number().int().positive().optional(),
        feedbackEnabled: z.boolean().optional(),
      })
      .parse(req.body);

    if (
      body.minParticipants !== undefined &&
      body.maxParticipants !== undefined &&
      body.minParticipants > body.maxParticipants
    ) {
      throw new Error("minParticipants cannot be greater than maxParticipants");
    }

    const facility = await prisma.facility.update({
      where: { id: params.id },
      data: body,
    });

    res.json(facility);
  } catch (error) {
    next(error);
  }
});

// Full edit — name, category, times, participants, location, etc.
router.put("/:id", requireAuth, requireRole(UserRole.ADMIN), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        name:             z.string().min(2).optional(),
        category:         z.string().min(2).optional(),
        openTime:         z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
        closeTime:        z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
        defaultSlotMins:  z.number().int().positive().optional(),
        minParticipants:  z.number().int().positive().optional(),
        maxParticipants:  z.number().int().positive().optional(),
        isActive:         z.boolean().optional(),
        feedbackEnabled:  z.boolean().optional(),
        latitude:         z.number().optional().nullable(),
        longitude:        z.number().optional().nullable(),
        geofencingRadius: z.number().positive().optional().nullable(),
      })
      .parse(req.body);

    if (
      body.minParticipants !== undefined &&
      body.maxParticipants !== undefined &&
      body.minParticipants > body.maxParticipants
    ) {
      return res.status(400).json({ message: "minParticipants cannot be greater than maxParticipants" });
    }

    const facility = await prisma.facility.update({
      where: { id },
      data: body,
    });

    res.json(facility);
  } catch (error) {
    next(error);
  }
});

// Soft-delete (deactivate) a facility
router.delete("/:id", requireAuth, requireRole(UserRole.ADMIN), async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const facility = await prisma.facility.update({
      where: { id },
      data: { isActive: false, status: "CLOSED" },
    });
    res.json({ success: true, facility });
  } catch (error) {
    next(error);
  }
});

// FR-2.1 — Real-time availability for a facility on a given date
router.get("/:id/availability", async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.query.date as string);

    const facility = await prisma.facility.findUnique({ where: { id } });
    if (!facility) return res.status(404).json({ message: "Facility not found" });

    const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dayEnd   = new Date(`${dateStr}T23:59:59.999Z`);

    const bookings = await prisma.booking.findMany({
      where: {
        facilityId: id,
        startTime: { gte: dayStart, lte: dayEnd },
        status: { in: ["PENDING", "APPROVED", "CONFIRMED"] },
      },
      select: { startTime: true, endTime: true, participants: true, status: true },
    });

    // Build hourly slots from openTime to closeTime
    const [openH] = facility.openTime.split(":").map(Number);
    const [closeH] = facility.closeTime.split(":").map(Number);
    const slotMins = facility.defaultSlotMins;
    const slots: { time: string; available: boolean; bookedCount: number }[] = [];

    for (let h = openH; h < closeH; h += slotMins / 60) {
      const hh = Math.floor(h).toString().padStart(2, "0");
      const mm = ((h % 1) * 60).toString().padStart(2, "0");
      const slotTime = `${hh}:${mm}`;
      const slotStart = new Date(`${dateStr}T${slotTime}:00`);
      const slotEnd = new Date(slotStart.getTime() + slotMins * 60000);

      const overlapping = bookings.filter(b =>
        new Date(b.startTime) < slotEnd && new Date(b.endTime) > slotStart
      );

      slots.push({ time: slotTime, available: overlapping.length === 0, bookedCount: overlapping.length });
    }

    res.json({ date: dateStr, facility: { id, name: facility.name, slotMins }, slots });
  } catch (error) {
    next(error);
  }
});

// FR-2.8 — Repeat-user indicator: how many times user has booked this facility
router.get("/:id/repeat-check", requireAuth, async (req, res) => {
  const { id } = req.params;
  const normalizedId = Array.isArray(id) ? id[0] : id;
  const count = await prisma.booking.count({
    where: { facilityId: normalizedId, userId: req.auth!.userId, status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } },
  });
  res.json({ facilityId: normalizedId, previousBookings: count, isRepeatUser: count > 0 });
});

export default router;
