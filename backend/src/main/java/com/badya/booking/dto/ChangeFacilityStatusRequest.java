package com.badya.booking.dto;

import jakarta.validation.constraints.NotBlank;

public record ChangeFacilityStatusRequest(
        @NotBlank(message = "Status is required")
        String status,  // OPEN, MAINTENANCE, TOURNAMENT

        String reason   // Optional reason for closure
) {}
