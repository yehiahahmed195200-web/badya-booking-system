import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/authMiddleware";
import { joinQueue, leaveQueue, getQueueStatus } from "../services/matchmakingService";
import { prisma } from "../db";

const router = Router();

const joinQueueSchema = z.object({
  sportId: z.string().min(1),
  facilityId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
  timeSlot: z.string().regex(/^\d{2}:\d{2}$/, "Format must be HH:MM")
});

const leaveQueueSchema = z.object({
  sportId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
  timeSlot: z.string().regex(/^\d{2}:\d{2}$/, "Format must be HH:MM")
});

// Get available sports and facilities for matchmaking LFG
router.get("/options", requireAuth, async (req, res, next) => {
  try {
    const facilities = await prisma.facility.findMany({
      where: {
        isActive: true,
        status: "OPEN",
        sportId: { not: null }
      },
      include: {
        sport: true
      }
    });

    const options = facilities.map(f => ({
      facilityId: f.id,
      facilityName: f.name,
      sportId: f.sportId!,
      sportName: f.sport?.name || "Unknown Sport",
      icon: f.sport?.icon || "🏅",
      minParticipants: f.sport?.minParticipants || f.minParticipants,
      idealParticipants: f.sport?.idealParticipants || 10,
      openTime: f.openTime,
      closeTime: f.closeTime,
      defaultSlotMins: f.defaultSlotMins
    }));

    res.json(options);
  } catch (error) {
    next(error);
  }
});

// 1. Join matchmaking queue
router.post("/join", requireAuth, async (req, res, next) => {
  try {
    const data = joinQueueSchema.parse(req.body);
    const result = await joinQueue(
      req.auth!.userId,
      data.sportId,
      data.facilityId,
      data.date,
      data.timeSlot
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// 2. Leave matchmaking queue
router.post("/leave", requireAuth, async (req, res, next) => {
  try {
    const data = leaveQueueSchema.parse(req.body);
    const result = await leaveQueue(
      req.auth!.userId,
      data.sportId,
      data.date,
      data.timeSlot
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// 3. Get anonymous queue status/count
router.get("/status", requireAuth, async (req, res, next) => {
  try {
    const query = joinQueueSchema.parse({
      sportId: req.query.sportId,
      facilityId: req.query.facilityId,
      date: req.query.date,
      timeSlot: req.query.timeSlot
    });
    const status = await getQueueStatus(
      query.sportId,
      query.facilityId,
      query.date,
      query.timeSlot
    );
    res.status(200).json(status);
  } catch (error) {
    next(error);
  }
});

// 4. Get active queues for the current user
router.get("/my-queues", requireAuth, async (req, res, next) => {
  try {
    const queues = await prisma.matchmakingQueue.findMany({
      where: { userId: req.auth!.userId },
      include: {
        sport: true,
        facility: true
      }
    });
    res.json(queues);
  } catch (error) {
    next(error);
  }
});

// 5. Get active matched bookings with team assignments for the current user
router.get("/my-matches", requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    // Find bookings where this user is a participant
    const bookings = await prisma.booking.findMany({
      where: {
        bookingParticipants: {
          some: {
            userId
          }
        }
      },
      include: {
        facility: true,
        sport: true,
        bookingParticipants: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                studentId: true,
                skillLevel: true
              }
            }
          }
        }
      },
      orderBy: {
        startTime: "asc"
      }
    });

    // Map to include team assignment info for the current user
    const formattedMatches = bookings.map(b => {
      const myParticipantInfo = b.bookingParticipants.find(p => p.userId === userId);
      const teamA = b.bookingParticipants
        .filter(p => p.team === "A")
        .map(p => ({
          fullName: p.user.fullName || "Anonymous Student",
          studentId: p.user.studentId,
          skillLevel: p.user.skillLevel || "Intermediate"
        }));
      const teamB = b.bookingParticipants
        .filter(p => p.team === "B")
        .map(p => ({
          fullName: p.user.fullName || "Anonymous Student",
          studentId: p.user.studentId,
          skillLevel: p.user.skillLevel || "Intermediate"
        }));

      return {
        id: b.id,
        startTime: b.startTime,
        endTime: b.endTime,
        facilityName: b.facility.name,
        sportName: b.sport?.name || "Unknown Sport",
        myTeam: myParticipantInfo?.team || "A",
        teamA,
        teamB
      };
    });

    res.status(200).json(formattedMatches);
  } catch (error) {
    next(error);
  }
});

export default router;
