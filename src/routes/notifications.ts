import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/authMiddleware";
import {
  archiveNotification,
  broadcastNotification,
  createNotification,
  getNotificationPreferences,
  getUnreadCount,
  getUserNotifications,
  markAllAsRead,
  markAsRead,
  processNotificationQueue,
  updateNotificationPreferences,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationType,
} from "../services/notificationService";
import { UserRole } from "@prisma/client";

const router = Router();

router.use(requireAuth);

const getNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  unreadOnly: z.coerce.boolean().optional(),
  status: z.nativeEnum(NotificationStatus).optional(),
  channel: z.nativeEnum(NotificationChannel).optional(),
});

const updatePreferencesSchema = z.object({
  appEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  bookingEnabled: z.boolean().optional(),
  attendanceEnabled: z.boolean().optional(),
  securityEnabled: z.boolean().optional(),
  accountEnabled: z.boolean().optional(),
  rewardEnabled: z.boolean().optional(),
  quietHoursStart: z.number().int().min(0).max(23).nullable().optional(),
  quietHoursEnd: z.number().int().min(0).max(23).nullable().optional(),
  timezone: z.string().trim().min(1).max(100).nullable().optional(),
});

const broadcastSchema = z.object({
  title: z.string().min(1).max(150),
  message: z.string().min(1).max(5000),
  channel: z.nativeEnum(NotificationChannel).optional(),
  type: z.nativeEnum(NotificationType).optional(),
  priority: z.nativeEnum(NotificationPriority).optional(),
  actionUrl: z.string().url().optional(),
  roles: z.array(z.nativeEnum(UserRole)).optional(),
  userIds: z.array(z.string().min(1)).optional(),
  dedupeKeyPrefix: z.string().min(1).max(150).optional(),
  maxAttempts: z.number().int().min(1).max(10).optional(),
  expiresAt: z.coerce.date().optional(),
  payload: z.unknown().optional(),
});

const selfTestSchema = z.object({
  title: z.string().min(1).max(150),
  message: z.string().min(1).max(5000),
  channel: z.nativeEnum(NotificationChannel).optional(),
  type: z.nativeEnum(NotificationType).optional(),
  priority: z.nativeEnum(NotificationPriority).optional(),
  actionUrl: z.string().url().optional(),
});

router.get("/", async (req, res, next) => {
  try {
    const query = getNotificationsQuerySchema.parse(req.query);
    const result = await getUserNotifications(req.auth!.userId, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/unread-count", async (req, res, next) => {
  try {
    const result = await getUnreadCount(req.auth!.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.patch("/read-all", async (req, res, next) => {
  try {
    const result = await markAllAsRead(req.auth!.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/read", async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const owned = await prisma.notification.findFirst({ where: { id, userId: req.auth!.userId }, select: { id: true } });
    if (!owned) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Notification not found" });
    }

    const result = await markAsRead(id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/archive", async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const result = await archiveNotification(id, req.auth!.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/preferences", async (req, res, next) => {
  try {
    const prefs = await getNotificationPreferences(req.auth!.userId);
    res.json(prefs);
  } catch (error) {
    next(error);
  }
});

router.put("/preferences", async (req, res, next) => {
  try {
    const data = updatePreferencesSchema.parse(req.body);
    if (
      (data.quietHoursStart === null && data.quietHoursEnd !== null) ||
      (data.quietHoursStart !== null && data.quietHoursEnd === null)
    ) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "quietHoursStart and quietHoursEnd must both be set together or both be null.",
      });
    }

    const prefs = await updateNotificationPreferences(req.auth!.userId, data);
    res.json(prefs);
  } catch (error) {
    next(error);
  }
});

router.post("/test", async (req, res, next) => {
  try {
    const data = selfTestSchema.parse(req.body);
    const created = await createNotification({
      userId: req.auth!.userId,
      title: data.title,
      message: data.message,
      channel: data.channel,
      type: data.type ?? NotificationType.SYSTEM,
      priority: data.priority,
      actionUrl: data.actionUrl,
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.post("/broadcast", requireRole(UserRole.ADMIN, UserRole.MANAGER), async (req, res, next) => {
  try {
    const data = broadcastSchema.parse(req.body);
    const result = await broadcastNotification(data);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/process-queue", requireRole(UserRole.ADMIN, UserRole.MANAGER), async (req, res, next) => {
  try {
    const result = await processNotificationQueue(200);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
