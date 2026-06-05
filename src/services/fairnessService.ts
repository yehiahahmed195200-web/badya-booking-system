import dayjs from "dayjs";
import { prisma } from "../db";
import { BookingStatus } from "@prisma/client";

// ISO Week Helper
export function getYearAndWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), weekNumber: weekNo };
}

// ─── 1. FAIRNESS CALCULATOR SERVICE ──────────────────────────────────────────

export async function getOrCreateWeeklyStats(sportId: string, year: number, weekNumber: number) {
  let stats = await prisma.weeklySportStats.findUnique({
    where: { year_weekNumber_sportId: { year, weekNumber, sportId } },
  });

  if (!stats) {
    // Determine active players (e.g., users who selected/played this sport, or default)
    const sport = await prisma.sport.findUnique({ where: { id: sportId } });
    const defaultPlayers = sport?.name === "Basketball" ? 15 : 10;

    stats = await prisma.weeklySportStats.create({
      data: {
        year,
        weekNumber,
        sportId,
        bookedHours: 0,
        activePlayersCount: defaultPlayers,
        primeTimeHoursUsed: 0,
        rejectedBookingsCount: 0,
      },
    });
  }
  return stats;
}

export async function calculatePriorityScore(sportId: string, date: Date) {
  const { year, weekNumber } = getYearAndWeek(date);

  // Fetch fairness configuration
  const config = (await prisma.fairnessConfig.findFirst()) || {
    primeTimeStartHour: 17,
    primeTimeEndHour: 21,
    basketballQuotaPercent: 60.0,
    volleyballQuotaPercent: 40.0,
    playerWeightCoeff: 0.4,
    unusedHoursWeightCoeff: 0.3,
    primeTimeDisadvantageCoeff: 0.3,
  };

  const sports = await prisma.sport.findMany();
  const targetSport = sports.find((s) => s.id === sportId);
  if (!targetSport) throw new Error("Sport not found");

  const basketball = sports.find((s) => s.name === "Basketball");
  const volleyball = sports.find((s) => s.name === "Volleyball");

  if (!basketball || !volleyball) {
    return 0.5; // Fallback
  }

  // Get weekly stats
  const bbStats = await getOrCreateWeeklyStats(basketball.id, year, weekNumber);
  const vbStats = await getOrCreateWeeklyStats(volleyball.id, year, weekNumber);
  const targetStats = await getOrCreateWeeklyStats(sportId, year, weekNumber);

  // 1. Player Weight (Ratio of active players)
  const totalPlayers = Math.max(1, bbStats.activePlayersCount + vbStats.activePlayersCount);
  const playerWeight = targetStats.activePlayersCount / totalPlayers;

  // 2. Unused Hours Weight (Ratio of unused quota hours)
  // Assume a default of 84 open hours per week (12 hours/day * 7 days)
  const totalOpenHours = 84;
  const quotaPercent = targetSport.name === "Basketball" ? config.basketballQuotaPercent : config.volleyballQuotaPercent;
  const quotaHours = totalOpenHours * (quotaPercent / 100);
  const unusedHoursWeight = Math.max(0, (quotaHours - targetStats.bookedHours) / quotaHours);

  // 3. Prime Time Disadvantage
  const totalPTUsed = Math.max(1, bbStats.primeTimeHoursUsed + vbStats.primeTimeHoursUsed);
  const primeTimeDisadvantage = 1 - (targetStats.primeTimeHoursUsed / totalPTUsed);

  // Weighted sum
  const score =
    playerWeight * config.playerWeightCoeff +
    unusedHoursWeight * config.unusedHoursWeightCoeff +
    primeTimeDisadvantage * config.primeTimeDisadvantageCoeff;

  return score;
}

// ─── 2. ROTATION & PRIME TIME MANAGER ────────────────────────────────────────

export async function isPrimeTime(dateTime: Date) {
  const config = (await prisma.fairnessConfig.findFirst()) || { primeTimeStartHour: 17, primeTimeEndHour: 21 };
  const hour = dayjs(dateTime).hour();
  return hour >= config.primeTimeStartHour && hour < config.primeTimeEndHour;
}

export async function getPrimeTimePrioritySport(date: Date) {
  const { weekNumber } = getYearAndWeek(date);
  const sports = await prisma.sport.findMany();
  const basketball = sports.find((s) => s.name === "Basketball");
  const volleyball = sports.find((s) => s.name === "Volleyball");

  if (!basketball || !volleyball) return null;

  // Even Weeks: Basketball, Odd Weeks: Volleyball
  const isEvenWeek = weekNumber % 2 === 0;
  return isEvenWeek ? basketball : volleyball;
}

export async function canBookPrimeTime(sportId: string, startTime: Date) {
  const isPT = await isPrimeTime(startTime);
  if (!isPT) return { allowed: true };

  const prioritySport = await getPrimeTimePrioritySport(startTime);
  if (!prioritySport) return { allowed: true };

  if (sportId === prioritySport.id) {
    return { allowed: true };
  }

  // Non-priority sport: check the 24-hour release window
  const hoursToStart = dayjs(startTime).diff(dayjs(), "hour");
  if (hoursToStart < 24) {
    return { allowed: true, released: true };
  }

  return {
    allowed: false,
    requiresQueue: true,
    message: `This slot is in Prime Time (5 PM - 9 PM) and is currently reserved for ${prioritySport.name} (Week ${getYearAndWeek(startTime).weekNumber} Priority). Your booking will be placed in a PENDING queue and confirmed if unbooked 24 hours prior.`,
  };
}

// ─── 3. ANTI-MONOPOLY & ANTI-ABUSE SERVICE ───────────────────────────────────

export async function checkAntiMonopolyRules(
  userId: string,
  facilityId: string,
  startTime: Date,
  durationMins: number,
  buddyIds: string[]
) {
  const config = (await prisma.fairnessConfig.findFirst()) || {
    cooldownPeriodHours: 24,
    maxWeeklyReservationsPerUser: 3,
    consecutiveSlotLimit: 2,
    teamOverlapThresholdPercent: 50.0,
  };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const start = dayjs(startTime);
  const end = start.add(durationMins, "minute");

  // Rule A: Max Weekly Reservations
  const { year, weekNumber } = getYearAndWeek(startTime);
  // Find start and end of that specific week
  const startOfWeek = start.startOf("week").toDate();
  const endOfWeek = start.endOf("week").toDate();

  const weeklyCount = await prisma.booking.count({
    where: {
      userId,
      startTime: { gte: startOfWeek, lte: endOfWeek },
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.APPROVED, BookingStatus.PENDING] },
    },
  });

  if (weeklyCount >= config.maxWeeklyReservationsPerUser) {
    throw new Error(`Anti-Monopoly: You have reached your maximum weekly reservation limit of ${config.maxWeeklyReservationsPerUser} bookings.`);
  }

  // Rule B: Cooldown Period (24 hours since last booking ended)
  const lastBooking = await prisma.booking.findFirst({
    where: {
      userId,
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.APPROVED] },
      endTime: { lte: startTime },
    },
    orderBy: { endTime: "desc" },
  });

  if (lastBooking) {
    const hoursSinceLast = dayjs(startTime).diff(dayjs(lastBooking.endTime), "hour");
    if (hoursSinceLast < config.cooldownPeriodHours) {
      throw new Error(`Anti-Monopoly: You are in a ${config.cooldownPeriodHours}-hour cooldown period since your last booking which ended at ${dayjs(lastBooking.endTime).format("HH:mm DD/MM")}.`);
    }
  }

  // Rule C: Consecutive bookings & Team Overlap
  const allParticipantStudentIds = [user.studentId, ...buddyIds];

  // Fetch adjacent bookings on the same day
  const startOfDay = start.startOf("day").toDate();
  const endOfDay = start.endOf("day").toDate();

  const adjacentBookings = await prisma.booking.findMany({
    where: {
      facilityId,
      startTime: { gte: startOfDay, lte: endOfDay },
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.APPROVED] },
    },
    include: { user: true },
  });

  let consecutiveDurationMins = durationMins;

  for (const b of adjacentBookings) {
    const bStart = dayjs(b.startTime);
    const bEnd = dayjs(b.endTime);

    // Is it immediately adjacent? (Starts when requested ends, or ends when requested starts)
    const isAdjacent = bStart.isSame(end) || bEnd.isSame(start);

    if (isAdjacent) {
      // Check player overlap percentage
      let existingBuddies: string[] = [];
      try {
        existingBuddies = JSON.parse(b.buddyIds || "[]");
      } catch {}
      const existingParticipants = [b.user.studentId, ...existingBuddies];

      const intersection = allParticipantStudentIds.filter((x) => existingParticipants.includes(x));
      const minSize = Math.min(allParticipantStudentIds.length, existingParticipants.length);
      const overlapPercent = (intersection.length / Math.max(1, minSize)) * 100;

      if (overlapPercent >= config.teamOverlapThresholdPercent) {
        const diff = bEnd.diff(bStart, "minute");
        consecutiveDurationMins += diff;
      }
    }
  }

  const maxConsecutiveMins = config.consecutiveSlotLimit * 60;
  if (consecutiveDurationMins > maxConsecutiveMins) {
    throw new Error(`Anti-Monopoly: Consecutive slot booking limit reached for your team. Group overlap detected (${consecutiveDurationMins} mins total vs max ${maxConsecutiveMins} mins allowed).`);
  }

  return true;
}

// ─── 4. WEEKLY SCHEDULE GENERATOR SERVICE ────────────────────────────────────

export async function generateWeeklyScheduleTemplate(date: Date) {
  const { year, weekNumber } = getYearAndWeek(date);

  const sports = await prisma.sport.findMany();
  const basketball = sports.find((s) => s.name === "Basketball");
  const volleyball = sports.find((s) => s.name === "Volleyball");

  if (!basketball || !volleyball) {
    throw new Error("Seeded sports 'Basketball' and 'Volleyball' are required.");
  }

  // Clear existing templates/stats if needed, or initialize stats
  await getOrCreateWeeklyStats(basketball.id, year, weekNumber);
  await getOrCreateWeeklyStats(volleyball.id, year, weekNumber);

  // Find priority sport for this week
  const prioritySport = await getPrimeTimePrioritySport(date);

  // Return generated structural details
  return {
    year,
    weekNumber,
    primeTimePrioritySport: prioritySport?.name || "None",
    allocatedGuaranteedSlots: [
      { day: "Monday/Wednesday/Friday", time: "17:00 - 21:00", reservedSport: prioritySport?.name },
      { day: "Tuesday/Thursday/Saturday", time: "17:00 - 21:00", reservedSport: prioritySport?.name === "Basketball" ? "Volleyball" : "Basketball" },
      { day: "All Days", time: "09:00 - 17:00", reservedSport: "Open Shared (First-come-first-served with Fairness tie-breaking)" },
    ],
  };
}
