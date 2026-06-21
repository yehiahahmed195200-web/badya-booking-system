package com.badya.booking.service;

import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.time.Duration;

/**
 * Advanced Geofencing & Telemetry Engine (World-class standard)
 */
@Service
public class GeofencingService {

    private static final double MAX_GPS_ACCURACY_EXPANSION_KM = 0.015; // 15 meters maximum GPS drift buffer
    private static final double MAX_IMPOSSIBLE_SPEED_KMPH = 150.0; // 150 km/h is flagged as impossible on campus

    /**
     * حساب المسافة بين نقطتين باستخدام Haversine Formula
     */
    public Double calculateDistance(Double lat1, Double lon1, Double lat2, Double lon2) {
        if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
            return null;
        }

        final int R = 6371; // Earth radius in kilometers

        Double latDistance = Math.toRadians(lat2 - lat1);
        Double lonDistance = Math.toRadians(lon2 - lon1);

        Double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);

        Double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
        return R * c; // Distance in kilometers
    }

    /**
     * حساب القطر الفعال للمنطقة الجغرافية بناءً على دقة الـ GPS (Fuzzy Geofencing)
     * يمنع مشاكل تذبذب إشارة الـ GPS داخل المباني وصالات اللعب المغلقة
     */
    public Double calculateEffectiveRadius(Double configuredRadiusKm, Double gpsAccuracyMeters) {
        if (configuredRadiusKm == null) {
            return 0.004; // 4 meters default
        }
        if (gpsAccuracyMeters == null || gpsAccuracyMeters <= 0) {
            return configuredRadiusKm;
        }

        // إضافة هامش خطأ مسموح به يساوي نصف دقة الـ GPS بحد أقصى 15 متر
        double accuracyBufferKm = (gpsAccuracyMeters / 1000.0) * 0.5;
        double clampedBufferKm = Math.min(accuracyBufferKm, MAX_GPS_ACCURACY_EXPANSION_KM);

        return configuredRadiusKm + clampedBufferKm;
    }

    /**
     * التحقق من أن الطالب داخل النطاق الجغرافي الفعال
     */
    public Boolean isWithinGeofence(Double facilityLat, Double facilityLon, 
                                     Double studentLat, Double studentLon, 
                                     Double effectiveRadiusKm) {
        if (facilityLat == null || facilityLon == null || 
            studentLat == null || studentLon == null || effectiveRadiusKm == null) {
            return false;
        }

        Double distance = calculateDistance(facilityLat, facilityLon, studentLat, studentLon);
        return distance != null && distance <= effectiveRadiusKm;
    }

    /**
     * فحص ما إذا كان الـ IP يقع ضمن شبكة الواي فاي للجامعة (Campus Network Subnet)
     * كحل بديل ودعم إضافي لتأكيد حضور الطالب في حال تعطل الـ GPS داخل الصالات
     */
    public boolean isCampusIp(String ipAddress) {
        if (ipAddress == null || ipAddress.isEmpty()) {
            return false;
        }
        
        // التحقق من نطاقات الـ IP الخاصة (شبكة الجامعة الداخلية) أو الـ localhost للتطوير
        return ipAddress.equals("127.0.0.1") 
                || ipAddress.equals("0:0:0:0:0:0:0:1")
                || ipAddress.startsWith("192.168.") 
                || ipAddress.startsWith("10.") 
                || ipAddress.startsWith("172.16.") 
                || ipAddress.startsWith("172.17.") 
                || ipAddress.startsWith("172.18.") 
                || ipAddress.startsWith("172.19.") 
                || ipAddress.startsWith("172.2")
                || ipAddress.startsWith("172.3");
    }

    /**
     * كشف تزييف المواقع (Impossible Velocity Check)
     * إذا تحرك الطالب مسافة ضخمة في ثوانٍ معدودة بين حجزين، فهذا يعني استخدام برنامج Fake GPS
     */
    public boolean isVelocityImpossible(Double lat1, Double lon1, LocalDateTime time1, 
                                       Double lat2, Double lon2, LocalDateTime time2) {
        if (lat1 == null || lon1 == null || time1 == null || 
            lat2 == null || lon2 == null || time2 == null) {
            return false;
        }

        Double distanceKm = calculateDistance(lat1, lon1, lat2, lon2);
        if (distanceKm == null || distanceKm < 0.05) {
            return false; // مسافة صغيرة جداً (أقل من 50 متر) لا تفحص
        }

        Duration duration = Duration.between(time1, time2);
        long seconds = Math.abs(duration.getSeconds());
        if (seconds == 0) {
            return true; // حركة آنية لمسافة بعيدة = تزييف مؤكد
        }

        double hours = seconds / 3600.0;
        double speedKmph = distanceKm / hours;

        // إذا تجاوزت السرعة 150 كم/ساعة داخل الجامعة وفي وقت قصير، فهذا تلاعب
        return speedKmph > MAX_IMPOSSIBLE_SPEED_KMPH;
    }

    /**
     * تحويل المسافة من كيلومترات إلى أمتار
     */
    public Integer convertKmToMeters(Double km) {
        return km != null ? (int) (km * 1000) : null;
    }

    /**
     * تحويل المسافة من أمتار إلى كيلومترات
     */
    public Double convertMetersToKm(Integer meters) {
        return meters != null ? meters / 1000.0 : null;
    }

    /**
     * حساب درجة المخاطر لعملية الحضور (Risk Score Engine)
     * من 0 (موثوق تماماً) إلى 100 (مريب جداً وتلاعب محتمل)
     */
    public int calculateRiskScore(Double distanceKm, Double allowedRadiusKm, 
                                  Double gpsAccuracyMeters, Double velocityKmph,
                                  boolean isMocked, boolean isWifiVerification,
                                  boolean isDeviceChanged) {
        int score = 0;

        // 1. إذا كان الـ GPS يدعي تزييفاً (معلوماتية فقط ولكن تساهم بشكل كبير في المخاطر)
        if (isMocked) {
            score += 45;
        }

        // 2. دقة الـ GPS (كلما كانت الدقة سيئة، زادت المخاطر قليلاً لأنها قد تكون تشويش أو تزييف)
        if (gpsAccuracyMeters != null) {
            if (gpsAccuracyMeters > 30.0) {
                score += 15;
            } else if (gpsAccuracyMeters > 15.0) {
                score += 8;
            }
        }

        // 3. المسافة الفعلية عن حدود الملعب
        if (distanceKm != null && allowedRadiusKm != null) {
            double differenceMeters = (distanceKm - allowedRadiusKm) * 1000.0;
            if (differenceMeters > 50.0) {
                score += 30; // بعيد جداً عن نطاق الملعب
            } else if (differenceMeters > 15.0) {
                score += 20; // خارج النطاق بشكل متوسط
            } else if (differenceMeters > 0.0) {
                score += 10; // خارج النطاق بمسافة صغيرة
            }
        }

        // 4. السرعة المحسوبة بين الحجوزات (السرعة القريبة من الحد الأقصى ترفع المخاطر)
        if (velocityKmph != null) {
            if (velocityKmph > 120.0) {
                score += 25; // سرعة فائقة مريبة
            } else if (velocityKmph > 60.0) {
                score += 12; // سرعة سريعة جداً داخل الجامعة
            }
        }

        // 5. إذا تم التحقق عبر شبكة الواي فاي للجامعة بدلاً من الـ GPS
        if (isWifiVerification) {
            score += 15;
        }

        // 6. إذا كان هناك اختلاف في بصمة الجهاز المستخدم
        if (isDeviceChanged) {
            score += 20;
        }

        // التأكد من أن النتيجة محصورة بين 0 و 100
        return Math.max(0, Math.min(score, 100));
    }
}

