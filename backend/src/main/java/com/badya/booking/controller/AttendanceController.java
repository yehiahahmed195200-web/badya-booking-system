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
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * API Endpoints للتحقق من حضور الطالب باستخدام Geofencing
 */
@RestController
@RequestMapping("/api/attendance")
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
     *   "studentLongitude": 31.3572,
     *   "gpsAccuracy": 5.0,
     *   "isMocked": false,
     *   "deviceId": "dev-xxx"
     * }
     */
    @PostMapping("/check-in")
    public ResponseEntity<?> checkIn(@RequestBody Map<String, Object> request, jakarta.servlet.http.HttpServletRequest httpRequest) {
        try {
            Long bookingId = ((Number) request.get("bookingId")).longValue();
            Double studentLat = ((Number) request.get("studentLatitude")).doubleValue();
            Double studentLon = ((Number) request.get("studentLongitude")).doubleValue();
            
            Double gpsAccuracy = request.get("gpsAccuracy") != null ? ((Number) request.get("gpsAccuracy")).doubleValue() : 5.0;
            boolean isMocked = request.get("isMocked") != null && (Boolean) request.get("isMocked");
            String deviceId = request.get("deviceId") != null ? (String) request.get("deviceId") : "";

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

            // تحقق من أن وقت الحجز لم ينتهِ بعد
            if (now.isAfter(booking.getEndTime())) {
                booking.setAttendanceStatus(AttendanceStatus.NO_SHOW);
                bookingRepository.save(booking);
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "عذراً، لقد انتهى وقت هذا الحجز بالفعل ولا يمكن تسجيل الحضور الآن."
                ));
            }

            // 1. استخراج الـ IP الفعلي وفحصه
            String clientIp = getClientIp(httpRequest);

            // 2. التحقق من سرعة الانتقال لمنع التزييف والـ Teleportation
            Double velocity = null;
            Booking lastBooking = bookingRepository.findFirstByUserIdAndAttendanceStatusInAndStudentLatitudeIsNotNullOrderByCheckedInAtDesc(
                booking.getUser().getId(), List.of(AttendanceStatus.CHECKED_IN, AttendanceStatus.CHECKED_OUT)
            );
            if (lastBooking != null && lastBooking.getStudentLatitude() != null && lastBooking.getStudentLongitude() != null && lastBooking.getCheckedInAt() != null) {
                boolean velocityImpossible = geofencingService.isVelocityImpossible(
                    lastBooking.getStudentLatitude(), lastBooking.getStudentLongitude(), lastBooking.getCheckedInAt(),
                    studentLat, studentLon, now
                );
                if (velocityImpossible) {
                    return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "message", "تم رفض حضورك: تم اكتشاف سرعة انتقال غير منطقية بين الحجوزات (Teleportation Check). الرجاء إيقاف برامج تزييف الموقع الجغرافي."
                    ));
                }
                
                Double distBetween = geofencingService.calculateDistance(
                    lastBooking.getStudentLatitude(), lastBooking.getStudentLongitude(),
                    studentLat, studentLon
                );
                long seconds = Math.abs(java.time.Duration.between(lastBooking.getCheckedInAt(), now).getSeconds());
                if (seconds > 0 && distBetween != null) {
                    velocity = distBetween / (seconds / 3600.0); // كم/ساعة
                }
            }

            // 3. حساب المسافة الفعالة باستخدام الـ GPS Accuracy (Fuzzy Geofencing)
            Double configuredRadius = facility.getGeofencingRadius() != null
                ? facility.getGeofencingRadius()
                : DEFAULT_GEOFENCE_RADIUS_KM;

            Double allowedRadius = geofencingService.calculateEffectiveRadius(configuredRadius, gpsAccuracy);

            Double distance = geofencingService.calculateDistance(
                facility.getLatitude(),
                facility.getLongitude(),
                studentLat,
                studentLon
            );

            boolean isWithinGeofence = geofencingService.isWithinGeofence(
                facility.getLatitude(),
                facility.getLongitude(),
                studentLat,
                studentLon,
                allowedRadius
            );

            VerificationMethod verificationMethod = VerificationMethod.GPS;
            boolean verified = false;

            if (isWithinGeofence) {
                verified = true;
                if (allowedRadius > configuredRadius) {
                    verificationMethod = VerificationMethod.GPS_FUZZY;
                } else {
                    verificationMethod = VerificationMethod.GPS;
                }
            } else {
                // 4. التحقق من شبكة واي فاي الجامعة كدعم احتياطي (Secondary Fallback)
                if (geofencingService.isCampusIp(clientIp)) {
                    verified = true;
                    verificationMethod = VerificationMethod.CAMPUS_WIFI;
                }
            }

            if (!verified) {
                int distanceInMeters = geofencingService.convertKmToMeters(distance);
                int allowedRadiusMeters = geofencingService.convertKmToMeters(allowedRadius);
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", String.format("أنت بعيد جداً عن المنشأة! المسافة: %d متر. يجب أن تكون ضمن %d متر",
                        distanceInMeters,
                        allowedRadiusMeters),
                    "distance", distance,
                    "allowedRadius", allowedRadius,
                    "ip", clientIp
                ));
            }

            // 5. التحقق من تطابق بصمة الجهاز (Device Binding Check)
            boolean isDeviceChanged = false;
            UserAccount user = booking.getUser();
            if (user != null && user.getDeviceId() != null && !user.getDeviceId().trim().isEmpty()) {
                if (!user.getDeviceId().equals(deviceId)) {
                    isDeviceChanged = true;
                }
            }

            // 6. حساب درجة المخاطر للحضور (Risk Score Engine)
            int riskScore = geofencingService.calculateRiskScore(
                distance, configuredRadius, gpsAccuracy, velocity,
                isMocked, VerificationMethod.CAMPUS_WIFI.equals(verificationMethod), isDeviceChanged
            );

            // تحديث حالة الحضور في قاعدة البيانات
            booking.setAttendanceStatus(AttendanceStatus.CHECKED_IN);
            booking.setCheckedInAt(now);
            booking.setStudentLatitude(studentLat);
            booking.setStudentLongitude(studentLon);
            booking.setDistanceFromFacility(distance);
            booking.setVerifiedBy(verificationMethod.name());
            booking.setVerificationMethod(verificationMethod);
            booking.setRiskScore(riskScore);
            bookingRepository.save(booking);

            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "تم تسجيل حضورك بنجاح!",
                "attendanceStatus", AttendanceStatus.CHECKED_IN.getDescription(),
                "distance", distance,
                "distanceMeters", geofencingService.convertKmToMeters(distance),
                "checkedInAt", now,
                "verificationMethod", verificationMethod.name(),
                "verificationMethodDesc", verificationMethod.getDescription(),
                "riskScore", riskScore
            ));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false,
                "message", "خطأ في تسجيل الحضور: " + e.getMessage()
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
     *   "studentLongitude": 31.3572,
     *   "gpsAccuracy": 5.0,
     *   "isMocked": false,
     *   "deviceId": "dev-xxx"
     * }
     */
    @PostMapping("/heartbeat")
    public ResponseEntity<?> heartbeat(@RequestBody Map<String, Object> request, jakarta.servlet.http.HttpServletRequest httpRequest) {
        try {
            Long bookingId = ((Number) request.get("bookingId")).longValue();
            Double studentLat = ((Number) request.get("studentLatitude")).doubleValue();
            Double studentLon = ((Number) request.get("studentLongitude")).doubleValue();
            
            Double gpsAccuracy = request.get("gpsAccuracy") != null ? ((Number) request.get("gpsAccuracy")).doubleValue() : 5.0;
            boolean isMocked = request.get("isMocked") != null && (Boolean) request.get("isMocked");
            String deviceId = request.get("deviceId") != null ? (String) request.get("deviceId") : "";

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

            String clientIp = getClientIp(httpRequest);

            // حساب المسافة والقطر الفعال
            Double configuredRadius = facility.getGeofencingRadius() != null
                ? facility.getGeofencingRadius()
                : DEFAULT_GEOFENCE_RADIUS_KM;
            
            Double allowedRadius = geofencingService.calculateEffectiveRadius(configuredRadius, gpsAccuracy);

            Double distance = geofencingService.calculateDistance(
                facility.getLatitude(),
                facility.getLongitude(),
                studentLat,
                studentLon
            );

            boolean isWithinGeofence = geofencingService.isWithinGeofence(
                facility.getLatitude(),
                facility.getLongitude(),
                studentLat,
                studentLon,
                allowedRadius
            );

            VerificationMethod verificationMethod = VerificationMethod.GPS;
            boolean insideField = false;

            if (isWithinGeofence) {
                insideField = true;
                if (allowedRadius > configuredRadius) {
                    verificationMethod = VerificationMethod.GPS_FUZZY;
                }
            } else {
                // WiFi Fallback
                if (geofencingService.isCampusIp(clientIp)) {
                    insideField = true;
                    verificationMethod = VerificationMethod.CAMPUS_WIFI;
                }
            }

            // فحص سرعة الانتقال أثناء التحديث
            Double velocity = null;
            LocalDateTime now = LocalDateTime.now();
            if (booking.getCheckedInAt() != null && booking.getStudentLatitude() != null && booking.getStudentLongitude() != null) {
                Double distBetween = geofencingService.calculateDistance(
                    booking.getStudentLatitude(), booking.getStudentLongitude(),
                    studentLat, studentLon
                );
                long seconds = Math.abs(java.time.Duration.between(booking.getCheckedInAt(), now).getSeconds());
                if (seconds > 0 && distBetween != null) {
                    velocity = distBetween / (seconds / 3600.0);
                }
            }

            // فحص تغيير بصمة الجهاز
            boolean isDeviceChanged = false;
            UserAccount user = booking.getUser();
            if (user != null && user.getDeviceId() != null && !user.getDeviceId().trim().isEmpty()) {
                if (!user.getDeviceId().equals(deviceId)) {
                    isDeviceChanged = true;
                }
            }

            // حساب مستوى المخاطر
            int riskScore = geofencingService.calculateRiskScore(
                distance, configuredRadius, gpsAccuracy, velocity,
                isMocked, VerificationMethod.CAMPUS_WIFI.equals(verificationMethod), isDeviceChanged
            );

            booking.setStudentLatitude(studentLat);
            booking.setStudentLongitude(studentLon);
            booking.setDistanceFromFacility(distance);
            booking.setRiskScore(riskScore);
            booking.setVerifiedBy("HEARTBEAT_" + verificationMethod.name());
            bookingRepository.save(booking);

            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", insideField ? "الطالب داخل نطاق الملعب" : "الطالب خارج نطاق الملعب",
                "insideField", insideField,
                "distance", distance,
                "distanceMeters", geofencingService.convertKmToMeters(distance),
                "allowedRadiusMeters", geofencingService.convertKmToMeters(allowedRadius),
                "updatedAt", now,
                "riskScore", riskScore,
                "verificationMethod", verificationMethod.name()
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
                    geofencingService.convertKmToMeters(facility.getGeofencingRadius()) : 4
            ));
            response.put("studentLocation", booking.getStudentLatitude() != null ? Map.of(
                "latitude", booking.getStudentLatitude(),
                "longitude", booking.getStudentLongitude()
            ) : null);
            response.put("verifiedBy", booking.getVerifiedBy());
            response.put("verificationMethod", booking.getVerificationMethod() != null ? booking.getVerificationMethod().name() : null);
            response.put("verificationMethodDesc", booking.getVerificationMethod() != null ? booking.getVerificationMethod().getDescription() : null);
            response.put("riskScore", booking.getRiskScore() != null ? booking.getRiskScore() : 0);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false,
                "message", "خطأ: " + e.getMessage()
            ));
        }
    }

    /**
     * استخراج الـ IP الفعلي للعميل مع دعم البروكسي
     */
    private String getClientIp(jakarta.servlet.http.HttpServletRequest request) {
        String xfHeader = request.getHeader("X-Forwarded-For");
        if (xfHeader == null || xfHeader.isEmpty()) {
            return request.getRemoteAddr();
        }
        return xfHeader.split(",")[0].trim();
    }

    /**
     * حساب النقاط المكتسبة عند الحضور
     */
    private Integer calculatePointsForAttendance(Booking booking) {
        // 25 نقطة للحضور الكامل
        return 25;
    }
}
