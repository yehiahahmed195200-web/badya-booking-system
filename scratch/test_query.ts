import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Force dotenv to load local env
const envConfig = dotenv.parse(fs.readFileSync(path.join(__dirname, '../.env')));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Attempting to query bookings with facilities...");
    const result = await prisma.bookings.findMany({
      take: 5,
      select: {
        id: true,
        facilities: true,
      }
    });
    console.log("Query completed successfully! Found:", result.length, "bookings.");
    console.log("Sample result:", JSON.stringify(result, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
  } catch (error) {
    console.error("Query failed with error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
