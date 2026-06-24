import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Force dotenv to overwrite OS-level environment variables
const envConfig = dotenv.parse(fs.readFileSync(path.join(__dirname, '.env')));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Checking columns for users table:");
    const usersCols: any[] = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM users");
    console.log(usersCols.map(c => `${c.Field} (${c.Type})`));

    console.log("\nChecking columns for bookings table:");
    const bookingsCols: any[] = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM bookings");
    console.log(bookingsCols.map(c => `${c.Field} (${c.Type})`));

    console.log("\nChecking columns for booking_participants table:");
    const participantsCols: any[] = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM booking_participants");
    console.log(participantsCols.map(c => `${c.Field} (${c.Type})`));

    console.log("\nChecking if booking_events table exists:");
    try {
      const eventsCols: any[] = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM booking_events");
      console.log("booking_events exists with columns:", eventsCols.map(c => `${c.Field} (${c.Type})`));
    } catch (e: any) {
      console.log("booking_events does not exist or error:", e.message);
    }

  } catch (error) {
    console.error("Error inspecting database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
