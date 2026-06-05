import { prisma } from "../db";
import { AttendanceStatus } from "@prisma/client";
import dayjs from "dayjs";

/**
 * Geofencing Service - حساب المسافات والتحقق من الحضور الجغرافي
 */

/**
 * حساب المسافة بين نقطتين باستخدام Haversine Formula
 * @returns المسافة بالكيلومترات
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // نصف قطر الأرض بالكيلومترات

  const latDistance = ((lat2 - lat1) * Math.PI) / 180;
  const lonDistance = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(latDistance / 2) * Math.sin(latDistance / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(lonDistance / 2) *
      Math.sin(lonDistance / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // المسافة بالكيلومترات
}

/**
 * التحقق من أن الطالب ضمن نطاق المنشأة
 */
export function isWithinGeofence(
  facilityLat: number,
  facilityLon: number,
  studentLat: number,
  studentLon: number,
  radiusKm: number
): boolean {
  const distance = calculateDistance(
    facilityLat,
    facilityLon,
    studentLat,
    studentLon
  );
  return distance <= radiusKm;
}

const DEFAULT_GEOFENCE_RADIUS_KM = 0.004;

/**
 * تسجيل حضور الطالب (Check-in)
 */
export async function checkInStudent(
  bookingId: string,
  studentLatitude: number,
  studentLongitude: number
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { facility: true, user: true },
  });

  if (!booking) {
    throw new Error("الحجز غير موجود");
  }

  // التحقق من حالة الحجز
  if (
    booking.status !== "CONFIRMED" &&
    booking.status !== "APPROVED"
  ) {
    throw new Error("الحجز غير مؤكد أو تم إلغاؤه");
  }

  const now = dayjs();
  const checkInDeadline = dayjs(booking.startTime).subtract(15, "minute");

  // التحقق من أن الوقت الحالي قريب من موعد الحجز
  if (now.isBefore(checkInDeadline)) {
    throw new Error(
      "لم يحن موعد تسجيل الحضور بعد. يمكنك التسجيل من 15 دقيقة قبل الموعد"
    );
  }

  // التحقق من عدم فوات موعد الحجز بأكثر من ساعة
  if (now.isAfter(dayjs(booking.startTime).add(1, "hour"))) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { attendanceStatus: AttendanceStatus.NO_SHOW },
    });
    throw new Error("لقد فاتك موعد الحجز. تم تسجيلك كـ لم يحضر");
  }

  // حساب المسافة من المنشأة
  if (!booking.facility.latitude || !booking.facility.longitude) {
    throw new Error("لم يتم تحديد موقع المنشأة بعد");
  }

  const distance = calculateDistance(
    booking.facility.latitude,
    booking.facility.longitude,
    studentLatitude,
    studentLongitude
  );

  // تحديد نطاق الـ geofencing (4 متر بشكل افتراضي وبحد أقصى 4 متر)
  const allowedRadius = Math.min(
    booking.facility.geofencingRadius ?? DEFAULT_GEOFENCE_RADIUS_KM,
    DEFAULT_GEOFENCE_RADIUS_KM
  );

  // التحقق من أن الطالب ضمن نطاق المنشأة
  const withinGeofence = isWithinGeofence(
    booking.facility.latitude,
    booking.facility.longitude,
    studentLatitude,
    studentLongitude,
    allowedRadius
  );

  if (!withinGeofence) {
    const distanceInMeters = Math.round(distance * 1000);
    const allowedRadiusMeters = Math.round(allowedRadius * 1000);
    throw new Error(
      `أنت بعيد جداً عن المنشأة! المسافة: ${distanceInMeters} متر. يجب أن تكون ضمن ${allowedRadiusMeters} متر`
    );
  }

  // تحديث حالة الحضور
  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      attendanceStatus: AttendanceStatus.CHECKED_IN,
      checkedInAt: new Date(),
      studentLatitude,
      studentLongitude,
      distanceFromFacility: distance,
      verifiedBy: "STUDENT",
    },
  });

  return {
    success: true,
    message: "تم تسجيل حضورك بنجاح!",
    attendanceStatus: AttendanceStatus.CHECKED_IN,
    distance,
    distanceMeters: Math.round(distance * 1000),
    checkedInAt: updatedBooking.checkedInAt,
  };
}

/**
 * تسجيل الانصراف (Check-out)
 */
export async function checkOutStudent(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new Error("الحجز غير موجود");
  }

  // التحقق من أن الطالب قام بـ check-in أولاً
  if (booking.attendanceStatus !== AttendanceStatus.CHECKED_IN) {
    throw new Error("يجب تسجيل حضورك أولاً قبل الانصراف");
  }

  const now = new Date();

  // حساب مدة الحضور
  const checkedInTime = booking.checkedInAt!.getTime();
  const duration = Math.round((now.getTime() - checkedInTime) / (1000 * 60)); // بالدقائق

  // تحديث حالة الحضور
  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      attendanceStatus: AttendanceStatus.CHECKED_OUT,
      checkedOutAt: now,
    },
  });

  // حساب النقاط المكتسبة (25 نقطة للحضور الكامل)
  const earnedPoints = 25;

  return {
    success: true,
    message: "تم تسجيل انصرافك بنجاح!",
    attendanceStatus: AttendanceStatus.CHECKED_OUT,
    checkedOutAt: updatedBooking.checkedOutAt,
    duration: `${duration} دقيقة`,
    earnedPoints,
  };
}

/**
 * تحديث موقع الطالب بشكل دوري أثناء الحجز (Heartbeat)
 */
export async function heartbeatLocation(
  bookingId: string,
  studentLatitude: number,
  studentLongitude: number
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { facility: true },
  });

  if (!booking) {
    throw new Error("الحجز غير موجود");
  }

  if (booking.attendanceStatus !== AttendanceStatus.CHECKED_IN) {
    throw new Error("لا يمكن تحديث الموقع قبل تسجيل الحضور");
  }

  if (!booking.facility.latitude || !booking.facility.longitude) {
    throw new Error("لم يتم تحديد موقع المنشأة بعد");
  }

  const distance = calculateDistance(
    booking.facility.latitude,
    booking.facility.longitude,
    studentLatitude,
    studentLongitude
  );

  const allowedRadius = Math.min(
    booking.facility.geofencingRadius ?? DEFAULT_GEOFENCE_RADIUS_KM,
    DEFAULT_GEOFENCE_RADIUS_KM
  );
  const insideField = distance <= allowedRadius;

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      studentLatitude,
      studentLongitude,
      distanceFromFacility: distance,
      verifiedBy: "HEARTBEAT",
    },
  });

  return {
    success: true,
    insideField,
    distance,
    distanceMeters: Math.round(distance * 1000),
    allowedRadiusMeters: Math.round(allowedRadius * 1000),
    updatedAt: new Date(),
  };
}

/**
 * الحصول على معلومات الحضور للحجز
 */
export async function getAttendanceInfo(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { facility: true },
  });

  if (!booking) {
    throw new Error("الحجز غير موجود");
  }

  return {
    bookingId: booking.id,
    attendanceStatus: booking.attendanceStatus,
    checkedInAt: booking.checkedInAt,
    checkedOutAt: booking.checkedOutAt,
    distanceFromFacility: booking.distanceFromFacility,
    facilityLocation: {
      latitude: booking.facility.latitude,
      longitude: booking.facility.longitude,
      radius: Math.min(
        Math.round((booking.facility.geofencingRadius ?? DEFAULT_GEOFENCE_RADIUS_KM) * 1000),
        4
      ),
    },
    studentLocation:
      booking.studentLatitude && booking.studentLongitude
        ? {
            latitude: booking.studentLatitude,
            longitude: booking.studentLongitude,
          }
        : null,
    verifiedBy: booking.verifiedBy,
  };
}
