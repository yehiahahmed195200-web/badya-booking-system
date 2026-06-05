import { prisma } from "./src/db";
import { createBooking } from "./src/services/bookingService";
import { calculatePriorityScore, getOrCreateWeeklyStats, getYearAndWeek } from "./src/services/fairnessService";
import { booking_status } from "@prisma/client";
import dayjs from "dayjs";

async function runTests() {
  console.log("🧪 Starting Smart Fairness & Anti-Abuse Engine Verification Tests...\n");

  // Query test users and sports
  const user1 = await prisma.user.findFirst({ where: { studentId: "STD-001" } });
  const user2 = await prisma.user.findFirst({ where: { studentId: "STD-002" } });
  const user3 = await prisma.user.findFirst({ where: { studentId: "STD-003" } });
  const multipurposeCourt = await prisma.facility.findFirst({ where: { name: "Multipurpose Court" } });

  const sports = await prisma.sport.findMany();
  const basketball = sports.find((s) => s.name === "Basketball");
  const volleyball = sports.find((s) => s.name === "Volleyball");

  if (!user1 || !user2 || !user3 || !multipurposeCourt || !basketball || !volleyball) {
    console.error("❌ Test setup failed: Missing seeded students, court, or sports.");
    process.exit(1);
  }

  console.log(`👥 Test Students: ${user1.fullName} (${user1.studentId}), ${user2.fullName} (${user2.studentId})`);
  console.log(`🏟️ Facility: ${multipurposeCourt.name}`);
  console.log(`🏀 Basketball ID: ${basketball.id}`);
  console.log(`🏐 Volleyball ID: ${volleyball.id}\n`);

  // Clear existing bookings for Multipurpose Court to have a clean test slate
  await prisma.booking.deleteMany({
    where: { facilityId: multipurposeCourt.id },
  });
  console.log("🧹 Cleared existing bookings on the multipurpose court.");

  const now = dayjs().add(2, "day").hour(10).minute(0).second(0).millisecond(0);

  // ─── TEST 1: COOLDOWN PERIOD ENFORCEMENT ────────────────────────────────────
  console.log("\n--- TEST 1: Cooldown Period Enforcement ---");
  try {
    // Book first slot: 10:00 to 11:00 for Basketball
    console.log("Booking first slot (10:00 - 11:00)...");
    const b1 = await createBooking({
      userId: user1.id,
      facilityId: multipurposeCourt.id,
      sportId: basketball.id,
      startTime: now.toDate(),
      participants: 6,
      durationMins: 60,
      buddyIds: ["STD-002", "STD-003", "STD-004", "STD-005", "STD-006"],
    });
    console.log(`✅ First booking created successfully! ID: ${b1.id}`);

    // Try booking second slot 2 hours later (should trigger cooldown error)
    console.log("Attempting to book second slot at 12:00 (within 24h cooldown)...");
    await createBooking({
      userId: user1.id,
      facilityId: multipurposeCourt.id,
      sportId: basketball.id,
      startTime: now.add(2, "hour").toDate(),
      participants: 6,
      durationMins: 60,
      buddyIds: ["STD-002", "STD-003", "STD-004", "STD-005", "STD-006"],
    });
    console.log("❌ Test Failed: Cooldown check was bypassed!");
  } catch (e: any) {
    if (e.message.includes("Anti-Monopoly: You are in a")) {
      console.log(`✅ Test Passed: Cooldown enforcement threw expected error:\n   "${e.message}"`);
    } else {
      console.log("❌ Test Failed with unexpected error:", e.message);
    }
  }

  // ─── TEST 2: CONSECUTIVE SLOT & GROUP OVERLAP ──────────────────────────────
  console.log("\n--- TEST 2: Consecutive Slot & Group Overlap (Anti-Abuse) ---");
  // Let's adjust the consecutive limit config to 1 for this test, so Booking 1 (60m) + Booking 2 (60m) = 120m > 60m limit
  await prisma.fairnessConfig.updateMany({
    data: { consecutiveSlotLimit: 1 },
  });
  console.log("🔧 Temporarily set consecutiveSlotLimit config = 1.");

  try {
    // User 1 booked 10:00-11:00 with buddies (User 2, User 3, etc.)
    // User 2 (buddy in booking 1) tries to book 11:00-12:00 with same buddies to bypass the limit
    console.log("User 2 (from Team 1) attempts to book adjacent slot (11:00 - 12:00) with same group...");
    await createBooking({
      userId: user2.id, // User 2 is the booker
      facilityId: multipurposeCourt.id,
      sportId: basketball.id,
      startTime: now.add(1, "hour").toDate(), // 11:00 AM
      participants: 6,
      durationMins: 60,
      buddyIds: ["STD-001", "STD-003", "STD-004", "STD-005", "STD-006"], // Highly overlapping buddies!
    });
    console.log("❌ Test Failed: Consecutive team overlap check was bypassed!");
  } catch (e: any) {
    if (e.message.includes("Anti-Monopoly: Consecutive slot booking limit reached")) {
      console.log(`✅ Test Passed: Consecutive group overlap was successfully blocked:\n   "${e.message}"`);
    } else {
      console.log("❌ Test Failed with unexpected error:", e.message);
    }
  }

  // Restore consecutive limit config back to 2
  await prisma.fairnessConfig.updateMany({
    data: { consecutiveSlotLimit: 2 },
  });

  // ─── TEST 3: WEEKLY RESERVATION LIMIT ──────────────────────────────────────
  console.log("\n--- TEST 3: Weekly Reservation Limit ---");
  // Let's adjust the config weekly limit to 1 for this test, and verify booking fails
  await prisma.fairnessConfig.updateMany({
    data: { maxWeeklyReservationsPerUser: 1 },
  });
  console.log("🔧 Temporarily set maxWeeklyReservationsPerUser config = 1.");

  try {
    console.log("Attempting to book a second slot in the same week for User 1...");
    await createBooking({
      userId: user1.id,
      facilityId: multipurposeCourt.id,
      sportId: basketball.id,
      startTime: now.add(3, "day").toDate(),
      participants: 6,
      durationMins: 60,
      buddyIds: ["STD-002", "STD-003", "STD-004", "STD-005", "STD-006"],
    });
    console.log("❌ Test Failed: Weekly reservation quota check was bypassed!");
  } catch (e: any) {
    if (e.message.includes("Anti-Monopoly: You have reached your maximum weekly")) {
      console.log(`✅ Test Passed: Weekly quota was successfully enforced:\n   "${e.message}"`);
    } else {
      console.log("❌ Test Failed with unexpected error:", e.message);
    }
  }

  // Restore weekly limit config back to 3
  await prisma.fairnessConfig.updateMany({
    data: { maxWeeklyReservationsPerUser: 3 },
  });

  // ─── TEST 4: AUTOMATED CONFLICT & PRIORITY SCORE RESOLUTION ─────────────────
  console.log("\n--- TEST 4: Automated Conflict & Priority Score Resolution ---");

  // Clear bookings for a clean conflict test
  await prisma.booking.deleteMany({
    where: { facilityId: multipurposeCourt.id },
  });

  // Create an initial Volleyball booking for tomorrow at 14:00 (Open slot)
  const tomorrowSlot = dayjs().add(1, "day").hour(14).minute(0).second(0).millisecond(0);

  console.log("Creating initial Volleyball booking for tomorrow 14:00...");
  const vbBooking = await createBooking({
    userId: user2.id,
    facilityId: multipurposeCourt.id,
    sportId: volleyball.id,
    startTime: tomorrowSlot.toDate(),
    participants: 6,
    durationMins: 60,
    buddyIds: ["STD-001", "STD-003", "STD-004", "STD-005", "STD-006"],
  });
  console.log(`✅ Volleyball booking confirmed! ID: ${vbBooking.id}`);

  // Modify Weekly Statistics so Basketball has a HIGHER priority score (Basketball is under-served)
  const { year, weekNumber } = getYearAndWeek(tomorrowSlot.toDate());
  const bbStats = await getOrCreateWeeklyStats(basketball.id, year, weekNumber);
  const vbStats = await getOrCreateWeeklyStats(volleyball.id, year, weekNumber);

  // Set Volleyball booked hours to be very high (highly served) and Basketball to be 0
  await prisma.weeklySportStats.update({
    where: { id: vbStats.id },
    data: { bookedHours: 60.0, primeTimeHoursUsed: 20.0, activePlayersCount: 10 },
  });
  await prisma.weeklySportStats.update({
    where: { id: bbStats.id },
    data: { bookedHours: 1.0, primeTimeHoursUsed: 0.0, activePlayersCount: 20 },
  });

  const bbScore = await calculatePriorityScore(basketball.id, tomorrowSlot.toDate());
  const vbScore = await calculatePriorityScore(volleyball.id, tomorrowSlot.toDate());
  console.log(`📊 Calculated Fairness Priority Scores for slot week:`);
  console.log(`   🏀 Basketball Score: ${bbScore.toFixed(2)} (Highly under-served, higher score)`);
  console.log(`   🏐 Volleyball Score: ${vbScore.toFixed(2)}`);

  // Now User 3 requests a Basketball booking for the EXACT same slot (tomorrow 14:00)
  console.log("User 3 requests Basketball booking for same slot tomorrow 14:00...");
  const bbBooking = await createBooking({
    userId: user3.id,
    facilityId: multipurposeCourt.id,
    sportId: basketball.id,
    startTime: tomorrowSlot.toDate(),
    participants: 6,
    durationMins: 60,
    buddyIds: ["STD-001", "STD-002", "STD-004", "STD-005", "STD-006"],
  });

  console.log(`✅ Basketball Booking Status: ${bbBooking.status} (ID: ${bbBooking.id})`);

  // Verify that Volleyball booking was cancelled automatically
  const checkVb = await prisma.booking.findUnique({ where: { id: vbBooking.id } });
  console.log(`🏐 Conflicting Volleyball Booking Status: ${checkVb?.status}`);
  console.log(`   Rejection Reason: "${checkVb?.rejectionReason}"`);

  if (checkVb?.status === booking_status.CANCELLED && bbBooking.status === booking_status.CONFIRMED) {
    console.log("✅ Test Passed: Automated priority-based conflict resolution succeeded flawlessly!");
  } else {
    console.log("❌ Test Failed: Overlap did not resolve correctly.");
  }

  // Restore stats to normal
  await prisma.weeklySportStats.update({
    where: { id: vbStats.id },
    data: { bookedHours: 0, primeTimeHoursUsed: 0, activePlayersCount: 10 },
  });
  await prisma.weeklySportStats.update({
    where: { id: bbStats.id },
    data: { bookedHours: 0, primeTimeHoursUsed: 0, activePlayersCount: 15 },
  });

  console.log("\n🌟 All Fairness Engine Integration Tests completed successfully!");
}

runTests()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Test crashed with error:", e);
    await prisma.$disconnect();
  });
