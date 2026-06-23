import dotenv from "dotenv";
dotenv.config({ override: true });
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.facility.upsert({
    where: { name: "Tennis Court" },
    update: {
      openTime: "09:00",
      closeTime: "15:00",
    },
    create: {
      id: "tennis-court",
      name: "Tennis Court",
      category: "Sport",
      openTime: "09:00",
      closeTime: "15:00",
      minParticipants: 2,
      maxParticipants: 4,
    },
  });

  await prisma.facility.upsert({
    where: { name: "Football Court" },
    update: {
      openTime: "09:00",
      closeTime: "15:00",
    },
    create: {
      id: "football-court",
      name: "Football Court",
      category: "Sport",
      openTime: "09:00",
      closeTime: "15:00",
      minParticipants: 10,
      maxParticipants: 22,
    },
  });

  await prisma.facility.upsert({
    where: { name: "Padel 1" },
    update: {
      openTime: "09:00",
      closeTime: "15:00",
    },
    create: {
      id: "padel-1",
      name: "Padel 1",
      category: "Sport",
      openTime: "09:00",
      closeTime: "15:00",
      minParticipants: 2,
      maxParticipants: 4,
    },
  });

  await prisma.facility.upsert({
    where: { name: "Padel 2" },
    update: {
      openTime: "09:00",
      closeTime: "15:00",
    },
    create: {
      id: "padel-2",
      name: "Padel 2",
      category: "Sport",
      openTime: "09:00",
      closeTime: "15:00",
      minParticipants: 2,
      maxParticipants: 4,
    },
  });

  await prisma.facility.upsert({
    where: { name: "UFC Gym" },
    update: {
      openTime: "09:00",
      closeTime: "15:00",
    },
    create: {
      id: "ufc-gym",
      name: "UFC Gym",
      category: "Fitness",
      openTime: "09:00",
      closeTime: "15:00",
      minParticipants: 1,
      maxParticipants: 30,
    },
  });

  // Seed Sports first
  const sportsData = [
    { id: "sport-football", name: "Football", icon: "⚽", description: "Outdoor Football Match" },
    { id: "sport-tennis", name: "Tennis", icon: "🎾", description: "Tennis Court" },
    { id: "sport-padel", name: "Padel", icon: "🎾", description: "Padel Tennis Court" },
    { id: "sport-table-tennis", name: "Table Tennis", icon: "🏓", description: "Indoor Ping Pong" },
    { id: "sport-billiards", name: "Billiards", icon: "🎱", description: "Billiards / Pool Table" },
    { id: "sport-air-hockey", name: "Air Hockey", icon: "🏒", description: "Air Hockey Game" },
    { id: "sport-fitness", name: "Fitness", icon: "🏋️", description: "Gym / Workout" },
  ];

  for (const s of sportsData) {
    await prisma.sport.upsert({
      where: { name: s.name },
      update: { icon: s.icon, description: s.description },
      create: s,
    });
  }

  // Seed Activity Center facility
  await prisma.facility.upsert({
    where: { name: "Activity Center" },
    update: {
      openTime: "09:00",
      closeTime: "15:00",
      sports: "Table Tennis, Billiards, Air Hockey",
    },
    create: {
      id: "activity-center",
      name: "Activity Center",
      category: "Activity Center",
      openTime: "09:00",
      closeTime: "15:00",
      minParticipants: 2,
      maxParticipants: 4,
      sports: "Table Tennis, Billiards, Air Hockey",
    },
  });

  // Clean up any facilities not in the list
  const allowedNames = [
    "Tennis Court", "Football Court", "Padel 1", "Padel 2", "UFC Gym", "Activity Center"
  ];
  const allFacs = await prisma.facility.findMany();
  for (const f of allFacs) {
    if (!allowedNames.includes(f.name)) {
      await prisma.booking.deleteMany({ where: { facilityId: f.id } });
      await prisma.facility.delete({ where: { id: f.id } });
    }
  }

  const tennisFacility = await prisma.facility.findUnique({ where: { name: "Tennis Court" } });
  const adminHash = await bcrypt.hash("Admin@123", 10);
  const coachHash = await bcrypt.hash("Coach@123", 10);
  const studentHash = await bcrypt.hash("Student@123", 10);

  await prisma.user.upsert({
    where: { email: "admin@badya.edu" },
    update: {},
    create: {
      id: "admin-001",
      studentId: "ADMIN-001",
      fullName: "System Admin",
      email: "admin@badya.edu",
      barcode: "ADM001",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "coach.kareem@badya.edu" },
    update: { managedFacilityId: tennisFacility?.id },
    create: {
      id: "coach-001",
      studentId: "COACH-001",
      fullName: "Coach Kareem",
      email: "coach.kareem@badya.edu",
      barcode: "COA001",
      passwordHash: coachHash,
      role: "COACH",
      managedFacilityId: tennisFacility?.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "student1@badya.edu" },
    update: {},
    create: {
      id: "student-001",
      studentId: "STD-001",
      fullName: "Student One",
      email: "student1@badya.edu",
      barcode: "STD001",
      passwordHash: studentHash,
      role: "STUDENT",
    },
  });
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
