import { RestrictionType } from "@prisma/client";
import { prisma } from "../db";
import { RuleError } from "../utils/errors";

export async function getActiveRestrictions(userId: string) {
  const now = new Date();
  return prisma.userRestriction.findMany({
    where: {
      userId,
      OR: [{ endAt: null }, { endAt: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function refreshUserBanStatus(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  if (user.isBanned && user.banExpiresAt && user.banExpiresAt <= new Date()) {
    await prisma.user.update({
      where: { id: userId },
      data: { isBanned: false, banExpiresAt: null, banReason: null },
    });
  }

  return user;
}

export async function assertUserCanBook(userId: string) {
  await refreshUserBanStatus(userId);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new RuleError("USER_NOT_FOUND", "User not found", 404);

  if (user.isBanned) {
    throw new RuleError("USER_BANNED", "User is banned from booking", 403);
  }

  const restrictions = await getActiveRestrictions(userId);
  const blocking = restrictions.find((r) => r.type === RestrictionType.BAN || r.type === RestrictionType.SUSPENSION);

  if (blocking) {
    throw new RuleError("USER_RESTRICTED", "User is restricted from booking", 403);
  }
}

export async function assertUserCanAccess(userId: string) {
  await refreshUserBanStatus(userId);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new RuleError("USER_NOT_FOUND", "User not found", 404);

  if (user.isBanned) {
    throw new RuleError("USER_BANNED", "User is banned from access", 403);
  }

  const restrictions = await getActiveRestrictions(userId);
  const blocking = restrictions.find((r) => r.type === RestrictionType.BAN || r.type === RestrictionType.SUSPENSION);

  if (blocking) {
    throw new RuleError("USER_RESTRICTED", "User is restricted from access", 403);
  }
}
