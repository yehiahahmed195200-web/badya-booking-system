package com.badya.booking.model;

public enum VerificationMethod {
    GPS("نظام تحديد المواقع الجغرافي GPS"),
    GPS_FUZZY("حساب مرن لنطاق GPS"),
    CAMPUS_WIFI("واي فاي الجامعة (CAMPUS WIFI)"),
    ADMIN_OVERRIDE("تجاوز من قبل الإدارة");

    private final String description;

    VerificationMethod(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
