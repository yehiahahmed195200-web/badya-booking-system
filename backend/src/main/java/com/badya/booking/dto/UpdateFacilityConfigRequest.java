package com.badya.booking.dto;

public record UpdateFacilityConfigRequest(
        String name,
        String category,
        Integer minParticipants,
        Integer maxParticipants,
        String openTime,
        String closeTime,
        String sports             // Comma-separated list: "Tennis,Basketball,Badminton"
) {}
