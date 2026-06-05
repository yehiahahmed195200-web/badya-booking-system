package com.badya.booking.controller;

import com.badya.booking.model.AuditLog;
import com.badya.booking.model.UserAccount;
import com.badya.booking.model.UserRole;
import com.badya.booking.repository.UserRepository;
import com.badya.booking.service.AuditLogService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/audit-logs")
public class AuditLogController {
    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private UserRepository userRepository;

    /**
     * GET /api/audit-logs?page=0&size=50
     * Get all audit logs (paginated)
     */
    @GetMapping
    public ResponseEntity<?> getAllLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        UserAccount admin = getCurrentAdmin();
        if (admin == null || !admin.getRole().name().equals("ADMIN")) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        Page<AuditLog> logs = auditLogService.getAllLogs(page, size);
        return ResponseEntity.ok(Map.of(
                "logs", logs.getContent(),
                "total", logs.getTotalElements(),
                "page", page,
                "size", size,
                "totalPages", logs.getTotalPages()
        ));
    }

    /**
     * GET /api/audit-logs/filter?action=BOOKING_APPROVED&page=0&size=50
     * Filter audit logs by action
     */
    @GetMapping("/filter")
    public ResponseEntity<?> filterLogs(
            @RequestParam(required = false) String action,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        UserAccount admin = getCurrentAdmin();
        if (admin == null || !admin.getRole().name().equals("ADMIN")) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        Page<AuditLog> logs;
        if (action != null && !action.isEmpty()) {
            logs = auditLogService.getLogsByAction(action, page, size);
        } else {
            logs = auditLogService.getAllLogs(page, size);
        }

        return ResponseEntity.ok(Map.of(
                "logs", logs.getContent(),
                "total", logs.getTotalElements(),
                "page", page,
                "size", size,
                "totalPages", logs.getTotalPages()
        ));
    }

    /**
     * GET /api/audit-logs/actions
     * Get list of all available audit log actions
     */
    @GetMapping("/actions")
    public ResponseEntity<?> getAvailableActions() {
        return ResponseEntity.ok(Map.of(
                "actions", new String[]{
                        "BOOKING_APPROVED",
                        "BOOKING_REJECTED",
                        "CONFLICT_RESOLVED",
                        "USER_WARNED",
                        "USER_BANNED",
                        "USER_UNBANNED",
                        "FACILITY_CREATED",
                        "FACILITY_UPDATED",
                        "FACILITY_DELETED",
                        "MEDICAL_RECORD_VIEWED",
                        "MEDICAL_RECORD_VIEWED_ALL",
                        "MEDICAL_RECORD_UPLOADED",
                        "MEDICAL_RECORD_STATUS_CHANGED",
                        "USER_CREDITS_ADJUSTED",
                        "SYSTEM_CREDITS_REPLENISHED"
                }
        ));
    }

    private UserAccount getCurrentAdmin() {
        // Temporary fallback until authentication context is wired.
        return userRepository.findAll().stream()
                .filter(u -> u.getRole() == UserRole.ADMIN)
                .findFirst()
                .orElse(null);
    }
}
