package com.badya.booking.controller;

import com.badya.booking.dto.CreateBookingRequest;
import com.badya.booking.model.Booking;
import com.badya.booking.model.BookingStatus;
import com.badya.booking.model.Notification;
import com.badya.booking.model.NotificationType;
import com.badya.booking.model.UserAccount;
import com.badya.booking.model.UserRole;
import com.badya.booking.repository.BookingRepository;
import com.badya.booking.repository.NotificationRepository;
import com.badya.booking.repository.UserRepository;
import com.badya.booking.service.BookingService;
import com.badya.booking.service.AuditLogService;
import com.badya.booking.service.NotificationService;
import jakarta.validation.Valid;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/bookings")
public class BookingController {
    private final BookingService bookingService;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private NotificationService notificationService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @GetMapping
    public List<Booking> all(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        try {
            UserAccount current = getAuthenticatedUser(authHeader);
            if (current.getRole() == UserRole.ADMIN) {
                return bookingService.all();
            }
            // Return only bookings belonging to the authenticated user via direct repository query
            return bookingRepository.findByUserId(current.getId());
        } catch (IllegalArgumentException e) {
            // If no valid auth header present, default to empty list for safety
            return List.of();
        }
    }

    @PostMapping
    public Booking create(@Valid @RequestBody CreateBookingRequest request) {
        Booking b = bookingService.create(request);
        try {
            // Send confirmation to user and notify relevant coach and admins (FR-7.1)
            notificationService.sendBookingConfirmed(b, true, true, true);
        } catch (Exception ex) {
            System.err.println("Notification send failed: " + ex.getMessage());
        }
        return b;
    }

    @PatchMapping("/{id}/cancel")
    public Booking cancel(@PathVariable Long id) {
        return bookingService.cancel(id);
    }

    /**
     * Admin endpoint to approve a booking
     * POST /api/bookings/admin/{id}/approve
     */
    @PostMapping("/admin/{id}/approve")
    public ResponseEntity<?> adminApprove(@PathVariable Long id, @RequestHeader("Authorization") String authHeader) {
        UserAccount admin = getCurrentAdmin(authHeader);
        if (admin == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setConflictId(null);
        bookingRepository.save(booking);

        // Notify user about approval (FR-7.4)
        try {
            notificationService.sendBookingConfirmed(booking, false, false, true);
        } catch (Exception ex) {
            System.err.println("Approval notification failed: " + ex.getMessage());
        }

        // Log the action
        auditLogService.log(admin, "BOOKING_APPROVED", Map.of(
                "bookingId", booking.getId(),
                "userId", booking.getUser().getId(),
                "facilityId", booking.getFacility().getId(),
                "userName", booking.getUser().getFullName()
        ));

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Booking approved and logged"
        ));
    }

    /**
     * Admin endpoint to reject a booking
     * POST /api/bookings/admin/{id}/reject
     */
    @PostMapping("/admin/{id}/reject")
    public ResponseEntity<?> adminReject(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @RequestHeader("Authorization") String authHeader) {
        UserAccount admin = getCurrentAdmin(authHeader);
        if (admin == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        String reason = body.getOrDefault("reason", "No reason provided");

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setConflictId(null);
        bookingRepository.save(booking);

        // Send automated rejection notification to user with reason (FR-7.4)
        try {
            notificationService.sendRejectionNotification(booking, reason, true);
        } catch (Exception ex) {
            System.err.println("Rejection notification failed: " + ex.getMessage());
        }

        // Log the action
        auditLogService.log(admin, "BOOKING_REJECTED", Map.of(
                "bookingId", booking.getId(),
                "userId", booking.getUser().getId(),
                "facilityId", booking.getFacility().getId(),
                "userName", booking.getUser().getFullName(),
                "reason", reason
        ));

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Booking rejected and logged"
        ));
    }

    /**
     * Admin endpoint to list active booking conflicts
     * GET /api/bookings/admin/conflicts
     */
    @GetMapping("/admin/conflicts")
    public ResponseEntity<?> listConflicts(@RequestHeader("Authorization") String authHeader) {
        UserAccount admin = getCurrentAdmin(authHeader);
        if (admin == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        Map<String, List<Booking>> grouped = bookingRepository.findAll().stream()
            .filter(b -> b.getConflictId() != null && !b.getConflictId().isBlank())
            .filter(b -> b.getStatus() == BookingStatus.CONFIRMED)
            .collect(Collectors.groupingBy(Booking::getConflictId));

        List<Map<String, Object>> conflicts = grouped.entrySet().stream()
            .filter(entry -> entry.getValue().size() >= 2)
            .map(entry -> {
                List<Booking> entries = entry.getValue().stream()
                    .sorted((a, b) -> a.getCreatedAt().compareTo(b.getCreatedAt()))
                    .toList();
                Booking first = entries.get(0);
                LocalDateTime detectedAt = entries.stream()
                    .map(Booking::getCreatedAt)
                    .filter(Objects::nonNull)
                    .min(LocalDateTime::compareTo)
                    .orElse(LocalDateTime.now());

                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", entry.getKey());
                item.put("createdAt", detectedAt);
                item.put("description", "Overlapping submissions for " + first.getFacility().getName());
                item.put("bookings", entries);
                return item;
            })
            .sorted((a, b) -> ((LocalDateTime) b.get("createdAt")).compareTo((LocalDateTime) a.get("createdAt")))
            .toList();

        return ResponseEntity.ok(conflicts);
    }

    /**
     * Admin endpoint to resolve an existing conflict by keeping one booking and cancelling the other.
     * POST /api/bookings/admin/conflicts/{conflictId}/resolve
     */
    @PostMapping("/admin/conflicts/{conflictId}/resolve")
    public ResponseEntity<?> resolveConflict(
            @PathVariable String conflictId,
            @RequestBody Map<String, Long> body,
            @RequestHeader("Authorization") String authHeader) {
        UserAccount admin = getCurrentAdmin(authHeader);
        if (admin == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }

        Long approvedBookingId = body.get("approvedBookingId");
        if (approvedBookingId == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "approvedBookingId is required"));
        }

        List<Booking> conflictBookings = bookingRepository.findByConflictIdAndStatusOrderByCreatedAtAsc(conflictId, BookingStatus.CONFIRMED);
        if (conflictBookings.size() < 2) {
            return ResponseEntity.badRequest().body(Map.of("message", "Conflict not found or already resolved"));
        }

        Booking approved = conflictBookings.stream()
            .filter(b -> b.getId().equals(approvedBookingId))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Approved booking is not part of this conflict"));

        List<Long> rejectedBookingIds = new ArrayList<>();
        List<Long> rejectedUserIds = new ArrayList<>();

        approved.setStatus(BookingStatus.CONFIRMED);
        approved.setConflictId(null);
        bookingRepository.save(approved);

        for (Booking loser : conflictBookings) {
            if (loser.getId().equals(approved.getId())) {
                continue;
            }

            loser.setStatus(BookingStatus.CANCELLED);
            loser.setConflictId(null);
            bookingRepository.save(loser);

            rejectedBookingIds.add(loser.getId());
            rejectedUserIds.add(loser.getUser().getId());

            // Automated conflict resolution notification (FR-7.3, FR-7.4)
            try {
                notificationService.sendRejectionNotification(loser, "Overlapping booking conflict resolved by admin", true);
            } catch (Exception ex) {
                System.err.println("Conflict rejection notification failed: " + ex.getMessage());
            }
        }

        // Notify winner (FR-7.3)
        try {
            notificationService.sendBookingConfirmed(approved, false, false, true);
        } catch (Exception ex) {
            System.err.println("Conflict approval notification failed: " + ex.getMessage());
        }

        auditLogService.log(admin, "CONFLICT_RESOLVED", Map.of(
                "conflictId", conflictId,
                "facilityId", approved.getFacility().getId(),
                "approvedBookingId", approved.getId(),
                "rejectedBookingIds", rejectedBookingIds,
                "approvedUserId", approved.getUser().getId(),
                "rejectedUserIds", rejectedUserIds,
                "resolvedAt", LocalDateTime.now().toString()
        ));

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Conflict resolved successfully"
        ));
    }

    private UserAccount getCurrentAdmin(String authHeader) {
        try {
            UserAccount current = getAuthenticatedUser(authHeader);
            if (current != null && current.getRole() == UserRole.ADMIN) {
                return current;
            }
        } catch (Exception e) {
            // ignore
        }
        return null;
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
