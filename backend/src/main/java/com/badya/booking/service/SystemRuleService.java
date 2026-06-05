package com.badya.booking.service;

import com.badya.booking.dto.UpdateSystemRuleRequest;
import com.badya.booking.model.SystemRule;
import com.badya.booking.repository.SystemRuleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SystemRuleService {
    private final SystemRuleRepository systemRuleRepository;

    public SystemRuleService(SystemRuleRepository systemRuleRepository) {
        this.systemRuleRepository = systemRuleRepository;
    }

    @Transactional
    public SystemRule getCurrentRules() {
        return systemRuleRepository.findTopByOrderByIdAsc()
                .orElseGet(() -> systemRuleRepository.save(new SystemRule()));
    }

    @Transactional
    public SystemRule updateRules(UpdateSystemRuleRequest request) {
        SystemRule rules = getCurrentRules();

        if (request.maxBookingsPerUserPerDay() != null) {
            validatePositive(request.maxBookingsPerUserPerDay(), "maxBookingsPerUserPerDay");
            rules.setMaxBookingsPerUserPerDay(request.maxBookingsPerUserPerDay());
        }
        if (request.autoBanWarningThreshold() != null) {
            validateNonNegative(request.autoBanWarningThreshold(), "autoBanWarningThreshold");
            rules.setAutoBanWarningThreshold(request.autoBanWarningThreshold());
        }
        if (request.advanceBookingWindowDays() != null) {
            validatePositive(request.advanceBookingWindowDays(), "advanceBookingWindowDays");
            rules.setAdvanceBookingWindowDays(request.advanceBookingWindowDays());
        }
        if (request.minBookingDurationMins() != null) {
            validatePositive(request.minBookingDurationMins(), "minBookingDurationMins");
            rules.setMinBookingDurationMins(request.minBookingDurationMins());
        }
        if (request.maxBookingDurationMins() != null) {
            validatePositive(request.maxBookingDurationMins(), "maxBookingDurationMins");
            rules.setMaxBookingDurationMins(request.maxBookingDurationMins());
        }
        if (request.priorityBookingEnabled() != null) {
            rules.setPriorityBookingEnabled(request.priorityBookingEnabled());
        }
        if (request.priorityScoreThreshold() != null) {
            validateNonNegative(request.priorityScoreThreshold(), "priorityScoreThreshold");
            rules.setPriorityScoreThreshold(request.priorityScoreThreshold());
        }
        if (request.priorityEarlyAccessHours() != null) {
            validateNonNegative(request.priorityEarlyAccessHours(), "priorityEarlyAccessHours");
            rules.setPriorityEarlyAccessHours(request.priorityEarlyAccessHours());
        }
        if (request.allowBackToBackBookings() != null) {
            rules.setAllowBackToBackBookings(request.allowBackToBackBookings());
        }
        if (request.globalEmailNotificationsEnabled() != null) {
            rules.setGlobalEmailNotificationsEnabled(request.globalEmailNotificationsEnabled());
        }

        if (rules.getMinBookingDurationMins() > rules.getMaxBookingDurationMins()) {
            throw new IllegalArgumentException("minBookingDurationMins cannot be greater than maxBookingDurationMins");
        }

        return systemRuleRepository.save(rules);
    }

    private void validatePositive(Integer value, String field) {
        if (value <= 0) {
            throw new IllegalArgumentException(field + " must be greater than 0");
        }
    }

    private void validateNonNegative(Integer value, String field) {
        if (value < 0) {
            throw new IllegalArgumentException(field + " cannot be negative");
        }
    }
}
