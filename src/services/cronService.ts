import dayjs from "dayjs";
import { BookingStatus, UserRole } from "@prisma/client";
import { prisma } from "../db";
import { createNotification } from "./notificationService";

export function startCronJobs() {
  console.log("Cron jobs started...");

  // Run every 1 minute
  setInterval(async () => {
    try {
      const now = dayjs();
      const tenMinsFromNow = now.add(10, "minute");

      // Find bookings that are confirmed or approved, start within the next 10 mins, and haven't had a reminder sent
      const upcomingBookings = await prisma.booking.findMany({
        where: {
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.APPROVED] },
          reminderSent: false,
          startTime: {
            gt: now.toDate(),
            lte: tenMinsFromNow.toDate(),
          },
        },
        include: {
          user: true,
          facility: true,
        },
      });

      for (const booking of upcomingBookings) {
        // 1. Notify the User
        await createNotification(
          booking.userId,
          "Upcoming Booking Reminder",
          `Reminder: Your booking at ${booking.facility.name} starts in less than 10 minutes!`,
          "EMAIL"
        );

        // 2. Notify the Admin / Coach
        if (booking.facility.category === "PREMIUM" || booking.participants > 10) {
           const managers = await prisma.user.findMany({ where: { role: UserRole.MANAGER } });
           for (const manager of managers) {
             await createNotification(
               manager.id,
               "Event Starting Soon",
               `Large/Premium event starting soon at ${booking.facility.name}`,
               "IN_APP"
             );
           }
        }

        // Find coaches assigned to this facility
        const coaches = await prisma.user.findMany({
          where: { role: UserRole.COACH, managedFacilityId: booking.facility.id }
        });
        
        for (const coach of coaches) {
          await createNotification(
            coach.id,
            "Session Starting Soon",
            `A session is starting soon at your managed facility: ${booking.facility.name}`,
            "IN_APP"
          );
        }

        // Mark as sent
        await prisma.booking.update({
          where: { id: booking.id },
          data: { reminderSent: true },
        });
      }
    } catch (e) {
      console.error("Error in reminder cron job:", e);
    }
  }, 60 * 1000);
}
