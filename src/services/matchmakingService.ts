import dayjs from "dayjs";
import { booking_status } from "@prisma/client";
import { prisma } from "../db";
import { createNotification } from "./notificationService";
import crypto from "crypto";

export interface QueueStatus {
  count: number;
  ideal: number;
  min: number;
  sportName: string;
}

/**
 * Join the matchmaking queue for a specific sport, facility, date, and time slot
 */
export async function joinQueue(
  userId: string,
  sportId: string,
  facilityId: string,
  date: string,
  timeSlot: string
) {
  // 1. Verify user exists and is not banned
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  if (user.isBanned) throw new Error("You are currently banned from making bookings or joining queues.");

  // 2. Verify facility and sport exist
  const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
  if (!facility) throw new Error("Facility not found");
  if (facility.status !== "OPEN") throw new Error(`Facility is currently ${facility.status}`);

  const sport = await prisma.sport.findUnique({ where: { id: sportId } });
  if (!sport) throw new Error("Sport not found");

  // 3. Parse and validate time slot
  const start = dayjs(`${date}T${timeSlot}`);
  if (!start.isValid()) throw new Error("Invalid date or time slot format");
  
  if (start.isBefore(dayjs().add(1, "hour"))) {
    throw new Error("You must join the queue at least 1 hour in advance of the slot.");
  }

  // 4. Check if the slot is within facility operating hours
  const startHour = start.hour();
  const startMin = start.minute();
  const startTimeVal = startHour + startMin / 60;

  const facilityOpenVal = parseInt(facility.openTime.split(":")[0]) + parseInt(facility.openTime.split(":")[1] || "0") / 60;
  const facilityCloseVal = parseInt(facility.closeTime.split(":")[0]) + parseInt(facility.closeTime.split(":")[1] || "0") / 60;

  if (startTimeVal < facilityOpenVal || startTimeVal >= facilityCloseVal) {
    throw new Error(`Facilites are only open between ${facility.openTime} and ${facility.closeTime}.`);
  }

  // 5. Check if user already has a booking overlapping with this slot
  const duration = facility.defaultSlotMins || 60;
  const end = start.add(duration, "minute");

  const overlappingBookings = await prisma.booking.count({
    where: {
      userId,
      status: { in: [booking_status.CONFIRMED, booking_status.APPROVED, booking_status.PENDING] },
      startTime: { lt: end.toDate() },
      endTime: { gt: start.toDate() }
    }
  });

  if (overlappingBookings > 0) {
    throw new Error("You already have an active booking overlapping with this time slot.");
  }

  // Also check if participant in any booking
  const participantOverlaps = await prisma.bookingParticipant.count({
    where: {
      userId,
      booking: {
        status: { in: [booking_status.CONFIRMED, booking_status.APPROVED, booking_status.PENDING] },
        startTime: { lt: end.toDate() },
        endTime: { gt: start.toDate() }
      }
    }
  });

  if (participantOverlaps > 0) {
    throw new Error("You are already registered as a participant in a booking overlapping with this time slot.");
  }

  // 6. Check if user is already in the queue for this exact slot
  const existingQueue = await prisma.matchmakingQueue.findUnique({
    where: {
      userId_sportId_date_timeSlot: {
        userId,
        sportId,
        date,
        timeSlot
      }
    }
  });

  if (existingQueue) {
    return { message: "Already in queue", queueEntry: existingQueue };
  }

  // 7. Add to queue
  const queueEntry = await prisma.matchmakingQueue.create({
    data: {
      userId,
      sportId,
      facilityId,
      date,
      timeSlot
    }
  });

  // 8. Trigger matchmaking process asynchronously
  processQueue(sportId, facilityId, date, timeSlot).catch(err => {
    console.error(`Error processing matchmaking queue for ${sportId} on ${date} @ ${timeSlot}:`, err);
  });

  return { message: "Successfully joined the queue", queueEntry };
}

/**
 * Leave the matchmaking queue
 */
export async function leaveQueue(
  userId: string,
  sportId: string,
  date: string,
  timeSlot: string
) {
  try {
    await prisma.matchmakingQueue.delete({
      where: {
        userId_sportId_date_timeSlot: {
          userId,
          sportId,
          date,
          timeSlot
        }
      }
    });
    return { success: true, message: "Left queue successfully" };
  } catch (error) {
    throw new Error("Queue entry not found");
  }
}

/**
 * Get the anonymous status of a queue
 */
export async function getQueueStatus(
  sportId: string,
  facilityId: string,
  date: string,
  timeSlot: string
): Promise<QueueStatus> {
  const sport = await prisma.sport.findUnique({ where: { id: sportId } });
  if (!sport) throw new Error("Sport not found");

  const count = await prisma.matchmakingQueue.count({
    where: {
      sportId,
      facilityId,
      date,
      timeSlot
    }
  });

  return {
    count,
    ideal: sport.idealParticipants,
    min: sport.minParticipants,
    sportName: sport.name
  };
}

/**
 * Perform the score-based greedy team balancing algorithm
 */
export function balanceTeams(
  players: { userId: string; skillLevel: string }[]
): { userId: string; team: "A" | "B" }[] {
  const skillScores: Record<string, number> = {
    Advanced: 3,
    Intermediate: 2,
    Beginner: 1
  };

  // Assign scores (default to 2/Intermediate if invalid/missing)
  const playersWithScores = players.map(p => ({
    userId: p.userId,
    score: skillScores[p.skillLevel] ?? 2
  }));

  // Sort Descending by score
  playersWithScores.sort((a, b) => b.score - a.score);

  const teamA: typeof playersWithScores = [];
  const teamB: typeof playersWithScores = [];
  let sumA = 0;
  let sumB = 0;

  const maxTeamSize = Math.ceil(players.length / 2);

  for (const player of playersWithScores) {
    const spaceInA = teamA.length < maxTeamSize;
    const spaceInB = teamB.length < maxTeamSize;

    if (spaceInA && !spaceInB) {
      teamA.push(player);
      sumA += player.score;
    } else if (!spaceInA && spaceInB) {
      teamB.push(player);
      sumB += player.score;
    } else {
      // Both have space: assign to team with lower cumulative score
      if (sumA < sumB) {
        teamA.push(player);
        sumA += player.score;
      } else if (sumB < sumA) {
        teamB.push(player);
        sumB += player.score;
      } else {
        // Equal scores: assign to team with fewer players to keep sizes equal
        if (teamA.length <= teamB.length) {
          teamA.push(player);
          sumA += player.score;
        } else {
          teamB.push(player);
          sumB += player.score;
        }
      }
    }
  }

  // Return mapped array
  return [
    ...teamA.map(p => ({ userId: p.userId, team: "A" as const })),
    ...teamB.map(p => ({ userId: p.userId, team: "B" as const }))
  ];
}

/**
 * Process queue and execute matchmaking matching logic
 */
export async function processQueue(
  sportId: string,
  facilityId: string,
  date: string,
  timeSlot: string
) {
  const sport = await prisma.sport.findUnique({ where: { id: sportId } });
  if (!sport) return null;

  const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
  if (!facility) return null;

  // 1. Check if facility is already booked for this slot
  const start = dayjs(`${date}T${timeSlot}`);
  const duration = facility.defaultSlotMins || 60;
  const end = start.add(duration, "minute");

  const overlappingBooking = await prisma.booking.findFirst({
    where: {
      facilityId,
      status: { in: [booking_status.CONFIRMED, booking_status.APPROVED, booking_status.PENDING] },
      startTime: { lt: end.toDate() },
      endTime: { gt: start.toDate() }
    }
  });

  if (overlappingBooking) {
    console.log(`Matchmaking skipped for ${sport.name} at ${facility.name} on ${date} @ ${timeSlot}: Facility already booked.`);
    return null;
  }

  // 2. Fetch all queued players ordered by entry date (first-in-first-out waitlist priority)
  const queue = await prisma.matchmakingQueue.findMany({
    where: {
      sportId,
      facilityId,
      date,
      timeSlot
    },
    include: {
      user: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  if (queue.length === 0) return null;

  const hoursToStart = start.diff(dayjs(), "hour");
  let matchedUsers: typeof queue = [];

  // 3. Core matching heuristics
  if (hoursToStart > 24) {
    // A. Slot is > 24 hours away. Prioritize exact same-skill match.
    const skillGroups: Record<string, typeof queue> = {
      Beginner: [],
      Intermediate: [],
      Advanced: []
    };

    for (const q of queue) {
      const skill = q.user.skillLevel || "Intermediate";
      if (skillGroups[skill]) {
        skillGroups[skill].push(q);
      } else {
        skillGroups["Intermediate"].push(q);
      }
    }

    // Check if any skill group has reached the ideal count
    for (const skill of ["Advanced", "Intermediate", "Beginner"]) {
      if (skillGroups[skill].length >= sport.idealParticipants) {
        matchedUsers = skillGroups[skill].slice(0, sport.idealParticipants);
        break;
      }
    }
  } else {
    // B. Slot is <= 24 hours away. Relax skill criteria to mix players.
    // Match immediately if we reach minParticipants
    if (queue.length >= sport.minParticipants) {
      const numToMatch = Math.min(queue.length, sport.idealParticipants);
      matchedUsers = queue.slice(0, numToMatch);
    }
  }

  if (matchedUsers.length === 0) {
    return null; // Not enough players or skill groups yet
  }

  // 4. We have a match! Perform booking creation and team balancing
  const matchedUserIds = matchedUsers.map(q => q.userId);
  const playerSkills = matchedUsers.map(q => ({
    userId: q.userId,
    skillLevel: q.user.skillLevel || "Intermediate"
  }));

  // Perform Team Balancing
  const balancedTeams = balanceTeams(playerSkills);

  // Generate Booking
  const bookingId = crypto.randomUUID();
  const newBooking = await prisma.booking.create({
    data: {
      id: bookingId,
      userId: matchedUserIds[0], // First player designates creator
      facilityId,
      sportId,
      startTime: start.toDate(),
      endTime: end.toDate(),
      participants: matchedUserIds.length,
      status: booking_status.CONFIRMED, // System matches are pre-confirmed
      requiresApproval: false,
      buddyIds: "[]"
    }
  });

  // Create participants with assigned teams
  const participantData = balancedTeams.map(p => ({
    bookingId: newBooking.id,
    userId: p.userId,
    team: p.team
  }));

  await prisma.bookingParticipant.createMany({
    data: participantData
  });

  // 5. Clean up queue for matched users
  await prisma.matchmakingQueue.deleteMany({
    where: {
      id: { in: matchedUsers.map(q => q.id) }
    }
  });

  // 6. Notify matched players
  for (const player of balancedTeams) {
    const teamName = player.team === "A" ? "Team A (اليمين)" : "Team B (اليسار)";
    try {
      await createNotification(
        player.userId,
        "🎯 تم العثور على مباراة! (Game Matched)",
        `تم تسجيلك بنجاح في مباراة ${sport.name} بملعب ${facility.name} يوم ${date} في تمام الساعة ${timeSlot}. لقد تم توزيعك في: [${teamName}]. حظاً موفقاً!`,
        "EMAIL"
      );
    } catch (err) {
      console.warn(`Failed to send match notification to user ${player.userId}:`, err);
    }
  }

  console.log(`Successfully matched ${matchedUserIds.length} players for ${sport.name} on ${date} @ ${timeSlot}. Booking ID: ${newBooking.id}`);
  return { booking: newBooking, participants: balancedTeams };
}
