package com.badya.booking.controller;

import com.badya.booking.model.*;
import com.badya.booking.repository.BookingRepository;
import com.badya.booking.repository.UserRepository;
import com.badya.booking.service.GeofencingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * API Endpoints للتحقق من حضور الطالب باستخدام Geofencing
 */
@RestController
@RequestMapping("/api/attendance")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173", "http://127.0.0.1:3000"})
public class AttendanceController {
    private static final double DEFAULT_GEOFENCE_RADIUS_KM = 0.004;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GeofencingService geofencingService;

    /**
     * التحقق من حضور الطالب (Check-in)
     * 
     * POST /api/attendance/check-in
     * Body: {
     *   "bookingId": 123,
     *   "studentLatitude": 30.0544,
     *   "studentLongitude": 31.3572
     * }
     */
    @PostMapping("/check-in")
    public ResponseEntity<?> checkIn(@RequestBody Map<String, Object> request) {
        try {
            Long bookingId = ((Number) request.get("bookingId")).longValue();
            Double studentLat = ((Number) request.get("studentLatitude")).doubleValue();
            Double studentLon = ((Number) request.get("studentLongitude")).doubleValue();

            Optional<Booking> bookingOpt = bookingRepository.findById(bookingId);
            if (!bookingOpt.isPresent()) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "الحجز غير موجود"
                ));
            }

            Booking booking = bookingOpt.get();
            Facility facility = booking.getFacility();

            // تحقق من أن الحجز في الحالة الصحيحة
            if (!booking.getStatus().equals(BookingStatus.CONFIRMED)) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "الحجز غير مؤكد أو تم إلغاؤه"
                ));
            }

            // تحقق من أن الوقت الحالي قريب من موعد الحجز (15 دقيقة قبل البداية)
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime checkInDeadline = booking.getStartTime().minusMinutes(15);
            
            if (now.isBefore(checkInDeadline)) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "لم يحن موعد تسجيل الحضور بعد. يمكنك التسجيل من 15 دقيقة قبل الموعد"
                ));
            }

            // تحقق من أن الطالب لم يفته موعد الحجز بأكثر من ساعة
            if (now.isAfter(booking.getStartTime().plusHours(1))) {
                booking.setAttendanceStatus(AttendanceStatus.NO_SHOW);
                bookingRepository.save(booking);
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "لقد فاتك موعد الحجز. تم تسجيلك كـ لم يحضر"
                ));
            }

            // حساب المسافة من المنشأة
            Double distance = geofencingService.calculateDistance(
                facility.getLatitude(),
                facility.getLongitude(),
                studentLat,
                studentLon
            );

            // تحديد نطاق الـ geofencing (4 متر بشكل افتراضي وبحد أقصى 4 متر)
            Double allowedRadius = facility.getGeofencingRadius() != null
                ? Math.min(facility.getGeofencingRadius(), DEFAULT_GEOFENCE_RADIUS_KM)
                : DEFAULT_GEOFENCE_RADIUS_KM;

            // التحقق من أن الطالب ضمن نطاق المنشأة
            boolean isWithinGeofence = geofencingService.isWithinGeofence(
                facility.getLatitude(),
                facility.getLongitude(),
                studentLat,
                studentLon,
                allowedRadius
            );

            if (!isWithinGeofence) {
                int distanceInMeters = geofencingService.convertKmToMeters(distance);
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", String.format("أنت بعيد جداً عن المنشأة! المسافة: %d متر. يجب أن تكون ضمن %d متر",
                        distanceInMeters,
                        geofencingService.convertKmToMeters(allowedRadius)),
                    "distance", distance,
                    "allowedRadius", allowedRadius
                ));
            }

            // تحديث حالة الحضور
            booking.setAttendanceStatus(AttendanceStatus.CHECKED_IN);
            booking.setCheckedInAt(now);
            booking.setStudentLatitude(studentLat);
            booking.setStudentLongitude(studentLon);
            booking.setDistanceFromFacility(distance);
            booking.setVerifiedBy("STUDENT");
            bookingRepository.save(booking);

            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "تم تسجيل حضورك بنجاح!",
                "attendanceStatus", AttendanceStatus.CHECKED_IN.getDescription(),
                "distance", distance,
                "distanceMeters", geofencingService.convertKmToMeters(distance),
                "checkedInAt", now
            ));

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false,
                "message", "خطأ: " + e.getMessage()
            ));
        }
    }

    /**
     * تسجيل الانصراف (Check-out)
     * 
     * POST /api/attendance/check-out
     * Body: {
     *   "bookingId": 123
     * }
     */
    @PostMapping("/check-out")
    public ResponseEntity<?> checkOut(@RequestBody Map<String, Object> request) {
        try {
            Long bookingId = ((Number) request.get("bookingId")).longValue();

            Optional<Booking> bookingOpt = bookingRepository.findById(bookingId);
            if (!bookingOpt.isPresent()) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "الحجز غير موجود"
                ));
            }

            Booking booking = bookingOpt.get();

            // تحقق من أن الطالب قد قام بـ check-in أولاً
            if (!booking.getAttendanceStatus().equals(AttendanceStatus.CHECKED_IN)) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "يجب تسجيل حضورك أولاً قبل الانصراف"
                ));
            }

            LocalDateTime now = LocalDateTime.now();
            
            // تحديث حالة الحضور
            booking.setAttendanceStatus(AttendanceStatus.CHECKED_OUT);
            booking.setCheckedOutAt(now);
            bookingRepository.save(booking);

            UserAccount user = booking.getUser();
            if (user != null) {
                int currentPoints = user.getEarnedPoints() != null ? user.getEarnedPoints() : 0;
                int earnedPoints = calculatePointsForAttendance(booking);
                user.setEarnedPoints(currentPoints + earnedPoints);
                userRepository.save(user);
            }

            // حساب مدة الحضور
            long durationMinutes = java.time.temporal.ChronoUnit.MINUTES.between(
                booking.getCheckedInAt(), 
                now
            );

            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "تم تسجيل انصرافك بنجاح!",
                "attendanceStatus", AttendanceStatus.CHECKED_OUT.getDescription(),
                "checkedOutAt", now,
                "duration", durationMinutes + " دقيقة",
                "earnedPoints", calculatePointsForAttendance(booking)
            ));

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false,
                "message", "خطأ: " + e.getMessage()
            ));
        }
    }

    /**
     * تحديث موقع الطالب بشكل دوري أثناء وجوده في الملعب (Heartbeat)
     *
     * POST /api/attendance/heartbeat
     * Body: {
     *   "bookingId": 123,
     *   "studentLatitude": 30.0544,
     *   "studentLongitude": 31.3572
     * }
     */
    @PostMapping("/heartbeat")
    public ResponseEntity<?> heartbeat(@RequestBody Map<String, Object> request) {
        try {
            Long bookingId = ((Number) request.get("bookingId")).longValue();
            Double studentLat = ((Number) request.get("studentLatitude")).doubleValue();
            Double studentLon = ((Number) request.get("studentLongitude")).doubleValue();

            Optional<Booking> bookingOpt = bookingRepository.findById(bookingId);
            if (!bookingOpt.isPresent()) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "الحجز غير موجود"
                ));
            }

            Booking booking = bookingOpt.get();
            Facility facility = booking.getFacility();
            if (facility == null || facility.getLatitude() == null || facility.getLongitude() == null) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "موقع المنشأة غير متوفر"
                ));
            }

            if (!AttendanceStatus.CHECKED_IN.equals(booking.getAttendanceStatus())) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "لا يمكن تحديث الموقع قبل تسجيل الحضور"
                ));
            }

            Double distance = geofencingService.calculateDistance(
                facility.getLatitude(),
                facility.getLongitude(),
                studentLat,
                studentLon
            );
            Double allowedRadius = facility.getGeofencingRadius() != null
                ? Math.min(facility.getGeofencingRadius(), DEFAULT_GEOFENCE_RADIUS_KM)
                : DEFAULT_GEOFENCE_RADIUS_KM;
            boolean insideField = distance <= allowedRadius;

            booking.setStudentLatitude(studentLat);
            booking.setStudentLongitude(studentLon);
            booking.setDistanceFromFacility(distance);
            booking.setVerifiedBy("HEARTBEAT");
            bookingRepository.save(booking);

            LocalDateTime updatedAt = LocalDateTime.now();
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", insideField ? "الطالب داخل نطاق الملعب" : "الطالب خارج نطاق الملعب",
                "insideField", insideField,
                "distance", distance,
                "distanceMeters", geofencingService.convertKmToMeters(distance),
                "allowedRadiusMeters", geofencingService.convertKmToMeters(allowedRadius),
                "updatedAt", updatedAt
            ));

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false,
                "message", "خطأ: " + e.getMessage()
            ));
        }
    }

    /**
     * الحصول على معلومات الحضور للحجز
     * 
     * GET /api/attendance/booking/{bookingId}
     */
    @GetMapping("/booking/{bookingId}")
    public ResponseEntity<?> getAttendanceInfo(@PathVariable Long bookingId) {
        try {
            Optional<Booking> bookingOpt = bookingRepository.findById(bookingId);
            if (!bookingOpt.isPresent()) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "الحجز غير موجود"
                ));
            }

            Booking booking = bookingOpt.get();
            Facility facility = booking.getFacility();

            Map<String, Object> response = new HashMap<>();
            response.put("bookingId", booking.getId());
            response.put("attendanceStatus", booking.getAttendanceStatus().getDescription());
            response.put("checkedInAt", booking.getCheckedInAt());
            response.put("checkedOutAt", booking.getCheckedOutAt());
            response.put("distanceFromFacility", booking.getDistanceFromFacility());
            response.put("facilityLocation", Map.of(
                "latitude", facility.getLatitude(),
                "longitude", facility.getLongitude(),
                "radius", facility.getGeofencingRadius() != null ?
                    Math.min(geofencingService.convertKmToMeters(facility.getGeofencingRadius()), 4) : 4
            ));
            response.put("studentLocation", booking.getStudentLatitude() != null ? Map.of(
                "latitude", booking.getStudentLatitude(),
                "longitude", booking.getStudentLongitude()
            ) : null);
            response.put("verifiedBy", booking.getVerifiedBy());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false,
                "message", "خطأ: " + e.getMessage()
            ));
        }
    }

    /**
     * حساب النقاط المكتسبة عند الحضور
     */
    private Integer calculatePointsForAttendance(Booking booking) {
        // 25 نقطة للحضور الكامل
        return 25;
    }
}
