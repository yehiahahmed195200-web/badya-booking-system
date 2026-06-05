import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

// Load local .env and allow it to override system env vars in development
dotenv.config({ override: true });
// Debug: show which protocol is being used (mysql, postgresql, etc.)
console.log("[db] MYSQL_DATABASE_URL protocol:", process.env.MYSQL_DATABASE_URL ? process.env.MYSQL_DATABASE_URL.split(":")[0] : "(not set)");

export const prisma = new PrismaClient();
