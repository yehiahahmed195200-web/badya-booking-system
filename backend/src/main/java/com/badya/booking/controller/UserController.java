package com.badya.booking.controller;

import com.badya.booking.model.UserAccount;
import com.badya.booking.model.UserRole;
import com.badya.booking.repository.UserRepository;
import com.badya.booking.service.AuditLogService;
import com.badya.booking.service.CreditResetScheduler;
import com.badya.booking.service.NotificationService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserRepository userRepository;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private CreditResetScheduler creditResetScheduler;

    @Autowired
    private NotificationService notificationService;

    public UserController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<UserAccount> all() {
        return userRepository.findAll();
    }

    /**
     * GET /api/users/{userId}
     * Get user details
     */
    @GetMapping("/{userId}")
    public ResponseEntity<?> get(@PathVariable Long userId, @RequestHeader(value = "Authorization", required = false) String authHeader) {
        try {
            UserAccount current = getAuthenticatedUser(authHeader);
            // Allow admins to view any user; students can only view themselves
            if (current.getRole() != UserRole.ADMIN && !current.getId().equals(userId)) {
                return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            }
            UserAccount user = userRepository.findById(userId)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));
            return ResponseEntity.ok(user);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(401).body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * GET /api/users/barcode/{barcode}
     * Find user profile centrally by scanned barcode (FR-6.1, FR-6.3)
     */
    @GetMapping("/barcode/{barcode}")
    public ResponseEntity<?> getByBarcode(@PathVariable String barcode) {
        UserAccount user = userRepository.findByBarcode(barcode)
                .orElseThrow(() -> new IllegalArgumentException("User not found by barcode: " + barcode));
        return ResponseEntity.ok(user);
    }

    /**
     * GET /api/users/student-id/{studentId}
     * Find user profile centrally by scanned student ID (FR-6.1, FR-6.3)
     */
    @GetMapping("/student-id/{studentId}")
    public ResponseEntity<?> getByStudentId(@PathVariable String studentId) {
        UserAccount user = userRepository.findByStudentId(studentId)
                .orElseThrow(() -> new IllegalArgumentException("User not found by Student ID: " + studentId));
        return ResponseEntity.ok(user);
    }

    @PostMapping
    public UserAccount create(@Valid @RequestBody UserAccount user) {
        if (user.getRole() == null) {
            user.setRole(UserRole.STUDENT);
        }
        return userRepository.save(user);
    }

    /**
     * Admin endpoint to warn a user
     * POST /api/admin/users/{userId}/warn
     */
    @PostMapping("/admin/{userId}/warn")
    public ResponseEntity<?> warnUser(
            @PathVariable Long userId,
            @RequestBody Map<String, String> body) {
        UserAccount admin = getCurrentAdmin();
        if (admin == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        UserAccount user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String reason = body.getOrDefault("reason", "No reason provided");

        // Increment warnings
        user.setWarnings(user.getWarnings() + 1);
        if (user.getWarnings() >= 3) {
            user.setBanned(true);
            try {
                notificationService.sendBanNotification(user, "Exceeded warning threshold (3 warnings issued).", true);
            } catch (Exception ex) {
                System.err.println("Ban notification failed: " + ex.getMessage());
            }
        }
        userRepository.save(user);

        // Log the action
        auditLogService.log(admin, "USER_WARNED", Map.of(
                "userId", user.getId(),
                "userName", user.getFullName(),
                "reason", reason,
                "totalWarnings", user.getWarnings()
        ));

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "User warned",
                "totalWarnings", user.getWarnings()
        ));
    }

    /**
     * Admin endpoint to ban a user
     * POST /api/admin/users/{userId}/ban
     */
    @PostMapping("/admin/{userId}/ban")
    public ResponseEntity<?> banUser(
            @PathVariable Long userId,
            @RequestBody Map<String, String> body) {
        UserAccount admin = getCurrentAdmin();
        if (admin == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        UserAccount user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String reason = body.getOrDefault("reason", "No reason provided");

        user.setBanned(true);
        userRepository.save(user);

        // Send automated ban notification (FR-7.4)
        try {
            notificationService.sendBanNotification(user, reason, true);
        } catch (Exception ex) {
            System.err.println("Ban notification failed: " + ex.getMessage());
        }

        // Log the action
        auditLogService.log(admin, "USER_BANNED", Map.of(
                "userId", user.getId(),
                "userName", user.getFullName(),
                "reason", reason
        ));

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "User banned"
        ));
    }

    /**
     * Admin endpoint to unban a user
     * POST /api/admin/users/{userId}/unban
     */
    @PostMapping("/admin/{userId}/unban")
    public ResponseEntity<?> unbanUser(@PathVariable Long userId) {
        UserAccount admin = getCurrentAdmin();
        if (admin == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        UserAccount user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        user.setBanned(false);
        user.setWarnings(0);
        userRepository.save(user);

        // Log the action
        auditLogService.log(admin, "USER_UNBANNED", Map.of(
                "userId", user.getId(),
                "userName", user.getFullName()
        ));

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "User unbanned"
        ));
    }

    /**
     * Admin endpoint to adjust user credits
     * POST /api/users/admin/{userId}/adjust-credits
     */
    @PostMapping("/admin/{userId}/adjust-credits")
    public ResponseEntity<?> adjustCredits(
            @PathVariable Long userId,
            @RequestBody Map<String, Integer> body) {
        UserAccount admin = getCurrentAdmin();
        if (admin == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        UserAccount user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (!body.containsKey("credits")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing 'credits' field"));
        }

        Integer newCredits = body.get("credits");
        if (newCredits == null || newCredits < 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Credits must be a positive integer"));
        }

        Integer oldCredits = user.getCredits();
        user.setCredits(newCredits);
        userRepository.save(user);

        // Log the action
        auditLogService.log(admin, "USER_CREDITS_ADJUSTED", Map.of(
                "userId", user.getId(),
                "userName", user.getFullName(),
                "oldCredits", oldCredits != null ? oldCredits : 10,
                "newCredits", newCredits
        ));

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "User credits adjusted successfully",
                "userId", user.getId(),
                "newCredits", newCredits
        ));
    }

    /**
     * Admin endpoint to reset user device binding
     * POST /api/users/admin/{userId}/reset-device
     */
    @PostMapping("/admin/{userId}/reset-device")
    public ResponseEntity<?> resetDevice(@PathVariable Long userId) {
        UserAccount admin = getCurrentAdmin();
        if (admin == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        UserAccount user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        user.setDeviceId(null);
        user.setPendingDeviceId(null);
        user.setDeviceChangeStatus(null);
        user.setOtpCode(null);
        user.setOtpExpiry(null);
        userRepository.save(user);

        // Log the action
        auditLogService.log(admin, "USER_DEVICE_RESET", Map.of(
                "userId", user.getId(),
                "userName", user.getFullName(),
                "studentId", user.getStudentId() != null ? user.getStudentId() : "N/A"
        ));

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "User device binding reset successfully",
                "userId", user.getId()
        ));
    }

    /**
     * Admin endpoint to approve a pending device change request
     * POST /api/users/admin/{userId}/approve-device-change
     */
    @PostMapping("/admin/{userId}/approve-device-change")
    public ResponseEntity<?> approveDeviceChange(@PathVariable Long userId) {
        UserAccount admin = getCurrentAdmin();
        if (admin == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        UserAccount user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (!"PENDING".equals(user.getDeviceChangeStatus()) && !"SUMMONED".equals(user.getDeviceChangeStatus())) {
            return ResponseEntity.badRequest().body(Map.of("error", "No pending device change request found for this user"));
        }

        String oldDeviceId = user.getDeviceId();
        String newDeviceId = user.getPendingDeviceId();

        // Approve: bind new device, clear pending request
        user.setDeviceId(newDeviceId);
        user.setPendingDeviceId(null);
        user.setDeviceChangeStatus("APPROVED");
        user.setOtpCode(null);
        user.setOtpExpiry(null);
        userRepository.save(user);

        // Audit log
        auditLogService.log(admin, "USER_DEVICE_CHANGE_APPROVED", Map.of(
                "userId", user.getId(),
                "userName", user.getFullName(),
                "oldDeviceId", oldDeviceId != null ? oldDeviceId : "None",
                "newDeviceId", newDeviceId != null ? newDeviceId : "None"
        ));

        // Send congratulations email
        try {
            String title = "✅ Approved: Device Change for Athletic Account - Badya University";
            String msg = "Hello " + user.getFullName() + ",\n\n" +
                    "We are pleased to inform you that the Athletic Office has approved your request to change your registered device.\n" +
                    "Your new device has been successfully bound, and you can now log in directly and securely from your new phone.\n\n" +
                    "Badya University Athletic Administration";
            notificationService.sendInAppNotification(user, "Device Change Approved", "Your request to change registered device has been approved.", com.badya.booking.model.NotificationType.SYSTEM_ALERT);
            if (user.isEmailNotificationsEnabled()) {
                notificationService.sendEmail(user.getEmail(), title, msg);
            }
        } catch (Exception e) {
            System.err.println("Failed to send device change approval email: " + e.getMessage());
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Student device change request approved successfully, and the new device has been bound.",
                "userId", user.getId()
        ));
    }

    /**
     * Admin endpoint to reject a pending device change request
     * POST /api/users/admin/{userId}/reject-device-change
     */
    @PostMapping("/admin/{userId}/reject-device-change")
    public ResponseEntity<?> rejectDeviceChange(@PathVariable Long userId) {
        UserAccount admin = getCurrentAdmin();
        if (admin == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        UserAccount user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (!"PENDING".equals(user.getDeviceChangeStatus()) && !"SUMMONED".equals(user.getDeviceChangeStatus())) {
            return ResponseEntity.badRequest().body(Map.of("error", "No pending device change request found for this user"));
        }

        // Reject: clear request
        user.setPendingDeviceId(null);
        user.setDeviceChangeStatus("REJECTED");
        userRepository.save(user);

        // Audit log
        auditLogService.log(admin, "USER_DEVICE_CHANGE_REJECTED", Map.of(
                "userId", user.getId(),
                "userName", user.getFullName()
        ));

        // Send rejection email
        try {
            String title = "❌ Rejected: Device Change Request - Badya University";
            String msg = "Hello " + user.getFullName() + ",\n\n" +
                    "We regret to inform you that your request to change the registered device for your athletic account has been rejected by the administration.\n" +
                    "Please visit the Athletic Office if you have any questions or need to provide further details.\n\n" +
                    "Badya University Athletic Administration";
            notificationService.sendInAppNotification(user, "Device Change Rejected", "Your request to change registered device was rejected.", com.badya.booking.model.NotificationType.SYSTEM_ALERT);
            if (user.isEmailNotificationsEnabled()) {
                notificationService.sendEmail(user.getEmail(), title, msg);
            }
        } catch (Exception e) {
            System.err.println("Failed to send device change rejection email: " + e.getMessage());
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Student device change request rejected successfully.",
                "userId", user.getId()
        ));
    }

    /**
     * Admin endpoint to summon a student for verification
     * POST /api/users/admin/{userId}/summon-device-change
     */
    @PostMapping("/admin/{userId}/summon-device-change")
    public ResponseEntity<?> summonDeviceChange(@PathVariable Long userId) {
        UserAccount admin = getCurrentAdmin();
        if (admin == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        UserAccount user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (!"PENDING".equals(user.getDeviceChangeStatus())) {
            return ResponseEntity.badRequest().body(Map.of("error", "No pending device change request found for this user"));
        }

        // Set status to SUMMONED
        user.setDeviceChangeStatus("SUMMONED");
        userRepository.save(user);

        // Audit log
        auditLogService.log(admin, "USER_DEVICE_CHANGE_SUMMONED", Map.of(
                "userId", user.getId(),
                "userName", user.getFullName()
        ));

        // Send summon email ("تعالا")
        try {
            String title = "📞 Action Required: Visit the Athletic Office - Badya University";
            String msg = "Hello " + user.getFullName() + ",\n\n" +
                    "Please visit the Athletic Office in person, bringing your student ID card and your new phone, to complete the verification and register your new device.\n\n" +
                    "Thank you for your cooperation.\n" +
                    "Badya University Athletic Administration";
            notificationService.sendInAppNotification(user, "Verification Required", "Please visit the athletic office with your new device.", com.badya.booking.model.NotificationType.SYSTEM_ALERT);
            if (user.isEmailNotificationsEnabled()) {
                notificationService.sendEmail(user.getEmail(), title, msg);
            }
        } catch (Exception e) {
            System.err.println("Failed to send summoning email: " + e.getMessage());
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Student has been summoned to the Athletic Office for in-person verification.",
                "userId", user.getId()
        ));
    }


    /**
     * Admin endpoint to reset all student credits to default allowance (10)
     * POST /api/users/admin/reset-all-credits
     */
    @PostMapping("/admin/reset-all-credits")
    public ResponseEntity<?> resetAllCredits() {
        UserAccount admin = getCurrentAdmin();
        if (admin == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        int updatedCount = creditResetScheduler.replenishAllStudentCredits(admin);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "All student credits reset to weekly default allowance (10)",
                "updatedCount", updatedCount
        ));
    }

    private UserAccount getCurrentAdmin() {
        return userRepository.findAll().stream()
                .filter(u -> u.getRole() == UserRole.ADMIN)
                .findFirst()
                .orElse(null);
    }

    /**
     * Simple token verification and user loading (compatible with demo tokens)
     */
    private UserAccount getAuthenticatedUser(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new IllegalArgumentException("Unauthorized: Missing bearer token.");
        }
        String token = authHeader.replace("Bearer ", "").trim();
        if (!token.startsWith("demo-token-")) {
            throw new IllegalArgumentException("Unauthorized: Invalid token format.");
        }
        try {
            Long userId = Long.parseLong(token.replace("demo-token-", ""));
            return userRepository.findById(userId)
                    .orElseThrow(() -> new IllegalArgumentException("Unauthorized: User not found."));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Unauthorized: Invalid token signature.");
        }
    }
}
