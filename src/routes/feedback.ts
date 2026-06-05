import { Router } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/authMiddleware";

const router = Router();

const createFeedbackSchema = z.object({
  facilityId: z.string().min(1),
  bookingId: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  isAnonymous: z.boolean().default(false),
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const data = createFeedbackSchema.parse(req.body);

    const facility = await prisma.facility.findUnique({ where: { id: data.facilityId } });
    if (!facility) throw new Error("Facility not found");
    if (!facility.feedbackEnabled) throw new Error("Feedback is disabled for this facility");

    const feedback = await prisma.feedback.create({
      data: {
        ...data,
        userId: data.isAnonymous ? undefined : req.auth!.userId,
      },
    });
    res.status(201).json(feedback);
  } catch (error) {
    next(error);
  }
});

router.get("/", requireAuth, requireRole(UserRole.ADMIN, UserRole.COACH), async (_req, res) => {
  const feedback = await prisma.feedback.findMany({ orderBy: { createdAt: "desc" } });
  res.json(feedback);
});

export default router;
