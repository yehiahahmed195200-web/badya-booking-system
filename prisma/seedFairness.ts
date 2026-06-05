import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Fairness & Sports Seeding...");

  // 1. Seed Sports
  const basketball = await prisma.sport.upsert({
    where: { name: "Basketball" },
    update: {},
    create: {
      name: "Basketball",
      icon: "🏀",
      description: "Fast-paced game played on a court.",
      minParticipants: 6,
      maxParticipants: 12,
      durationOptions: "30,60,90",
    },
  });
  console.log(`🏀 Seeded Sport: ${basketball.name} (${basketball.id})`);

  const volleyball = await prisma.sport.upsert({
    where: { name: "Volleyball" },
    update: {},
    create: {
      name: "Volleyball",
      icon: "🏐",
      description: "Team sport played over a high net.",
      minParticipants: 6,
      maxParticipants: 12,
      durationOptions: "30,60,90",
    },
  });
  console.log(`🏐 Seeded Sport: ${volleyball.name} (${volleyball.id})`);

  // 2. Seed Shared Multipurpose Court
  // We make it a shared court by not assigning a specific single sportId,
  // allowing both sports to be booked on it.
  const multipurposeCourt = await prisma.facility.upsert({
    where: { name: "Multipurpose Court" },
    update: {},
    create: {
      name: "Multipurpose Court",
      category: "Main Sports",
      openTime: "08:00",
      closeTime: "15:00",
      minParticipants: 6,
      maxParticipants: 20,
      defaultSlotMins: 60,
      isActive: true,
      status: "OPEN",
    },
  });
  console.log(`🏟️ Seeded Shared Facility: ${multipurposeCourt.name} (${multipurposeCourt.id})`);

  // Also update existing "Basketball Court" and "Volleyball Court" just in case
  await prisma.facility.upsert({
    where: { name: "Basketball Court" },
    update: { sportId: basketball.id },
    create: {
      name: "Basketball Court",
      category: "Main Sports",
      sportId: basketball.id,
      openTime: "08:00",
      closeTime: "15:00",
      minParticipants: 6,
      maxParticipants: 10,
      defaultSlotMins: 60,
      isActive: true,
      status: "OPEN",
    },
  });

  await prisma.facility.upsert({
    where: { name: "Volleyball Court" },
    update: { sportId: volleyball.id },
    create: {
      name: "Volleyball Court",
      category: "Main Sports",
      sportId: volleyball.id,
      openTime: "08:00",
      closeTime: "15:00",
      minParticipants: 10,
      maxParticipants: 15,
      defaultSlotMins: 60,
      isActive: true,
      status: "OPEN",
    },
  });

  // 3. Seed Fairness Configurations
  const fairnessConfig = await prisma.fairnessConfig.findFirst();
  if (!fairnessConfig) {
    const newConfig = await prisma.fairnessConfig.create({
      data: {
        primeTimeStartHour: 17, // 5 PM
        primeTimeEndHour: 21,   // 9 PM
        basketballQuotaPercent: 60.0,
        volleyballQuotaPercent: 40.0,
        cooldownPeriodHours: 24,
        maxWeeklyReservationsPerUser: 3,
        consecutiveSlotLimit: 2,
        teamOverlapThresholdPercent: 50.0,
        playerWeightCoeff: 0.4,
        unusedHoursWeightCoeff: 0.3,
        primeTimeDisadvantageCoeff: 0.3,
      },
    });
    console.log(`⚙️ Created default FairnessConfig:`, newConfig);
  } else {
    console.log("⚙️ FairnessConfig already exists, skipping creation.");
  }

  // 4. Seed initial Weekly Stats for current week if needed
  const now = new Date();
  const year = now.getFullYear();
  
  // Simple ISO week calculator
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  await prisma.weeklySportStats.upsert({
    where: { year_weekNumber_sportId: { year, weekNumber, sportId: basketball.id } },
    update: {},
    create: {
      year,
      weekNumber,
      sportId: basketball.id,
      bookedHours: 0,
      activePlayersCount: 15, // Let's seed 15 active players for basketball
      primeTimeHoursUsed: 0,
      rejectedBookingsCount: 0,
    },
  });

  await prisma.weeklySportStats.upsert({
    where: { year_weekNumber_sportId: { year, weekNumber, sportId: volleyball.id } },
    update: {},
    create: {
      year,
      weekNumber,
      sportId: volleyball.id,
      bookedHours: 0,
      activePlayersCount: 10, // Let's seed 10 active players for volleyball
      primeTimeHoursUsed: 0,
      rejectedBookingsCount: 0,
    },
  });
  console.log(`📊 Seeded initial WeeklySportStats for Week ${weekNumber}, Year ${year}`);

  console.log("✨ Seeding completed successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
