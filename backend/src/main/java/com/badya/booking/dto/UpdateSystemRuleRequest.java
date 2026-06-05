package com.badya.booking.dto;

public record UpdateSystemRuleRequest(
        Integer maxBookingsPerUserPerDay,
        Integer autoBanWarningThreshold,
        Integer advanceBookingWindowDays,
        Integer minBookingDurationMins,
        Integer maxBookingDurationMins,
        Boolean priorityBookingEnabled,
        Integer priorityScoreThreshold,
        Integer priorityEarlyAccessHours,
        Boolean allowBackToBackBookings,
        Boolean globalEmailNotificationsEnabled) {
}
