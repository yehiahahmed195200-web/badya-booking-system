package com.badya.booking.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

public record CreateBookingRequest(
        @NotNull Long userId,
        @NotNull Long facilityId,
        @NotNull LocalDateTime startTime,
        @Min(1) Integer participants,
        Integer durationMins,
        String scannedIdData,
        String sport,
        Boolean forceCancelOverlap) {}
