package com.badya.booking.controller;

import com.badya.booking.model.Notification;
import com.badya.booking.model.UserAccount;
import com.badya.booking.repository.NotificationRepository;
import com.badya.booking.repository.UserRepository;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    public NotificationController(NotificationRepository notificationRepository, UserRepository userRepository) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<?> getUserNotifications(@PathVariable @NonNull Long userId) {
        UserAccount user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<Notification> notifications = notificationRepository.findByUserOrderByCreatedAtDesc(user);
        return ResponseEntity.ok(notifications);
    }

    @GetMapping("/user/{userId}/unread")
    public ResponseEntity<?> getUnreadNotifications(@PathVariable @NonNull Long userId) {
        UserAccount user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<Notification> unread = notificationRepository.findByUserAndReadFalse(user);
        return ResponseEntity.ok(Map.of(
                "count", unread.size(),
                "notifications", unread));
    }

    @PutMapping("/{notificationId}/read")
    public ResponseEntity<?> markAsRead(@PathVariable @NonNull Long notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException("Notification not found"));

        notification.setRead(true);
        notificationRepository.save(notification);

        return ResponseEntity.ok(Map.of("success", true));
    }

    @PutMapping("/user/{userId}/read-all")
    public ResponseEntity<?> markAllAsRead(@PathVariable @NonNull Long userId) {
        UserAccount user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<Notification> unread = notificationRepository.findByUserAndReadFalse(user);
        for (Notification n : unread) {
            n.setRead(true);
        }
        notificationRepository.saveAll(unread);

        return ResponseEntity.ok(Map.of("success", true));
    }

    @PatchMapping("/{notificationId}/archive")
    public ResponseEntity<?> archiveNotification(@PathVariable @NonNull Long notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException("Notification not found"));

        notificationRepository.delete(notification);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/test-email")
    public ResponseEntity<?> sendTestEmail(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email is required"));
        }
        
        try {
            if (mailSender == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "JavaMailSender is not configured. Please configure SMTP properties in application.properties."));
            }
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setTo(email);
            msg.setSubject("Badya Sport Booking System - Test Connection Successful! 🎾");
            msg.setText("Hello Coach Yehia,\n\nThis is a live test email from the Badya Sport Booking System notification engine. Your automated email feature is fully configured and working perfectly!\n\nBest regards,\nSystem Core Admin");
            mailSender.send(msg);
            return ResponseEntity.ok(Map.of("success", true, "message", "Test email sent successfully to " + email));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to send email: " + ex.getMessage()));
        }
    }
}
