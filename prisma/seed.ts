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
      closeTime: "14:00",
    },
    create: {
      id: "tennis-court",
      name: "Tennis Court",
      category: "Sport",
      openTime: "09:00",
      closeTime: "14:00",
      minParticipants: 2,
      maxParticipants: 4,
    },
  });

  await prisma.facility.upsert({
    where: { name: "Football Court" },
    update: {
      openTime: "09:00",
      closeTime: "14:00",
    },
    create: {
      id: "football-court",
      name: "Football Court",
      category: "Sport",
      openTime: "09:00",
      closeTime: "14:00",
      minParticipants: 10,
      maxParticipants: 22,
    },
  });

  await prisma.facility.upsert({
    where: { name: "Padel 1" },
    update: {
      openTime: "09:00",
      closeTime: "14:00",
    },
    create: {
      id: "padel-1",
      name: "Padel 1",
      category: "Sport",
      openTime: "09:00",
      closeTime: "14:00",
      minParticipants: 2,
      maxParticipants: 4,
    },
  });

  await prisma.facility.upsert({
    where: { name: "Padel 2" },
    update: {
      openTime: "09:00",
      closeTime: "14:00",
    },
    create: {
      id: "padel-2",
      name: "Padel 2",
      category: "Sport",
      openTime: "09:00",
      closeTime: "14:00",
      minParticipants: 2,
      maxParticipants: 4,
    },
  });

  await prisma.facility.upsert({
    where: { name: "UFC Gym" },
    update: {
      openTime: "09:00",
      closeTime: "14:00",
    },
    create: {
      id: "ufc-gym",
      name: "UFC Gym",
      category: "Fitness",
      openTime: "09:00",
      closeTime: "14:00",
      minParticipants: 1,
      maxParticipants: 30,
    },
  });

  await prisma.facility.upsert({
    where: { name: "Table Tennis 1" },
    update: {
      openTime: "09:00",
      closeTime: "14:00",
    },
    create: {
      id: "table-tennis-1",
      name: "Table Tennis 1",
      category: "Activity Center",
      openTime: "09:00",
      closeTime: "14:00",
      minParticipants: 2,
      maxParticipants: 4,
    },
  });

  await prisma.facility.upsert({
    where: { name: "Table Tennis 2" },
    update: {
      openTime: "09:00",
      closeTime: "14:00",
    },
    create: {
      id: "table-tennis-2",
      name: "Table Tennis 2",
      category: "Activity Center",
      openTime: "09:00",
      closeTime: "14:00",
      minParticipants: 2,
      maxParticipants: 4,
    },
  });

  await prisma.facility.upsert({
    where: { name: "Billiards" },
    update: {
      openTime: "09:00",
      closeTime: "14:00",
    },
    create: {
      id: "billiards",
      name: "Billiards",
      category: "Activity Center",
      openTime: "09:00",
      closeTime: "14:00",
      minParticipants: 2,
      maxParticipants: 4,
    },
  });

  await prisma.facility.upsert({
    where: { name: "Air Hockey 1" },
    update: {
      openTime: "09:00",
      closeTime: "14:00",
    },
    create: {
      id: "air-hockey-1",
      name: "Air Hockey 1",
      category: "Activity Center",
      openTime: "09:00",
      closeTime: "14:00",
      minParticipants: 2,
      maxParticipants: 4,
    },
  });

  await prisma.facility.upsert({
    where: { name: "Air Hockey 2" },
    update: {
      openTime: "09:00",
      closeTime: "14:00",
    },
    create: {
      id: "air-hockey-2",
      name: "Air Hockey 2",
      category: "Activity Center",
      openTime: "09:00",
      closeTime: "14:00",
      minParticipants: 2,
      maxParticipants: 4,
    },
  });

  // Clean up any facilities not in the list
  const allowedNames = [
    "Tennis Court", "Football Court", "Padel 1", "Padel 2", "UFC Gym",
    "Table Tennis 1", "Table Tennis 2", "Billiards", "Air Hockey 1", "Air Hockey 2"
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
