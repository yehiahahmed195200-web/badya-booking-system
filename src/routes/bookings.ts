import { Router } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/authMiddleware";
import { cancelBooking, createBooking } from "../services/bookingService";

const router = Router();

const createBookingSchema = z.object({
  facilityId: z.string().min(1),
  sportId: z.string().optional(), // NEW: Optional sportId for shared facilities
  sport: z.string().optional(), // ADDED: Allow sport name string
  startTime: z.coerce.date(),
  participants: z.coerce.number().int().positive(),
  durationMins: z.coerce.number().int().positive().optional(),
  termsAccepted: z.boolean().default(false),
  buddyIds: z.array(z.string()).default([]),
});

// ─── Create Booking ─────────────────────────────────────────────────────────
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const data = createBookingSchema.parse(req.body);

    if (!data.termsAccepted) {
      return res.status(400).json({ code: "TERMS_NOT_ACCEPTED", message: "You must accept the terms and conditions." });
    }

    let resolvedSportId = data.sportId;
    if (!resolvedSportId && data.sport) {
      const sportRecord = await prisma.sport.findFirst({
        where: { name: { equals: data.sport, mode: "insensitive" } }
      });
      if (sportRecord) {
        resolvedSportId = sportRecord.id;
      }
    }

    const booking = await createBooking({
      facilityId: data.facilityId,
      sportId: resolvedSportId,
      startTime: data.startTime,
      participants: data.participants,
      durationMins: data.durationMins,
      userId: req.auth!.userId,
      buddyIds: data.buddyIds,
    });

    // Save terms accepted
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        termsAccepted: data.termsAccepted,
      },
    });

    // Notify buddy students
    for (const buddyId of data.buddyIds) {
      const buddy = await prisma.user.findUnique({ where: { studentId: buddyId } });
      if (buddy) {
        await prisma.notification.create({
          data: {
            userId: buddy.id,
            title: "Buddy Booking",
            message: `You have been added to a booking at ${booking.facilityId} on ${booking.startTime.toLocaleString()}.`,
            channel: "APP",
          },
        });
      }
    }

    // Award points based on time of day (FR-1.3)
    const hour = new Date(booking.startTime).getHours();
    const isOffPeak = hour < 10 || hour >= 19;
    const pointsToAward = isOffPeak ? 25 : 10;
    await prisma.user.update({
      where: { id: req.auth!.userId },
      data: { points: { increment: pointsToAward } },
    });

    res.status(201).json({
      message: "Booking submitted successfully",
      pointsAwarded: pointsToAward,
      isOffPeak,
      booking,
    });
  } catch (error) {
    next(error);
  }
});

// ─── Get All Bookings ────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  let where;
  if (req.auth!.role === UserRole.ADMIN || req.auth!.role === UserRole.MANAGER) {
    where = undefined;
  } else if (req.auth!.role === UserRole.COACH) {
    const coach = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    where = coach?.managedFacilityId ? { facilityId: coach.managedFacilityId } : { id: "__none__" };
  } else {
    where = { userId: req.auth!.userId };
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: { user: true, facility: true },
    orderBy: { startTime: "asc" },
  });

  res.json(bookings);
});

// ─── My Daily Quota per Facility ─────────────────────────────────────────────
// Returns how many minutes the current user has used & remaining per facility today
router.get("/my-quota", requireAuth, async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Today's boundaries
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay   = new Date(now); endOfDay.setHours(23, 59, 59, 999);

    // Get all active facilities
    const facilities = await prisma.facility.findMany({ where: { isActive: true } });

    const quotas = await Promise.all(facilities.map(async (facility) => {
      // All non-cancelled bookings for this facility today
      const bookings = await prisma.booking.findMany({
        where: {
          facilityId: facility.id,
          startTime:  { gte: startOfDay, lte: endOfDay },
          status:     { not: "CANCELLED" as any },
        },
      });

      let usedMins = 0;
      for (const b of bookings) {
        // Am I the booking creator OR one of the buddies?
        let isParticipant = b.userId === userId;
        if (!isParticipant) {
          try {
            const buddies: string[] = JSON.parse(b.buddyIds || "[]");
            if (buddies.includes(user.studentId)) isParticipant = true;
          } catch {}
        }
        if (isParticipant) {
          const mins = Math.round(
            (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60_000
          );
          usedMins += mins;
        }
      }

      const usedCapped     = Math.min(usedMins, 60);
      const remainingMins  = Math.max(0, 60 - usedCapped);

      return {
        facilityId:    facility.id,
        facilityName:  facility.name,
        usedMins:      usedCapped,
        remainingMins,
        exhausted:     remainingMins === 0,
      };
    }));

    res.json({ date: now.toISOString().split("T")[0], quotas });
  } catch (err) {
    res.status(500).json({ message: "Failed to compute quota" });
  }
});


router.patch("/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    const params = z.object({ id: z.string() }).parse(req.params);
    const booking = await cancelBooking(params.id, req.auth!.userId, req.auth!.role);
    res.json({ message: "Booking cancelled", booking });
  } catch (error) {
    next(error);
  }
});

// ─── Reschedule Booking (FR-2.9) ─────────────────────────────────────────────
router.post("/:id/reschedule", requireAuth, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { startTime, durationMins } = z.object({
      startTime: z.coerce.date(),
      durationMins: z.coerce.number().int().positive().optional(),
    }).parse(req.body);

    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Booking not found" });
    if (existing.userId !== req.auth!.userId) return res.status(403).json({ message: "Not your booking" });

    // Cancel old booking
    await cancelBooking(id, req.auth!.userId, req.auth!.role);

    // Create new booking
    const newBooking = await createBooking({
      facilityId: existing.facilityId,
      startTime,
      participants: existing.participants,
      durationMins,
      userId: req.auth!.userId,
    });

    await prisma.booking.update({
      where: { id: newBooking.id },
      data: { termsAccepted: true, buddyIds: existing.buddyIds },
    });

    res.json({ message: "Booking rescheduled", booking: newBooking });
  } catch (error) {
    next(error);
  }
});

export default router;
