import { prisma } from "../src/db";
import { joinQueue, getQueueStatus } from "../src/services/matchmakingService";
import { booking_status } from "@prisma/client";
import dayjs from "dayjs";

async function runTest() {
  console.log("🚀 Starting Matchmaking & Team Balancing Verification Test...");

  // 1. Setup Basketball Sport & Court Facility
  console.log("Setting up sport and facility...");
  const sport = await prisma.sport.upsert({
    where: { name: "Basketball" },
    update: { minParticipants: 6, maxParticipants: 12, idealParticipants: 10 },
    create: {
      id: "basketball-sport-test",
      name: "Basketball",
      icon: "🏀",
      minParticipants: 6,
      maxParticipants: 12,
      idealParticipants: 10,
    },
  });

  const facility = await prisma.facility.upsert({
    where: { name: "Basketball Court" },
    update: { sportId: sport.id, status: "OPEN", isActive: true },
    create: {
      id: "basketball-court-test",
      name: "Basketball Court",
      category: "Main Sports",
      sportId: sport.id,
      openTime: "08:00",
      closeTime: "15:00",
      minParticipants: 6,
      maxParticipants: 12,
      defaultSlotMins: 60,
      isActive: true,
      status: "OPEN",
    },
  });

  // 2. Define 13 test users with specific skill levels
  // We want to test: five 3s (Advanced) and three 1s (Beginner) + other skill levels
  const testUserData = [
    { id: "test-user-1", email: "test1@badya.edu", studentId: "TSTD-001", skillLevel: "Advanced", fullName: "Adv Player 1" },
    { id: "test-user-2", email: "test2@badya.edu", studentId: "TSTD-002", skillLevel: "Advanced", fullName: "Adv Player 2" },
    { id: "test-user-3", email: "test3@badya.edu", studentId: "TSTD-003", skillLevel: "Advanced", fullName: "Adv Player 3" },
    { id: "test-user-4", email: "test4@badya.edu", studentId: "TSTD-004", skillLevel: "Advanced", fullName: "Adv Player 4" },
    { id: "test-user-5", email: "test5@badya.edu", studentId: "TSTD-005", skillLevel: "Advanced", fullName: "Adv Player 5" },
    { id: "test-user-6", email: "test6@badya.edu", studentId: "TSTD-006", skillLevel: "Beginner", fullName: "Beg Player 1" },
    { id: "test-user-7", email: "test7@badya.edu", studentId: "TSTD-007", skillLevel: "Beginner", fullName: "Beg Player 2" },
    { id: "test-user-8", email: "test8@badya.edu", studentId: "TSTD-008", skillLevel: "Beginner", fullName: "Beg Player 3" },
    { id: "test-user-9", email: "test9@badya.edu", studentId: "TSTD-009", skillLevel: "Intermediate", fullName: "Int Player 1" },
    { id: "test-user-10", email: "test10@badya.edu", studentId: "TSTD-010", skillLevel: "Intermediate", fullName: "Int Player 2" },
    { id: "test-user-11", email: "test11@badya.edu", studentId: "TSTD-011", skillLevel: "Beginner", fullName: "Beg Player 4" },
    { id: "test-user-12", email: "test12@badya.edu", studentId: "TSTD-012", skillLevel: "Intermediate", fullName: "Int Player 3" },
    { id: "test-user-13", email: "test13@badya.edu", studentId: "TSTD-013", skillLevel: "Intermediate", fullName: "Int Player 4" },
  ];

  console.log("Upserting test users in DB...");
  for (const u of testUserData) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { skillLevel: u.skillLevel },
      create: {
        id: u.id,
        email: u.email,
        studentId: u.studentId,
        fullName: u.fullName,
        passwordHash: "dummyhash",
        barcode: `TBAR-${u.id}`,
        skillLevel: u.skillLevel,
      },
    });
  }

  // 3. Define target slot date (tomorrow) and time slot
  const testDate = dayjs().add(1, "day").format("YYYY-MM-DD");
  const testSlot = "10:00";
  console.log(`Targeting slot: ${testDate} @ ${testSlot}`);

  // Clear any existing queues for this test slot first to avoid pollution
  await prisma.matchmakingQueue.deleteMany({
    where: { sportId: sport.id, facilityId: facility.id, date: testDate, timeSlot: testSlot }
  });

  // 4. Simulate users joining one-by-one
  console.log("Simulating 13 users joining the queue...");
  for (let i = 0; i < testUserData.length; i++) {
    const user = testUserData[i];
    console.log(`[Join] User ${i + 1}/13: ${user.fullName} (${user.skillLevel}) joining...`);
    const res = await joinQueue(user.id, sport.id, facility.id, testDate, testSlot);
    
    // Check queue count after each join
    const status = await getQueueStatus(sport.id, facility.id, testDate, testSlot);
    console.log(`Current Queue Size: ${status.count} / ${status.ideal}`);
  }

  // Wait a small moment to ensure async processQueue completes
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // 5. Verification checks
  console.log("\n--- VERIFICATION CHECKS ---");

  // Check waitlist
  const queueAfterMatching = await prisma.matchmakingQueue.findMany({
    where: { sportId: sport.id, facilityId: facility.id, date: testDate, timeSlot: testSlot },
    include: { user: true }
  });
  console.log(`Queue size after matchmaking runs: ${queueAfterMatching.length}`);
  console.log("Users left on waitlist (original queue timestamp preserved):");
  for (const q of queueAfterMatching) {
    console.log(` - ${q.user.fullName} (${q.user.skillLevel}) joined at ${q.createdAt.toISOString()}`);
  }

  // Check created bookings
  const startDateTime = dayjs(`${testDate}T${testSlot}`).toDate();
  const createdBooking = await prisma.booking.findFirst({
    where: {
      facilityId: facility.id,
      sportId: sport.id,
      startTime: startDateTime,
      status: booking_status.CONFIRMED,
    },
    include: {
      bookingParticipants: {
        include: {
          user: true
        }
      }
    }
  }) as any;

  if (!createdBooking) {
    throw new Error("❌ Matchmaking failed: No booking was created for this slot!");
  }

  console.log(`\n✅ Matchmaking booking created successfully! Booking ID: ${createdBooking.id}`);
  console.log(`Number of matched participants: ${createdBooking.bookingParticipants.length}`);

  // Check Team Balancing output
  const teamA = createdBooking.bookingParticipants.filter((p: any) => p.team === "A");
  const teamB = createdBooking.bookingParticipants.filter((p: any) => p.team === "B");

  const skillWeights: Record<string, number> = { Advanced: 3, Intermediate: 2, Beginner: 1 };
  const getSum = (team: any[]) => team.reduce((sum: number, p: any) => sum + (skillWeights[p.user.skillLevel] ?? 2), 0);

  const sumA = getSum(teamA);
  const sumB = getSum(teamB);

  console.log("\n📊 Team A (اليمين) composition:");
  teamA.forEach((p: any) => console.log(` - ${p.user.fullName} [Skill: ${p.user.skillLevel} = ${skillWeights[p.user.skillLevel]}]`));
  console.log(`Team A Total Skill Score: ${sumA}`);

  console.log("\n📊 Team B (اليسار) composition:");
  teamB.forEach((p: any) => console.log(` - ${p.user.fullName} [Skill: ${p.user.skillLevel} = ${skillWeights[p.user.skillLevel]}]`));
  console.log(`Team B Total Skill Score: ${sumB}`);

  console.log(`\n⚖️ Team Size Difference: ${Math.abs(teamA.length - teamB.length)} (Expected: 0)`);
  console.log(`⚖️ Skill Score Difference: ${Math.abs(sumA - sumB)}`);

  if (teamA.length !== teamB.length) {
    console.log("❌ Test failed: Team sizes are not equal!");
  } else if (Math.abs(sumA - sumB) > 2) {
    console.log("❌ Test failed: Skill difference is too high!");
  } else {
    console.log("🎉 Test passed: Matchmaking created perfect, balanced teams of equal size and optimized skill weights!");
  }

  // 6. Cleanup test records
  console.log("\nCleaning up test records from database...");
  await prisma.bookingParticipant.deleteMany({
    where: { bookingId: createdBooking.id }
  });
  await prisma.booking.delete({
    where: { id: createdBooking.id }
  });
  await prisma.matchmakingQueue.deleteMany({
    where: { sportId: sport.id, facilityId: facility.id, date: testDate, timeSlot: testSlot }
  });
  
  console.log("Done.");
}

runTest()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Test error:", err);
    process.exit(1);
  });
