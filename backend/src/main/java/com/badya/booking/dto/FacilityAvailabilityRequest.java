package com.badya.booking.dto;

import jakarta.validation.constraints.Pattern;

public record FacilityAvailabilityRequest(
        String dayOfWeek,           // MONDAY, TUESDAY, ... SUNDAY
        
        @Pattern(regexp = "^([01]\\d|2[0-3]):([0-5]\\d)$", message = "Time must be HH:mm format")
        String startTime,           // 09:00
        
        @Pattern(regexp = "^([01]\\d|2[0-3]):([0-5]\\d)$", message = "Time must be HH:mm format")
        String endTime,             // 17:00
        
        Boolean available            // true if available, false if closed
) {}
