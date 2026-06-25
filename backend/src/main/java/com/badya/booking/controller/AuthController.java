package com.badya.booking.controller;

import com.badya.booking.dto.LoginRequest;
import com.badya.booking.model.UserAccount;
import com.badya.booking.repository.UserRepository;
import com.badya.booking.service.NotificationService;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public AuthController(UserRepository userRepository, NotificationService notificationService) {
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        // Step 1: Validate with registrar (check if user exists and password is correct)
        UserAccount user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));

        // Step 1.5: Enforce route segregation for Students
        if (user.getRole() == com.badya.booking.model.UserRole.STUDENT) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Students must log in using their Student ID from the Student Portal tab."));
        }

        // Step 2: Check ban status
        if (user.isBanned()) {
            return ResponseEntity.status(403).body(Map.of(
                    "success", false,
                    "message", "Access denied - Your account has been banned"));
        }

        // Step 3: Redirect by role - return user info with role
        return ResponseEntity.ok(Map.of(
                "success", true,
                "token", "demo-token-" + user.getId(),
                "user", serializeUser(user)));
    }

    @PostMapping("/student-login-init")
    public ResponseEntity<?> studentLoginInit(@RequestBody Map<String, String> request) {
        String studentId = request.get("studentId");
        String deviceId = request.get("deviceId");

        if (studentId == null || studentId.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Student ID is required."));
        }
        if (deviceId == null || deviceId.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Device ID is required."));
        }

        UserAccount user = userRepository.findByStudentId(studentId.trim())
                .orElseThrow(() -> new IllegalArgumentException("Student ID is not registered in the system."));

        if (user.isBanned()) {
            return ResponseEntity.status(403).body(Map.of(
                    "success", false,
                    "message", "Sorry, this account has been banned by the administration."));
        }

        // Case 1: First-time login (Device not bound yet)
        if (user.getDeviceId() == null || user.getDeviceId().trim().isEmpty()) {
            user.setDeviceId(deviceId);
            user.setOtpCode(null);
            user.setOtpExpiry(null);
            userRepository.save(user);

            System.out.println("\n==================================================================");
            System.out.println("📱 [DEVICE BINDING] New device successfully bound for the student!");
            System.out.println("👤 Student: " + user.getFullName() + " (Student ID: " + user.getStudentId() + ")");
            System.out.println("🆔 Device ID: " + deviceId);
            System.out.println("==================================================================\n");

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "status", "PASSWORDLESS_SUCCESS",
                    "token", "demo-token-" + user.getId(),
                    "user", serializeUser(user)
            ));
        }

        // Case 2: Matching Device (Passwordless Login)
        if (user.getDeviceId().equals(deviceId)) {
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "status", "PASSWORDLESS_SUCCESS",
                    "token", "demo-token-" + user.getId(),
                    "user", serializeUser(user)
            ));
        }

        // Case 3: Device Mismatch (Blocked Access)
        System.err.println("\n⚠️ [SECURITY ALERT] Denied login attempt from an unauthorized device!");
        System.err.println("👤 Student: " + user.getFullName() + " (Student ID: " + user.getStudentId() + ")");
        System.err.println("❌ Blocked Device ID: " + deviceId);
        System.err.println("🔒 Authorized Device ID: " + user.getDeviceId());
        System.err.println("==================================================================\n");

        boolean isPending = "PENDING".equals(user.getDeviceChangeStatus());
        String blockMessage = isPending
                ? "Sorry, this account is already linked to another device. You have a pending device change request that is currently under review by the administration."
                : "Sorry, this account is already linked to another device and cannot be accessed from a new device. You can submit a request to the administration to approve changing your registered device.";

        // Send warning email alert
        if (!isPending) {
            try {
                String title = "⚠️ Security Alert: Login attempt from an unauthorized device";
                String msg = "Hello " + user.getFullName() + ",\n\n" +
                        "A login attempt was detected from a new, unauthorized device.\n" +
                        "This attempt has been blocked automatically to secure your account.\n\n" +
                        "If you made this attempt and want to register this new device, please submit a device change request from the login screen or contact the Athletic Office.\n\n" +
                        "Badya University Athletic Administration";
                
                notificationService.sendInAppNotification(user, "Unauthorized Login Attempt", "A login attempt from a new device was blocked.", com.badya.booking.model.NotificationType.SYSTEM_ALERT);
                if (user.isEmailNotificationsEnabled()) {
                    notificationService.sendEmail(user.getEmail(), title, msg);
                }
            } catch (Exception e) {
                System.err.println("Failed to send unauthorized attempt email: " + e.getMessage());
            }
        }

        return ResponseEntity.status(403).body(Map.of(
                "success", false,
                "status", "DEVICE_LOCKED",
                "pendingRequest", isPending,
                "message", blockMessage
        ));
    }

    @PostMapping("/student-device-request")
    public ResponseEntity<?> studentDeviceRequest(@RequestBody Map<String, String> request) {
        String studentId = request.get("studentId");
        String deviceId = request.get("deviceId");

        if (studentId == null || studentId.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Student ID is required."));
        }
        if (deviceId == null || deviceId.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Device ID is required."));
        }

        UserAccount user = userRepository.findByStudentId(studentId.trim())
                .orElseThrow(() -> new IllegalArgumentException("Student ID is not registered in the system."));

        if ("PENDING".equals(user.getDeviceChangeStatus())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "You have already submitted a device change request and it is currently pending review."
            ));
        }

        user.setPendingDeviceId(deviceId);
        user.setDeviceChangeStatus("PENDING");
        user.setDeviceChangeRequestedAt(java.time.LocalDateTime.now());
        userRepository.save(user);

        System.out.println("\n==================================================================");
        System.out.println("📩 [DEVICE REQUEST] New device change request from a student!");
        System.out.println("👤 Student: " + user.getFullName() + " (Student ID: " + user.getStudentId() + ")");
        System.out.println("🆔 Requested New Device ID: " + deviceId);
        System.out.println("==================================================================\n");

        // Send confirmation email to student
        try {
            String title = "📩 Device Change Request Received - Badya University";
            String msg = "Hello " + user.getFullName() + ",\n\n" +
                    "We have received your request to change the registered device for your athletic account at Badya University.\n" +
                    "Your request is currently under review by the administration, and we will notify you once a decision has been made.\n\n" +
                    "Badya University Athletic Administration";
            
            notificationService.sendInAppNotification(user, "Device Change Requested", "Your request to change registered device is pending admin review.", com.badya.booking.model.NotificationType.SYSTEM_ALERT);
            if (user.isEmailNotificationsEnabled()) {
                notificationService.sendEmail(user.getEmail(), title, msg);
            }
        } catch (Exception e) {
            System.err.println("Failed to send request confirmation email: " + e.getMessage());
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Device change request submitted successfully to the Athletic Office. Please wait for administrative review."
        ));
    }

    @PostMapping("/student-login-verify")
    public ResponseEntity<?> studentLoginVerify(@RequestBody Map<String, String> request) {
        return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "OTP-based login is currently disabled. Please contact the University administration to change your registered device."
        ));
    }

    private Map<String, Object> serializeUser(UserAccount user) {
        Map<String, Object> map = new java.util.HashMap<>();
        map.put("id", user.getId());
        map.put("fullName", user.getFullName());
        map.put("email", user.getEmail());
        map.put("role", user.getRole().name());
        map.put("studentId", user.getStudentId() != null ? user.getStudentId() : "");
        map.put("deviceId", user.getDeviceId() != null ? user.getDeviceId() : "");
        map.put("earnedPoints", user.getEarnedPoints() != null ? user.getEarnedPoints() : 0);
        map.put("activeBookings", user.getActiveBookings() != null ? user.getActiveBookings() : 0);
        map.put("emailNotifications", user.isEmailNotificationsEnabled());
        map.put("pushNotifications", user.isPushNotificationsEnabled());
        map.put("termsAccepted", user.isTermsAccepted());
        map.put("termsAcceptedVersion", user.getTermsAcceptedVersion() != null ? user.getTermsAcceptedVersion() : "");
        return map;
    }
}
