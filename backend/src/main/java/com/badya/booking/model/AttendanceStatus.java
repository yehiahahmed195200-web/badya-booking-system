package com.badya.booking.model;

public enum AttendanceStatus {
    NOT_CHECKED_IN("لم يتم تسجيل الحضور"),
    CHECKED_IN("تم تسجيل الحضور"),
    CHECKED_OUT("تم الانصراف"),
    NO_SHOW("لم يحضر"),
    CANCELLED_BEFORE_START("تم الإلغاء قبل البداية");

    private final String description;

    AttendanceStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
