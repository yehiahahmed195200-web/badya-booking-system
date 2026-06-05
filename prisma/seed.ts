import dotenv from "dotenv";
dotenv.config({ override: true });
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.facility.upsert({
    where: { name: "Tennis Court A" },
    update: {},
    create: {
      id: "tennis-court-a",
      name: "Tennis Court A",
      category: "Sport",
      openTime: "08:00",
      closeTime: "15:00",
      minParticipants: 2,
      maxParticipants: 4,
    },
  });

  await prisma.facility.upsert({
    where: { name: "Basketball Court" },
    update: {},
    create: {
      id: "basketball-court",
      name: "Basketball Court",
      category: "Sport",
      openTime: "08:00",
      closeTime: "15:00",
      minParticipants: 6,
      maxParticipants: 12,
    },
  });

  await prisma.facility.upsert({
    where: { name: "Gym Main Hall" },
    update: {},
    create: {
      id: "gym-main-hall",
      name: "Gym Main Hall",
      category: "Fitness",
      openTime: "08:00",
      closeTime: "15:00",
      minParticipants: 1,
      maxParticipants: 30,
    },
  });

  const tennisFacility = await prisma.facility.findUnique({ where: { name: "Tennis Court A" } });
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
