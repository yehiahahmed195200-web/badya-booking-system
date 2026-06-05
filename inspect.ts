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
    console.log("Fetching all users from the users table...");
    const allUsers = await prisma.users.findMany();
    console.log("Users in database:");
    allUsers.forEach(u => {
      console.log(`ID: ${u.id}, Name: ${u.full_name}, Email: ${u.email}, Role: ${u.role}, StudentID: ${u.student_id}, DeviceID: ${u.device_id}, PendingDeviceID: ${u.pending_device_id}, DeviceChangeStatus: ${u.device_change_status}`);
    });
  } catch (error) {
    console.error("Error fetching users:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
