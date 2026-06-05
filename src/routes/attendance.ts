import express, { Request, Response } from "express";
import { UserRole } from "@prisma/client";
import * as attendanceService from "../services/attendanceService";

const router = express.Router();

interface AuthRequest extends Request {
  auth?: { userId: string; role: UserRole };
}

/**
 * POST /api/attendance/check-in
 * تسجيل حضور الطالب
 * Body: {
 *   "bookingId": "...",
 *   "studentLatitude": 30.0544,
 *   "studentLongitude": 31.3572
 * }
 */
router.post("/check-in", async (req: AuthRequest, res: Response) => {
  try {
    const { bookingId, studentLatitude, studentLongitude } = req.body;

    if (!bookingId || studentLatitude === undefined || studentLongitude === undefined) {
      return res.status(400).json({
        success: false,
        message: "bookingId, studentLatitude, و studentLongitude مطلوبة",
      });
    }

    const result = await attendanceService.checkInStudent(
      bookingId,
      parseFloat(studentLatitude),
      parseFloat(studentLongitude)
    );

    res.json(result);
  } catch (error: any) {
    console.error("Check-in error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "خطأ في تسجيل الحضور",
    });
  }
});

/**
 * POST /api/attendance/check-out
 * تسجيل الانصراف
 * Body: {
 *   "bookingId": "..."
 * }
 */
router.post("/check-out", async (req: AuthRequest, res: Response) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "bookingId مطلوبة",
      });
    }

    const result = await attendanceService.checkOutStudent(bookingId);

    res.json(result);
  } catch (error: any) {
    console.error("Check-out error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "خطأ في تسجيل الانصراف",
    });
  }
});

/**
 * POST /api/attendance/heartbeat
 * تحديث دوري لموقع الطالب أثناء التواجد في الملعب
 */
router.post("/heartbeat", async (req: AuthRequest, res: Response) => {
  try {
    const { bookingId, studentLatitude, studentLongitude } = req.body;

    if (!bookingId || studentLatitude === undefined || studentLongitude === undefined) {
      return res.status(400).json({
        success: false,
        message: "bookingId, studentLatitude, و studentLongitude مطلوبة",
      });
    }

    const result = await attendanceService.heartbeatLocation(
      bookingId,
      parseFloat(studentLatitude),
      parseFloat(studentLongitude)
    );

    res.json(result);
  } catch (error: any) {
    console.error("Heartbeat error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "خطأ في تحديث موقع الطالب",
    });
  }
});

/**
 * GET /api/attendance/booking/:bookingId
 * الحصول على معلومات الحضور للحجز
 */
router.get("/booking/:bookingId", async (req: AuthRequest, res: Response) => {
  try {
    const { bookingId } = req.params;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "bookingId مطلوبة",
      });
    }

    const normalizedBookingId = Array.isArray(bookingId) ? bookingId[0] : bookingId;
    const info = await attendanceService.getAttendanceInfo(normalizedBookingId);

    res.json({
      success: true,
      data: info,
    });
  } catch (error: any) {
    console.error("Get attendance info error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "خطأ في استرجاع معلومات الحضور",
    });
  }
});

export default router;
