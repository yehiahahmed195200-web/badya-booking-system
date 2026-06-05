package com.badya.booking.controller;

import com.badya.booking.dto.UpdateSystemRuleRequest;
import com.badya.booking.model.SystemRule;
import com.badya.booking.model.UserAccount;
import com.badya.booking.model.UserRole;
import com.badya.booking.repository.UserRepository;
import com.badya.booking.service.AuditLogService;
import com.badya.booking.service.SystemRuleService;
import java.time.LocalDateTime;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/system-rules")
public class SystemRuleController {
    private final SystemRuleService systemRuleService;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    public SystemRuleController(SystemRuleService systemRuleService, UserRepository userRepository, AuditLogService auditLogService) {
        this.systemRuleService = systemRuleService;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public ResponseEntity<?> getRules() {
        UserAccount admin = getCurrentAdmin();
        if (admin == null) {
            return ResponseEntity.status(403).body(Map.of("message", "Forbidden"));
        }
        return ResponseEntity.ok(systemRuleService.getCurrentRules());
    }

    @PatchMapping
    public ResponseEntity<?> updateRules(@RequestBody UpdateSystemRuleRequest request) {
        UserAccount admin = getCurrentAdmin();
        if (admin == null) {
            return ResponseEntity.status(403).body(Map.of("message", "Forbidden"));
        }

        SystemRule updated = systemRuleService.updateRules(request);
        auditLogService.log(admin, "SYSTEM_RULES_UPDATED", Map.of(
                "ruleId", updated.getId(),
                "updatedAt", LocalDateTime.now().toString(),
                "maxBookingsPerUserPerDay", updated.getMaxBookingsPerUserPerDay(),
                "advanceBookingWindowDays", updated.getAdvanceBookingWindowDays(),
                "durationRange", updated.getMinBookingDurationMins() + "-" + updated.getMaxBookingDurationMins(),
                "priorityBookingEnabled", updated.getPriorityBookingEnabled(),
                "allowBackToBackBookings", updated.getAllowBackToBackBookings(),
                "globalEmailNotificationsEnabled", updated.getGlobalEmailNotificationsEnabled()
        ));

        return ResponseEntity.ok(updated);
    }

    private UserAccount getCurrentAdmin() {
        return userRepository.findAll().stream()
                .filter(u -> u.getRole() == UserRole.ADMIN)
                .findFirst()
                .orElse(null);
    }
}
