package com.badya.booking.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;
import java.time.LocalDateTime;

public record CreateWaitlistRequest(
        @NotNull Long userId,
        @NotNull Long facilityId,
        @NotNull LocalDateTime desiredStartTime,
        @Min(1) Integer participants
) {}
