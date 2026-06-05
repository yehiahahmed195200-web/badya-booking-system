import { prisma } from "../db";
import { createNotification } from "./notificationService";

// PART 10: WARNINGS & BANS MANAGEMENT
async function logAdminAction(adminId: string, action: string, targetId: string, details?: string) {
  await prisma.adminLog.create({
    data: { adminId, action, targetId, details }
  });
}

export async function issueWarning(userId: string, reason: string, adminId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const newWarningsCount = user.warnings + 1;
  const systemRule = await prisma.systemRule.findFirst();
  const threshold = systemRule?.autoBanThreshold || 3;

  const isBanned = newWarningsCount >= threshold;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { 
      warnings: newWarningsCount,
      isBanned: isBanned 
    }
  });

  await logAdminAction(adminId, "ISSUE_WARNING", userId, `Reason: ${reason}. Total warnings: ${newWarningsCount}`);

  if (isBanned) {
    // Cancel all pending/confirmed bookings for the user
    await prisma.booking.updateMany({
      where: { 
        userId: userId, 
        status: { in: ["CONFIRMED", "PENDING", "APPROVED"] } 
      },
      data: { status: "CANCELLED", rejectionReason: "User Banned" }
    });

    await createNotification(userId, "Account Banned", "You have been banned for exceeding warning limit", "EMAIL");
    await logAdminAction(adminId, "AUTO_BAN", userId, `Exceeded threshold of ${threshold} warnings.`);
  } else {
    await createNotification(userId, "Warning Issued", `You have received a warning. Reason: ${reason}`, "EMAIL");
  }

  return updatedUser;
}

export async function banUser(userId: string, reason: string, adminId: string) {
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { isBanned: true }
  });

  await prisma.booking.updateMany({
    where: { 
      userId: userId, 
      status: { in: ["CONFIRMED", "PENDING", "APPROVED"] } 
    },
    data: { status: "CANCELLED", rejectionReason: "User Banned Manually" }
  });

  await createNotification(userId, "Account Banned", `You have been manually banned. Reason: ${reason}`, "EMAIL");
  await logAdminAction(adminId, "MANUAL_BAN", userId, `Reason: ${reason}`);

  return updatedUser;
}

export async function unbanUser(userId: string, adminId: string) {
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { 
      isBanned: false,
      warnings: 0
    }
  });

  await createNotification(userId, "Account Unbanned", "Your account has been unbanned. Welcome back!", "EMAIL");
  await logAdminAction(adminId, "UNBAN", userId, "Reset warnings and removed ban.");

  return updatedUser;
}

// PART 11: REWARDS MANAGEMENT (GAMIFICATION / NO CREDITS)
export async function spinLuckyWheel(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  // Get all available rewards (e.g., "Extra 10 minutes", "Free Water Bottle")
  const availableRewards = await prisma.reward.findMany();
  
  if (availableRewards.length === 0) {
    throw new Error("No rewards available in the wheel right now!");
  }

  // Check if user already spun today (basic rate limiting could be added here)
  // For now, let's just let them spin.

  // Randomly select a reward
  const randomIndex = Math.floor(Math.random() * availableRewards.length);
  const wonReward = availableRewards[randomIndex];

  // Save the won reward to the user
  const userReward = await prisma.userReward.create({
    data: {
      userId,
      rewardId: wonReward.id
    }
  });

  // Notify the user about their prize
  await createNotification(
    userId, 
    "You won a prize!", 
    `Congratulations! You spun the Lucky Wheel and won: ${wonReward.name}.`, 
    "IN_APP"
  );

  return { wonReward, userReward };
}
