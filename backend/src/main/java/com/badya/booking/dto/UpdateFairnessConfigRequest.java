package com.badya.booking.dto;

public record UpdateFairnessConfigRequest(
        Integer primeTimeStartHour,
        Integer primeTimeEndHour,
        Double basketballQuotaPercent,
        Double volleyballQuotaPercent,
        Integer cooldownPeriodHours,
        Integer maxWeeklyReservationsPerUser,
        Integer consecutiveSlotLimit,
        Double teamOverlapThresholdPercent,
        Double playerWeightCoeff,
        Double unusedHoursWeightCoeff,
        Double primeTimeDisadvantageCoeff
) {}
