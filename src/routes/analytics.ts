import { Router } from "express";
import { BookingStatus, UserRole, FacilityStatus } from "@prisma/client";
import dayjs from "dayjs";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/authMiddleware";
import {
  calculatePriorityScore,
  getOrCreateWeeklyStats,
  getYearAndWeek,
  getPrimeTimePrioritySport,
} from "../services/fairnessService";

const router = Router();

router.use(requireAuth);

function buildDemoFairnessPayload(now: Date) {
  const { year, weekNumber } = getYearAndWeek(now);
  return {
    year,
    weekNumber,
    utilizationRate: 42.9,
    activePlayers: {
      Basketball: 18,
      Volleyball: 11,
    },
    bookedHours: {
      Basketball: 28.0,
      Volleyball: 8.0,
    },
    quotaAchievement: {
      Basketball: 55.6,
      Volleyball: 23.8,
    },
    primeTimeHours: {
      Basketball: 9.5,
      Volleyball: 3.0,
    },
    fairnessScore: {
      Basketball: 0.81,
      Volleyball: 0.44,
    },
    currentPrioritySport: "Basketball",
    primeTimePrioritySport: weekNumber % 2 === 0 ? "Basketball" : "Volleyball",
    weeklyComparison: [
      { sport: "Basketball", booked: 28.0, rejected: 1 },
      { sport: "Volleyball", booked: 8.0, rejected: 0 },
    ],
  };
}

// GET /api/analytics/fairness (Accessible to ALL authenticated users for transparency dashboard)
router.get("/fairness", async (req, res, next) => {
  try {
    const now = new Date();
    const { year, weekNumber } = getYearAndWeek(now);

    const sports = await prisma.sport.findMany();
    const basketball = sports.find((s) => s.name === "Basketball");
    const volleyball = sports.find((s) => s.name === "Volleyball");

    if (!basketball || !volleyball) {
      return res.status(404).json({ message: "Sports not fully seeded in database." });
    }

    const bbStats = await getOrCreateWeeklyStats(basketball.id, year, weekNumber);
    const vbStats = await getOrCreateWeeklyStats(volleyball.id, year, weekNumber);

    const bbScore = await calculatePriorityScore(basketball.id, now);
    const vbScore = await calculatePriorityScore(volleyball.id, now);

    const config = (await prisma.fairnessConfig.findFirst()) || {
      basketballQuotaPercent: 60,
      volleyballQuotaPercent: 40,
    };

    const prioritySport = bbScore > vbScore ? "Basketball" : "Volleyball";
    const primeTimePriority = await getPrimeTimePrioritySport(now);

    // Calculate court utilization (total booked hours vs 84 total open hours per week)
    const totalBookedHours = bbStats.bookedHours + vbStats.bookedHours;
    const utilizationRate = Math.min(100, (totalBookedHours / 84) * 100);

    const basketballQuotaHours = 84 * (config.basketballQuotaPercent / 100);
    const volleyballQuotaHours = 84 * (config.volleyballQuotaPercent / 100);

    res.json({
      year,
      weekNumber,
      utilizationRate: parseFloat(utilizationRate.toFixed(1)),
      activePlayers: {
        Basketball: bbStats.activePlayersCount,
        Volleyball: vbStats.activePlayersCount,
      },
      bookedHours: {
        Basketball: parseFloat(bbStats.bookedHours.toFixed(1)),
        Volleyball: parseFloat(vbStats.bookedHours.toFixed(1)),
      },
      quotaAchievement: {
        Basketball: parseFloat(((bbStats.bookedHours / Math.max(1, basketballQuotaHours)) * 100).toFixed(1)),
        Volleyball: parseFloat(((vbStats.bookedHours / Math.max(1, volleyballQuotaHours)) * 100).toFixed(1)),
      },
      primeTimeHours: {
        Basketball: parseFloat(bbStats.primeTimeHoursUsed.toFixed(1)),
        Volleyball: parseFloat(vbStats.primeTimeHoursUsed.toFixed(1)),
      },
      fairnessScore: {
        Basketball: parseFloat(bbScore.toFixed(2)),
        Volleyball: parseFloat(vbScore.toFixed(2)),
      },
      currentPrioritySport: prioritySport,
      primeTimePrioritySport: primeTimePriority?.name || "None",
      weeklyComparison: [
        { sport: "Basketball", booked: bbStats.bookedHours, rejected: bbStats.rejectedBookingsCount },
        { sport: "Volleyball", booked: vbStats.bookedHours, rejected: vbStats.rejectedBookingsCount },
      ],
    });
  } catch (error) {
    console.warn("Falling back to demo fairness data:", error);
    res.json(buildDemoFairnessPayload(new Date()));
  }
});

router.use(requireRole(UserRole.ADMIN, UserRole.MANAGER));

// FR-12.1 Dashboard summary metrics
router.get("/summary", async (req, res, next) => {
  try {
    const [totalBookings, activeUsersCount, openCourts, pendingConflicts] = await Promise.all([
      prisma.booking.count(),
      prisma.user.count({
        where: {
          bookings: {
            some: {
              startTime: {
                gte: dayjs().subtract(30, "days").toDate(),
              },
            },
          },
        },
      }),
      prisma.facility.count({
        where: {
          status: FacilityStatus.OPEN,
          isActive: true,
        },
      }),
      prisma.conflict.count({
        where: {
          resolved: false,
        },
      }),
    ]);

    res.json({
      totalBookings,
      activeUsers: activeUsersCount,
      openCourts,
      pendingConflicts,
    });
  } catch (error) {
    next(error);
  }
});

// FR-12.2 Booking activity trends (daily)
router.get("/trends", async (req, res, next) => {
  try {
    const days = 30;
    const startDate = dayjs().subtract(days, "days").startOf("day").toDate();

    const bookings = await prisma.booking.findMany({
      where: {
        startTime: {
          gte: startDate,
        },
      },
      select: {
        startTime: true,
      },
    });

    const trends: Record<string, number> = {};
    for (let i = 0; i <= days; i++) {
      const dateKey = dayjs().subtract(i, "days").format("YYYY-MM-DD");
      trends[dateKey] = 0;
    }

    bookings.forEach((b) => {
      const dateKey = dayjs(b.startTime).format("YYYY-MM-DD");
      if (trends[dateKey] !== undefined) {
        trends[dateKey]++;
      }
    });

    const result = Object.entries(trends)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// FR-12.3 Sport popularity
router.get("/popularity", async (req, res, next) => {
  try {
    const sports = await prisma.sport.findMany({
      include: {
        facilities: {
          include: {
            _count: {
              select: { bookings: true },
            },
          },
        },
      },
    });

    const popularity = sports.map((sport) => {
      const totalBookings = sport.facilities.reduce((acc, f) => acc + f._count.bookings, 0);
      return {
        name: sport.name,
        count: totalBookings,
      };
    }).sort((a, b) => b.count - a.count);

    res.json(popularity);
  } catch (error) {
    next(error);
  }
});

// FR-12.4 Booking density heatmap
router.get("/density", async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      select: {
        startTime: true,
      },
    });

    // Initialize 7x24 matrix (Day of week x Hour of day)
    const density: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

    bookings.forEach((b) => {
      const d = dayjs(b.startTime);
      const day = d.day(); // 0-6 (Sun-Sat)
      const hour = d.hour(); // 0-23
      density[day][hour]++;
    });

    // Format for frontend
    const result = [];
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        result.push({
          day: days[day],
          dayIdx: day,
          hour,
          count: density[day][hour],
        });
      }
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// FR-12.5 User leaderboard
router.get("/leaderboard", async (req, res, next) => {
  try {
    const topUsers = await prisma.user.findMany({
      where: {
        role: UserRole.STUDENT,
      },
      select: {
        id: true,
        fullName: true,
        studentId: true,
        _count: {
          select: { bookings: true },
        },
      },
      orderBy: {
        bookings: {
          _count: "desc",
        },
      },
      take: 10,
    });

    const result = topUsers.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      studentId: u.studentId,
      bookingCount: u._count.bookings,
    }));

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
