import { UserRole } from "@prisma/client";
import { prisma } from "../db";

export const NotificationChannel = {
  EMAIL: "EMAIL",
  APP: "APP",
  SMS: "SMS",
  PUSH: "PUSH",
  WEBHOOK: "WEBHOOK",
} as const;

export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationPriority = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;

export type NotificationPriority = (typeof NotificationPriority)[keyof typeof NotificationPriority];

export const NotificationStatus = {
  QUEUED: "QUEUED",
  PROCESSING: "PROCESSING",
  SENT: "SENT",
  FAILED: "FAILED",
  ARCHIVED: "ARCHIVED",
} as const;

export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

export const NotificationType = {
  SYSTEM: "SYSTEM",
  BOOKING: "BOOKING",
  ATTENDANCE: "ATTENDANCE",
  SECURITY: "SECURITY",
  ACCOUNT: "ACCOUNT",
  REWARD: "REWARD",
} as const;

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

type LegacyChannel = "EMAIL" | "APP" | "IN_APP" | "SMS" | "PUSH" | "WEBHOOK";

type CreateNotificationInput = {
  userId: string;
  title: string;
  message: string;
  channel?: NotificationChannel | LegacyChannel;
  type?: NotificationType;
  priority?: NotificationPriority;
  actionUrl?: string;
  payload?: unknown;
  dedupeKey?: string;
  maxAttempts?: number;
  expiresAt?: Date;
};

type GetUserNotificationsOptions = {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
  status?: NotificationStatus;
  channel?: NotificationChannel;
};

type UpdateNotificationPreferencesInput = {
  appEnabled?: boolean;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  pushEnabled?: boolean;
  bookingEnabled?: boolean;
  attendanceEnabled?: boolean;
  securityEnabled?: boolean;
  accountEnabled?: boolean;
  rewardEnabled?: boolean;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
  timezone?: string | null;
};

const channelAliases: Record<string, NotificationChannel> = {
  EMAIL: NotificationChannel.EMAIL,
  APP: NotificationChannel.APP,
  IN_APP: NotificationChannel.APP,
  SMS: NotificationChannel.SMS,
  PUSH: NotificationChannel.PUSH,
  WEBHOOK: NotificationChannel.WEBHOOK,
};

let notificationWorkerStarted = false;
let notificationWorkerTimer: NodeJS.Timeout | null = null;
let notificationCleanupTimer: NodeJS.Timeout | null = null;

function normalizeChannel(channel?: string): NotificationChannel {
  if (!channel) {
    return NotificationChannel.EMAIL;
  }

  return channelAliases[channel.toUpperCase()] ?? NotificationChannel.EMAIL;
}

function isTypeEnabled(
  pref: {
    bookingEnabled: boolean;
    attendanceEnabled: boolean;
    securityEnabled: boolean;
    accountEnabled: boolean;
    rewardEnabled: boolean;
  },
  type: NotificationType
) {
  switch (type) {
    case NotificationType.BOOKING:
      return pref.bookingEnabled;
    case NotificationType.ATTENDANCE:
      return pref.attendanceEnabled;
    case NotificationType.SECURITY:
      return pref.securityEnabled;
    case NotificationType.ACCOUNT:
      return pref.accountEnabled;
    case NotificationType.REWARD:
      return pref.rewardEnabled;
    default:
      return true;
  }
}

function isChannelEnabled(
  pref: { appEnabled: boolean; emailEnabled: boolean; smsEnabled: boolean; pushEnabled: boolean },
  channel: NotificationChannel
) {
  switch (channel) {
    case NotificationChannel.APP:
      return pref.appEnabled;
    case NotificationChannel.EMAIL:
      return pref.emailEnabled;
    case NotificationChannel.SMS:
      return pref.smsEnabled;
    case NotificationChannel.PUSH:
      return pref.pushEnabled;
    case NotificationChannel.WEBHOOK:
      return true;
    default:
      return true;
  }
}

function getNextRetryDate(attemptNumber: number) {
  const delayMins = Math.min(60, Math.pow(2, Math.max(0, attemptNumber - 1)));
  return new Date(Date.now() + delayMins * 60 * 1000);
}

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  channel?: NotificationChannel | LegacyChannel
): Promise<Awaited<ReturnType<typeof prisma.notification.create>>>;
export async function createNotification(input: CreateNotificationInput): Promise<Awaited<ReturnType<typeof prisma.notification.create>>>;
export async function createNotification(
  arg1: string | CreateNotificationInput,
  title?: string,
  message?: string,
  channel?: NotificationChannel | LegacyChannel
) {
  const payload: CreateNotificationInput =
    typeof arg1 === "string"
      ? {
          userId: arg1,
          title: title ?? "Notification",
          message: message ?? "",
          channel,
        }
      : arg1;

  const normalizedChannel = normalizeChannel(payload.channel);
  const notificationType = payload.type ?? NotificationType.SYSTEM;
  const notificationPriority = payload.priority ?? NotificationPriority.NORMAL;

  const pref = await getNotificationPreferences(payload.userId);
  const isAllowed = isChannelEnabled(pref, normalizedChannel) && isTypeEnabled(pref, notificationType);

  return prisma.notification.create({
    data: {
      userId: payload.userId,
      title: payload.title,
      message: payload.message,
      channel: normalizedChannel,
      type: notificationType,
      priority: notificationPriority,
      status: isAllowed ? NotificationStatus.QUEUED : NotificationStatus.ARCHIVED,
      failureReason: isAllowed ? null : "BLOCKED_BY_USER_PREFERENCES",
      actionUrl: payload.actionUrl,
      payload: payload.payload as object | undefined,
      dedupeKey: payload.dedupeKey,
      maxAttempts: payload.maxAttempts ?? 3,
      expiresAt: payload.expiresAt,
    },
  });
}

export async function createBulkNotifications(items: CreateNotificationInput[]) {
  const created = await Promise.all(items.map((item) => createNotification(item)));
  return {
    total: items.length,
    queued: created.filter((n) => n.status === NotificationStatus.QUEUED).length,
    archived: created.filter((n) => n.status === NotificationStatus.ARCHIVED).length,
    notifications: created,
  };
}

export async function getUserNotifications(userId: string, options: GetUserNotificationsOptions = {}) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));

  const where = {
    userId,
    read: options.unreadOnly ? false : undefined,
    status: options.status,
    channel: options.channel,
  };

  const [total, items] = await prisma.$transaction([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    items,
  };
}

export async function getUnreadCount(userId: string) {
  const unreadCount = await prisma.notification.count({
    where: {
      userId,
      read: false,
      status: { not: NotificationStatus.ARCHIVED },
    },
  });

  return { unreadCount };
}

export async function markAsRead(notificationId: string) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { read: true, readAt: new Date() }
  });
}

export async function markAllAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() },
  });

  return { updated: result.count };
}

export async function archiveNotification(notificationId: string, userId: string) {
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("Notification not found");
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: NotificationStatus.ARCHIVED,
      failureReason: "ARCHIVED_BY_USER",
    },
  });
}

export async function getNotificationPreferences(userId: string) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function updateNotificationPreferences(userId: string, input: UpdateNotificationPreferencesInput) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: {
      userId,
      ...input,
    },
    update: {
      ...input,
    },
  });
}

type DeliveryResult = {
  ok: boolean;
  provider?: string;
  providerId?: string;
  errorCode?: string;
  errorMessage?: string;
};

async function deliverNotification(notification: {
  id: string;
  userId: string;
  channel: NotificationChannel;
  title: string;
  message: string;
}) : Promise<DeliveryResult> {
  const providerId = `ntf_${notification.id}_${Date.now()}`;

  if (notification.channel === NotificationChannel.APP) {
    return { ok: true, provider: "internal-app", providerId };
  }

  if (notification.channel === NotificationChannel.EMAIL) {
    // Placeholder integration point for SMTP/SES/SendGrid providers.
    return { ok: true, provider: "email-log", providerId };
  }

  if (notification.channel === NotificationChannel.SMS) {
    const smsEnabled = String(process.env.NOTIFICATION_SMS_ENABLED ?? "false") === "true";
    if (!smsEnabled) {
      return { ok: false, errorCode: "SMS_NOT_CONFIGURED", errorMessage: "SMS provider is not configured." };
    }

    return { ok: true, provider: "sms-provider", providerId };
  }

  if (notification.channel === NotificationChannel.PUSH) {
    const pushEnabled = String(process.env.NOTIFICATION_PUSH_ENABLED ?? "false") === "true";
    if (!pushEnabled) {
      return { ok: false, errorCode: "PUSH_NOT_CONFIGURED", errorMessage: "Push provider is not configured." };
    }

    return { ok: true, provider: "push-provider", providerId };
  }

  if (notification.channel === NotificationChannel.WEBHOOK) {
    const webhookEnabled = String(process.env.NOTIFICATION_WEBHOOK_ENABLED ?? "false") === "true";
    if (!webhookEnabled) {
      return { ok: false, errorCode: "WEBHOOK_NOT_CONFIGURED", errorMessage: "Webhook provider is not configured." };
    }

    return { ok: true, provider: "webhook-provider", providerId };
  }

  return {
    ok: false,
    errorCode: "UNKNOWN_CHANNEL",
    errorMessage: `Unsupported channel ${notification.channel}`,
  };
}

export async function processNotificationQueue(limit: number = 100) {
  const now = new Date();

  const due = await prisma.notification.findMany({
    where: {
      status: { in: [NotificationStatus.QUEUED, NotificationStatus.FAILED] },
      AND: [
        {
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
        },
        {
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      ],
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: limit,
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const notification of due) {
    if (notification.attemptCount >= notification.maxAttempts) {
      skipped += 1;
      continue;
    }

    const claimed = await prisma.notification.updateMany({
      where: {
        id: notification.id,
        status: { in: [NotificationStatus.QUEUED, NotificationStatus.FAILED] },
      },
      data: {
        status: NotificationStatus.PROCESSING,
      },
    });

    if (claimed.count === 0) {
      skipped += 1;
      continue;
    }

    const attempt = notification.attemptCount + 1;
    const result = await deliverNotification(notification);

    if (result.ok) {
      await prisma.$transaction([
        prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.SENT,
            sentAt: new Date(),
            failureReason: null,
            failedAt: null,
            nextRetryAt: null,
            attemptCount: attempt,
          },
        }),
        prisma.notificationDeliveryLog.create({
          data: {
            notificationId: notification.id,
            channel: notification.channel,
            attempt,
            status: NotificationStatus.SENT,
            provider: result.provider,
            providerId: result.providerId,
          },
        }),
      ]);

      sent += 1;
      continue;
    }

    const reachedMaxAttempts = attempt >= notification.maxAttempts;
    await prisma.$transaction([
      prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.FAILED,
          failedAt: reachedMaxAttempts ? new Date() : null,
          failureReason: result.errorMessage ?? "DELIVERY_FAILED",
          attemptCount: attempt,
          nextRetryAt: reachedMaxAttempts ? null : getNextRetryDate(attempt),
        },
      }),
      prisma.notificationDeliveryLog.create({
        data: {
          notificationId: notification.id,
          channel: notification.channel,
          attempt,
          status: NotificationStatus.FAILED,
          provider: result.provider,
          providerId: result.providerId,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
        },
      }),
    ]);

    failed += 1;
  }

  return {
    processed: due.length,
    sent,
    failed,
    skipped,
  };
}

export async function archiveExpiredNotifications() {
  const now = new Date();
  const result = await prisma.notification.updateMany({
    where: {
      status: { in: [NotificationStatus.QUEUED, NotificationStatus.FAILED, NotificationStatus.PROCESSING] },
      expiresAt: { lte: now },
    },
    data: {
      status: NotificationStatus.ARCHIVED,
      failureReason: "EXPIRED",
      nextRetryAt: null,
    },
  });

  return { archived: result.count };
}

type BroadcastInput = {
  title: string;
  message: string;
  channel?: NotificationChannel | LegacyChannel;
  type?: NotificationType;
  priority?: NotificationPriority;
  actionUrl?: string;
  payload?: unknown;
  roles?: UserRole[];
  userIds?: string[];
  dedupeKeyPrefix?: string;
  maxAttempts?: number;
  expiresAt?: Date;
};

export async function broadcastNotification(input: BroadcastInput) {
  const users = await prisma.user.findMany({
    where: {
      id: input.userIds && input.userIds.length > 0 ? { in: input.userIds } : undefined,
      role: input.roles && input.roles.length > 0 ? { in: input.roles } : undefined,
    },
    select: { id: true },
  });

  const notifications = users.map((user) => ({
    userId: user.id,
    title: input.title,
    message: input.message,
    channel: input.channel,
    type: input.type,
    priority: input.priority,
    actionUrl: input.actionUrl,
    payload: input.payload,
    dedupeKey: input.dedupeKeyPrefix ? `${input.dedupeKeyPrefix}:${user.id}` : undefined,
    maxAttempts: input.maxAttempts,
    expiresAt: input.expiresAt,
  }));

  const result = await createBulkNotifications(notifications);
  return {
    targetedUsers: users.length,
    ...result,
  };
}

export function startNotificationWorker() {
  if (notificationWorkerStarted) {
    return;
  }

  notificationWorkerStarted = true;

  notificationWorkerTimer = setInterval(async () => {
    try {
      await processNotificationQueue(100);
    } catch (error) {
      console.error("Notification queue processing failed:", error);
    }
  }, 20_000);

  notificationCleanupTimer = setInterval(async () => {
    try {
      await archiveExpiredNotifications();
    } catch (error) {
      console.error("Notification cleanup failed:", error);
    }
  }, 60_000);
}

export function stopNotificationWorker() {
  if (notificationWorkerTimer) {
    clearInterval(notificationWorkerTimer);
    notificationWorkerTimer = null;
  }
  if (notificationCleanupTimer) {
    clearInterval(notificationCleanupTimer);
    notificationCleanupTimer = null;
  }
  notificationWorkerStarted = false;
}
