package com.badya.booking.service;

import org.springframework.stereotype.Service;

/**
 * خدمة حساب المسافات والتحقق من Geofencing
 */
@Service
public class GeofencingService {

    /**
     * حساب المسافة بين نقطتين باستخدام Haversine Formula
     * 
     * @param lat1 خط عرض الموقع الأول
     * @param lon1 خط طول الموقع الأول
     * @param lat2 خط عرض الموقع الثاني
     * @param lon2 خط طول الموقع الثاني
     * @return المسافة بالكيلومترات
     */
    public Double calculateDistance(Double lat1, Double lon1, Double lat2, Double lon2) {
        if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
            return null;
        }

        final int R = 6371; // نصف قطر الأرض بالكيلومترات

        Double latDistance = Math.toRadians(lat2 - lat1);
        Double lonDistance = Math.toRadians(lon2 - lon1);

        Double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);

        Double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
        return R * c; // المسافة بالكيلومترات
    }

    /**
     * التحقق من أن الطالب ضمن نطاق المنشأة (Geofence)
     * 
     * @param facilityLat خط عرض المنشأة
     * @param facilityLon خط طول المنشأة
     * @param studentLat خط عرض الطالب
     * @param studentLon خط طول الطالب
     * @param radiusKm نطاق الـ geofencing بالكيلومترات
     * @return true إذا كان الطالب ضمن النطاق المسموح
     */
    public Boolean isWithinGeofence(Double facilityLat, Double facilityLon, 
                                    Double studentLat, Double studentLon, 
                                    Double radiusKm) {
        if (facilityLat == null || facilityLon == null || 
            studentLat == null || studentLon == null || radiusKm == null) {
            return false;
        }

        Double distance = calculateDistance(facilityLat, facilityLon, studentLat, studentLon);
        return distance != null && distance <= radiusKm;
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
}
