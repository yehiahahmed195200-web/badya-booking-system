package com.badya.booking.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateFacilityStatusRequest(@NotNull Boolean active, String policy) {}
