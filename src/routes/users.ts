import { Router } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/authMiddleware";
import { hashPassword, signToken, verifyPassword } from "../utils/auth";

const router = Router();

const createUserSchema = z.object({
  studentId: z.string().min(1),
  fullName: z.string().min(2),
  email: z.string().email(),
  barcode: z.string().min(3),
  password: z.string().min(6),
  role: z.nativeEnum(UserRole).optional(),
  managedFacilityId: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.post("/", async (req, res, next) => {
  try {
    const data = createUserSchema.parse(req.body);
    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        studentId: data.studentId,
        fullName: data.fullName,
        email: data.email,
        barcode: data.barcode,
        passwordHash,
        role: data.role ?? UserRole.STUDENT,
        managedFacilityId: data.managedFacilityId,
      },
    });

    const token = signToken({ userId: user.id, role: user.role });
    res.status(201).json({
      token,
      user: {
        id: user.id,
        studentId: user.studentId,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", requireAuth, requireRole(UserRole.ADMIN), async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  res.json(users);
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ code: "USER_NOT_FOUND", message: "User not found" });

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ code: "INVALID_CREDENTIALS", message: "Invalid email or password" });
    }

    const token = signToken({ userId: user.id, role: user.role });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        studentId: user.studentId,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user) {
      return res.status(404).json({ code: "USER_NOT_FOUND", message: "User not found" });
    }

    res.json({
      id: user.id,
      studentId: user.studentId,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      managedFacilityId: user.managedFacilityId,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/barcode/:barcode", requireAuth, async (req, res, next) => {
  try {
    const barcode = req.params.barcode as string;
    const user = await prisma.user.findUnique({ where: { barcode } });
    if (!user) {
      return res.status(404).json({ code: "USER_NOT_FOUND", message: "User not found" });
    }

    res.json({
      id: user.id,
      studentId: user.studentId,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      managedFacilityId: user.managedFacilityId,
      points: user.points,
      warnings: user.warnings,
      isBanned: user.isBanned
    });
  } catch (error) {
    next(error);
  }
});

import { spinLuckyWheel } from "../services/adminService";

router.post("/me/spin-wheel", requireAuth, async (req, res, next) => {
  try {
    const result = await spinLuckyWheel(req.auth!.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
