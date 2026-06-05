package com.badya.booking.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record CreateFeedbackRequest(
        @NotBlank String content,
        @Min(1) @Max(5) Integer rating,
        @NotBlank String type
) {}
