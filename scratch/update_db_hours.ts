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
    console.log("Updating existing facilities/facility records in the database...");
    
    // Update facilities (plural model)
    const facilitiesCount = await prisma.facilities.updateMany({
      data: {
        open_time: "08:00",
        close_time: "15:00",
        openTime: "08:00",
        closeTime: "15:00",
      }
    });
    console.log(`Updated ${facilitiesCount.count} records in 'facilities' table.`);

    // Update facility (singular model)
    const facilityCount = await prisma.facility.updateMany({
      data: {
        openTime: "08:00",
        closeTime: "15:00",
      }
    });
    console.log(`Updated ${facilityCount.count} records in 'facility' table.`);
    
    console.log("Database hours updated successfully!");
  } catch (error) {
    console.error("Database update failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
