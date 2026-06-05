import { Router } from "express";
import { BookingStatus, UserRole } from "@prisma/client";
import dayjs from "dayjs";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/authMiddleware";

const router = Router();

router.get("/monthly", requireAuth, requireRole(UserRole.ADMIN, UserRole.COACH), async (req, res, next) => {
  try {
    const monthInput = String(req.query.month || dayjs().format("YYYY-MM"));
    const start = dayjs(`${monthInput}-01`).startOf("month");
    const end = start.endOf("month");

    if (!start.isValid()) {
      throw new Error("Invalid month format, expected YYYY-MM");
    }

    const bookings = await prisma.booking.findMany({
      where: {
        startTime: {
          gte: start.toDate(),
          lte: end.toDate(),
        },
      },
      include: {
        facility: true,
      },
    });

    const byFacility = bookings.reduce<Record<string, { bookings: number; usageHours: number }>>((acc, b) => {
      const key = b.facility.name;
      if (!acc[key]) acc[key] = { bookings: 0, usageHours: 0 };

      const durationHours = (b.endTime.getTime() - b.startTime.getTime()) / 3600000;
      acc[key].bookings += 1;
      acc[key].usageHours += Number(durationHours.toFixed(2));
      return acc;
    }, {});

    const statusBreakdown = {
      confirmed: bookings.filter((b) => b.status === BookingStatus.CONFIRMED).length,
      cancelled: bookings.filter((b) => b.status === BookingStatus.CANCELLED).length,
      completed: bookings.filter((b) => b.status === BookingStatus.COMPLETED).length,
    };

    res.json({
      month: monthInput,
      quick: {
        totalBookings: bookings.length,
        statusBreakdown,
      },
      byFacility,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/custom", requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), async (req, res, next) => {
  try {
    const { startDate, endDate, facilityId, sportId, userId } = req.query;
    
    let whereClause: any = {};
    
    if (startDate && endDate) {
      whereClause.startTime = {
        gte: dayjs(startDate as string).toDate(),
        lte: dayjs(endDate as string).endOf('day').toDate(),
      };
    }
    
    if (facilityId) whereClause.facilityId = facilityId;
    if (userId) whereClause.userId = userId;
    if (sportId) {
      whereClause.facility = { sportId: sportId };
    }

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      include: {
        facility: { include: { sport: true } },
        user: true
      },
      orderBy: { startTime: 'desc' }
    });

    const statusBreakdown = bookings.reduce((acc, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      total: bookings.length,
      statusBreakdown,
      data: bookings
    });

  } catch (error) {
    next(error);
  }
});

export default router;
