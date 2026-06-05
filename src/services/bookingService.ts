import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { BookingStatus, UserRole } from "@prisma/client";
import { prisma } from "../db";
import { isWithinOperatingHours } from "../utils/time";
import { createNotification } from "./notificationService";
import {
  checkAntiMonopolyRules,
  calculatePriorityScore,
  canBookPrimeTime,
  getOrCreateWeeklyStats,
  isPrimeTime,
  getYearAndWeek,
} from "./fairnessService";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

type CreateBookingInput = {
  userId: string;
  facilityId: string;
  sportId?: string; // NEW: Track which sport the booking is for
  startTime: Date;
  participants: number;
  durationMins?: number;
  buddyIds?: string[];
};

export async function createBooking(input: CreateBookingInput) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new Error("User not found");
  
  // PART 10: BAN MANAGEMENT
  if (user.isBanned) throw new Error("User is banned from booking");

  const facility = await prisma.facility.findUnique({ 
    where: { id: input.facilityId },
    include: { sport: true }
  });
  if (!facility) throw new Error("Facility not found");
  if (facility.status !== "OPEN") throw new Error(`Facility is currently ${facility.status}`);

  // Auto-fill sportId if the facility is dedicated to a single sport
  const effectiveSportId = input.sportId || facility.sportId;

  // If the facility is shared (no default sportId) and booking does not specify a sport, throw error
  if (!effectiveSportId && (facility.name === "Multipurpose Court" || !facility.sportId)) {
    throw new Error("This court is shared. You must specify which sport you are booking for (Basketball or Volleyball).");
  }

  let sport = null;
  if (effectiveSportId) {
    sport = await prisma.sport.findUnique({ where: { id: effectiveSportId } });
    if (!sport) throw new Error("Sport not found");
  }

  // PART 9: Rules
  const systemRule = await prisma.systemRule.findFirst();
  
  // PART 2: Validations
  if (input.participants < facility.minParticipants || input.participants > facility.maxParticipants) {
    throw new Error(`Participants must be between ${facility.minParticipants} and ${facility.maxParticipants}`);
  }

  const duration = input.durationMins ?? facility.defaultSlotMins;
  if (duration < 20 || duration > 90) {
    throw new Error("Strict Rule: Booking duration must be between 20 minutes and 90 minutes.");
  }

  const start = dayjs(input.startTime);
  const end = start.add(duration, "minute");

  // Prevent past bookings
  if (start.isBefore(dayjs().startOf('day'))) {
    throw new Error("You cannot book a slot in the past. Time travel is not allowed!");
  }

  const startHour = start.hour();
  const startMin = start.minute();
  const endHour = end.hour();
  const endMin = end.minute();
  
  const startTimeVal = startHour + startMin / 60;
  const endTimeVal = endHour + endMin / 60;

  // Operating hours check (Dynamic instead of hardcoded 09:00 to 15:00)
  const facilityOpenVal = parseInt(facility.openTime.split(":")[0]) + parseInt(facility.openTime.split(":")[1] || "0") / 60;
  const facilityCloseVal = parseInt(facility.closeTime.split(":")[0]) + parseInt(facility.closeTime.split(":")[1] || "0") / 60;

  if (startTimeVal < facilityOpenVal || endTimeVal > facilityCloseVal) {
    throw new Error(`System is closed. Bookings for ${facility.name} are only allowed between ${facility.openTime} and ${facility.closeTime}.`);
  }

  // No on-spot reservations (must be pre-booked at least 1 hour in advance)
  if (start.isBefore(dayjs().add(1, 'hour'))) {
    throw new Error("Reservations must be made at least 1 hour in advance. No on-spot booking allowed.");
  }

  // Active bookings check (No double booking)
  const userActiveBookings = await prisma.booking.count({
    where: {
      userId: input.userId,
      status: { in: [BookingStatus.PENDING, BookingStatus.APPROVED, BookingStatus.CONFIRMED] },
      startTime: { lt: end.toDate() },
      endTime: { gt: start.toDate() }
    }
  });
  if (userActiveBookings > 0) {
    throw new Error("You already have a booking at this time");
  }

  // Daily Quota (Max 60 mins per game per day for creator AND all buddies)
  const startOfDay = start.startOf('day').toDate();
  const endOfDay = start.endOf('day').toDate();

  const buddyIds = input.buddyIds || [];
  
  if (input.participants !== buddyIds.length + 1) {
    throw new Error(`Participant count mismatch. You specified ${input.participants} participants but provided ${buddyIds.length} buddies.`);
  }

  // Find all internal user IDs for buddies
  const internalBuddyIds: string[] = [];
  for (const bId of buddyIds) {
    const buddyUser = await prisma.user.findUnique({ where: { studentId: bId } });
    if (!buddyUser) {
      throw new Error(`Buddy with Student ID ${bId} does not exist in the system.`);
    }
    internalBuddyIds.push(buddyUser.id);
  }

  const allParticipantIds = [input.userId, ...internalBuddyIds];

  for (const pid of allParticipantIds) {
    // We must check if THIS user is already part of any bookings for THIS facility today
    const todaysBookingsForFacility = await prisma.booking.findMany({
      where: {
        facilityId: input.facilityId,
        startTime: { gte: startOfDay, lte: endOfDay },
        status: { not: BookingStatus.CANCELLED }
      },
      include: { user: true }
    });

    let totalDurationMins = 0;
    const userStudentId = pid === input.userId ? user.studentId : (await prisma.user.findUnique({where: {id: pid}}))?.studentId;

    for (const b of todaysBookingsForFacility) {
      let isParticipant = false;
      if (b.userId === pid) {
        isParticipant = true;
      } else {
        try {
          const bBuddies: string[] = JSON.parse(b.buddyIds || "[]");
          if (bBuddies.includes(userStudentId || "")) {
            isParticipant = true;
          }
        } catch(e){}
      }

      if (isParticipant) {
        const bStart = dayjs(b.startTime);
        const bEnd = dayjs(b.endTime);
        totalDurationMins += bEnd.diff(bStart, 'minute');
      }
    }

    if (totalDurationMins + duration > 60 && facility.name !== "Multipurpose Court") {
      if (pid === input.userId) {
        throw new Error(`You have already reached the 1-hour daily limit for this facility. Come back tomorrow!`);
      } else {
        throw new Error(`Student ${userStudentId} has already reached their 1-hour daily limit for this facility. Booking rejected.`);
      }
    }
  }

  if (systemRule) {
    // Advance booking window
    const maxAdvanceDate = dayjs().add(systemRule.advanceBookingWindow, 'day');
    if (start.isAfter(maxAdvanceDate)) {
      throw new Error(`Cannot book more than ${systemRule.advanceBookingWindow} days in advance`);
    }
  }

  // ─── FAIRNESS ENGINE ENFORCEMENT ───
  if (sport) {
    // 1. Anti-Monopoly Checks
    await checkAntiMonopolyRules(input.userId, input.facilityId, input.startTime, duration, buddyIds);

    // 2. Prime Time Reservation Check
    const ptCheck = await canBookPrimeTime(sport.id, input.startTime);
    if (!ptCheck.allowed) {
      throw new Error(ptCheck.message);
    }
  }

  // PART 3: AUTOMATED CONFLICT RESOLUTION
  const overlappingBookings = await prisma.booking.findMany({
    where: {
      facilityId: input.facilityId,
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.APPROVED] },
      startTime: { lt: end.toDate() },
      endTime: { gt: start.toDate() },
    },
    include: { sport: true, user: true }
  });

  let conflictId = null;
  if (overlappingBookings.length > 0 && sport) {
    for (const b of overlappingBookings) {
      if (b.sportId && b.sportId !== sport.id) {
        // Run Fairness Calculator
        const existingPriority = await calculatePriorityScore(b.sportId, input.startTime);
        const requestedPriority = await calculatePriorityScore(sport.id, input.startTime);

        if (requestedPriority > existingPriority) {
          // The new request has higher priority (under-served). Cancel the old one!
          await prisma.booking.update({
            where: { id: b.id },
            data: {
              status: BookingStatus.CANCELLED,
              rejectionReason: `Auto-resolved: ${sport.name} had higher fairness priority (${requestedPriority.toFixed(2)} vs ${existingPriority.toFixed(2)}) this week.`,
            }
          });

          // Log rejection stats
          const { year, weekNumber } = getYearAndWeek(input.startTime);
          const loserStats = await getOrCreateWeeklyStats(b.sportId, year, weekNumber);
          await prisma.weeklySportStats.update({
            where: { id: loserStats.id },
            data: { rejectedBookingsCount: { increment: 1 } }
          });

          // Send notification
          await createNotification(
            b.userId,
            "Booking Cancelled (Fairness Engine) ⚖️",
            `Your booking for ${facility.name} was automatically replaced because ${sport.name} was granted higher priority this week.`,
            "EMAIL"
          );

          // Find system admin or fallback to creator
          const adminUser = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
          const adminLogId = adminUser ? adminUser.id : input.userId;

          // Admin Log
          await prisma.adminLog.create({
            data: {
              adminId: adminLogId,
              action: "AUTO_CONFLICT_RESOLUTION",
              targetId: b.id,
              details: `Auto-resolved conflict in favor of ${sport.name} (${requestedPriority.toFixed(2)}) over ${b.sport?.name} (${existingPriority.toFixed(2)}).`,
            }
          });

        } else {
          throw new Error(`Conflict: This slot is already booked for ${b.sport?.name} which currently has higher fairness priority (${existingPriority.toFixed(2)} vs ${requestedPriority.toFixed(2)}).`);
        }
      } else {
        throw new Error("This slot is already booked by another user. Double booking is disabled.");
      }
    }
  } else if (overlappingBookings.length > 0) {
    throw new Error("This slot is already booked by another user.");
  }

  // PART 8: APPROVAL WORKFLOW
  const requiresApproval = facility.category === "PREMIUM" || input.participants > 10;
  const status = requiresApproval ? BookingStatus.PENDING : BookingStatus.CONFIRMED;

  const booking = await prisma.booking.create({
    data: {
      userId: input.userId,
      facilityId: input.facilityId,
      sportId: effectiveSportId, // Save the selected sport
      startTime: start.toDate(),
      endTime: end.toDate(),
      participants: input.participants,
      status,
      requiresApproval,
      approverRole: requiresApproval ? UserRole.MANAGER : null,
      conflictId: null,
      buddyIds: JSON.stringify(buddyIds),
    },
    include: {
      facility: true,
      user: true,
    },
  });

  // Update stats on successful creation
  if (sport) {
    const { year, weekNumber } = getYearAndWeek(input.startTime);
    const stats = await getOrCreateWeeklyStats(sport.id, year, weekNumber);
    const hours = duration / 60;
    const isPT = await isPrimeTime(input.startTime);

    await prisma.weeklySportStats.update({
      where: { id: stats.id },
      data: {
        bookedHours: { increment: hours },
        primeTimeHoursUsed: isPT ? { increment: hours } : undefined,
      }
    });
  }

  if (requiresApproval) {
    // Notify Approvers
    const approvers = await prisma.user.findMany({ where: { role: UserRole.MANAGER } });
    for (const approver of approvers) {
      await createNotification(approver.id, "Approval Required", `New booking requires approval`, "IN_APP");
    }
  } else {
    await createNotification(input.userId, "Booking Confirmed", `Your booking at ${facility.name} is confirmed`, "EMAIL");
  }

  return booking;
}

export async function cancelBooking(bookingId: string, requesterId: string, requesterRole: UserRole) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("Booking not found");
  if (!([BookingStatus.CONFIRMED, BookingStatus.PENDING, BookingStatus.APPROVED] as BookingStatus[]).includes(booking.status)) {
    throw new Error("Only active bookings can be cancelled");
  }

  if (requesterRole !== UserRole.ADMIN && booking.userId !== requesterId) {
    throw new Error("You can only cancel your own booking");
  }

  const systemRule = await prisma.systemRule.findFirst();
  if (systemRule && requesterRole !== UserRole.ADMIN) {
    const hoursToStart = dayjs(booking.startTime).diff(dayjs(), 'hour');
    if (hoursToStart < systemRule.minimumNoticeTime) {
      throw new Error(`Cannot cancel less than ${systemRule.minimumNoticeTime} hours before start time`);
    }
  }

  return prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.CANCELLED },
  });
}

// Admin approves a booking
export async function approveBooking(bookingId: string, approverId: string) {
  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.APPROVED },
  });
  await createNotification(booking.userId, "Booking Approved", "Your booking has been approved", "EMAIL");
  return booking;
}

// Admin rejects a booking
export async function rejectBooking(bookingId: string, approverId: string, reason: string) {
  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.REJECTED, rejectionReason: reason },
  });
  await createNotification(booking.userId, "Booking Rejected", `Your booking was rejected. Reason: ${reason}`, "EMAIL");
  return booking;
}

export async function resolveConflict(
  conflictId: string,
  approvedBookingId: string,
  rejectedBookingId: string,
  adminId: string
) {
  // 1. Approve the chosen booking
  const approved = await prisma.booking.update({
    where: { id: approvedBookingId },
    data: { status: BookingStatus.APPROVED },
    include: { user: true, facility: true },
  });

  // 2. Reject the other booking with clear reason
  const rejected = await prisma.booking.update({
    where: { id: rejectedBookingId },
    data: { status: BookingStatus.REJECTED, rejectionReason: "Conflict resolution — another booking was approved for this slot." },
    include: { user: true, facility: true },
  });

  // 3. Mark conflict resolved
  const resolvedConflict = await prisma.conflict.update({
    where: { id: conflictId },
    data: { resolved: true, resolvedAt: new Date(), resolvedBy: adminId },
  });

  // 4. Notify approved user
  await createNotification(
    approved.userId,
    "Booking Approved ✅",
    `Your booking at ${approved.facility?.name} has been approved after conflict resolution.`,
    "EMAIL"
  );

  // 5. Notify rejected user (FR-1.5 — notifications for punishments/decisions)
  await createNotification(
    rejected.userId,
    "Booking Rejected ❌",
    `Your booking at ${rejected.facility?.name} on ${rejected.startTime.toLocaleString()} was rejected because another booking was approved for the same slot.`,
    "EMAIL"
  );

  // 6. FR-3.4 — Audit log with timestamp and admin identity
  await prisma.adminLog.create({
    data: {
      adminId,
      action:  "CONFLICT_RESOLVED",
      targetId: conflictId,
      details: JSON.stringify({
        conflictId,
        approvedBookingId,
        approvedUser: approved.user?.fullName,
        approvedFacility: approved.facility?.name,
        approvedTime: approved.startTime,
        rejectedBookingId,
        rejectedUser: rejected.user?.fullName,
        resolvedAt: new Date().toISOString(),
      }),
    },
  });

  return { resolvedConflict, approved, rejected };
}
