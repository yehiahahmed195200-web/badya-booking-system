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
import com.badya.booking.model.ParticipantStatus;
import com.badya.booking.model.BookingParticipant;
import com.badya.booking.model.BookingEvent;
import com.badya.booking.repository.BookingParticipantRepository;
import com.badya.booking.repository.BookingEventRepository;
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

    @Autowired
    private BookingParticipantRepository bookingParticipantRepository;

    @Autowired
    private BookingEventRepository bookingEventRepository;

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
            return bookingRepository.findAllForUser(current.getId());
        } catch (IllegalArgumentException e) {
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

    @PostMapping("/{id}/respond-buddy")
    public ResponseEntity<?> respondBuddy(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body,
            @RequestHeader("Authorization") String authHeader) {
        UserAccount current = getAuthenticatedUser(authHeader);
        if (current == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        Boolean accept = body.get("accept");
        if (accept == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "accept field is required"));
        }

        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        if (booking.getStatus() != BookingStatus.RESERVED_PENDING_PLAYERS) {
            return ResponseEntity.badRequest().body(Map.of("error", "This booking is no longer pending teammate responses."));
        }

        // Verify expiration
        if (booking.getExpiryTime() != null && booking.getExpiryTime().isBefore(LocalDateTime.now())) {
            return ResponseEntity.badRequest().body(Map.of("error", "This booking invitation has expired."));
        }

        BookingParticipant participant = bookingParticipantRepository.findByBookingIdAndUserId(id, current.getId())
                .orElseThrow(() -> new IllegalArgumentException("You are not invited to this booking."));

        if (participant.getStatus() != ParticipantStatus.PENDING) {
            return ResponseEntity.badRequest().body(Map.of("error", "You have already responded to this invitation."));
        }

        if (accept) {
            // Check buddy credits
            if (current.getCredits() == null || current.getCredits() <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Insufficient credits. Your remaining credit balance is 0."));
            }

            // Deduct buddy credit
            current.setCredits(current.getCredits() - 1);
            userRepository.save(current);

            // Mark participant status
            participant.setStatus(ParticipantStatus.CONFIRMED);
            bookingParticipantRepository.save(participant);

            // Audit Event
            logEvent(booking.getId(), current.getId(), "INVITATION_ACCEPTED", current.getFullName() + " accepted the teammate invitation.");

            // Notify Booker
            String title = "✅ تم قبول دعوتك! (Buddy Accepted)";
            String message = current.getFullName() + " وافق على دعوة اللعب بملعب " + booking.getFacility().getName() + " يوم " + booking.getStartTime().toLocalDate() + ".";
            try {
                notificationService.sendInAppNotification(booking.getUser(), title, message, NotificationType.BOOKING_CONFIRMED);
            } catch (Exception e) {
                System.err.println("Failed to send notification: " + e.getMessage());
            }

            // Check if ALL participants are confirmed
            List<BookingParticipant> allParticipants = bookingParticipantRepository.findByBookingId(booking.getId());
            boolean allConfirmed = allParticipants.stream().allMatch(p -> p.getStatus() == ParticipantStatus.CONFIRMED);
            if (allConfirmed) {
                // Confirm booking
                booking.setStatus(BookingStatus.CONFIRMED);
                booking.setExpiryTime(null);
                bookingRepository.save(booking);

                // Booker's credit hold is finalized
                UserAccount booker = booking.getUser();
                if (booker.getReservedCredits() > 0) {
                    booker.setReservedCredits(booker.getReservedCredits() - 1);
                    userRepository.save(booker);
                }

                // Audit Event
                logEvent(booking.getId(), booker.getId(), "BOOKING_CONFIRMED", "All teammates accepted. Booking is confirmed.");

                // Notify booker and all participants
                String confTitle = "🎾 الحجز مؤكد بالكامل! (Booking Confirmed)";
                String confMessage = "تم تأكيد الحجز بالكامل لملعب " + booking.getFacility().getName() + " يوم " + booking.getStartTime().toLocalDate() + " الساعة " + booking.getStartTime().toLocalTime() + " بعد موافقة جميع زملائك.";
                try {
                    notificationService.sendInAppNotification(booker, confTitle, confMessage, NotificationType.BOOKING_CONFIRMED);
                    if (booker.getEmail() != null) {
                        notificationService.sendEmail(booker.getEmail(), confTitle, confMessage);
                    }
                } catch (Exception e) {
                    System.err.println("Failed to send notifications: " + e.getMessage());
                }

                for (BookingParticipant bp : allParticipants) {
                    UserAccount player = bp.getUser();
                    try {
                        notificationService.sendInAppNotification(player, confTitle, confMessage, NotificationType.BOOKING_CONFIRMED);
                        if (player.getEmail() != null) {
                            notificationService.sendEmail(player.getEmail(), confTitle, confMessage);
                        }
                    } catch (Exception e) {
                        System.err.println("Failed to send notification: " + e.getMessage());
                    }
                }
            }
        } else {
            // Reject invitation
            participant.setStatus(ParticipantStatus.REJECTED);
            bookingParticipantRepository.save(participant);

            // Audit Event
            logEvent(booking.getId(), current.getId(), "INVITATION_REJECTED", current.getFullName() + " rejected the teammate invitation.");

            // Cancel the booking immediately
            booking.setStatus(BookingStatus.CANCELLED);
            booking.setExpiryTime(null);
            bookingRepository.save(booking);

            // Refund Booker
            UserAccount booker = booking.getUser();
            booker.setCredits(booker.getCredits() + 1);
            if (booker.getReservedCredits() > 0) {
                booker.setReservedCredits(booker.getReservedCredits() - 1);
            }
            userRepository.save(booker);

            logEvent(booking.getId(), booker.getId(), "BOOKING_CANCELLED", "Booking cancelled due to teammate rejection.");
            logEvent(booking.getId(), booker.getId(), "REFUND_ISSUED", "Refunded 1 credit to booker due to teammate rejection.");

            // Notify Booker
            String title = "❌ تم رفض دعوتك (Buddy Declined)";
            String message = current.getFullName() + " اعتذر عن دعوة اللعب بملعب " + booking.getFacility().getName() + " يوم " + booking.getStartTime().toLocalDate() + ". تم إلغاء الحجز وإرجاع الرصيد لحسابك.";
            try {
                notificationService.sendInAppNotification(booker, title, message, NotificationType.BOOKING_CANCELLED);
            } catch (Exception e) {
                System.err.println("Failed to send notification: " + e.getMessage());
            }

            // Notify other participants of cancellation
            List<BookingParticipant> allParticipants = bookingParticipantRepository.findByBookingId(booking.getId());
            for (BookingParticipant bp : allParticipants) {
                if (bp.getId().equals(participant.getId())) continue;
                bp.setStatus(ParticipantStatus.REJECTED);
                bookingParticipantRepository.save(bp);

                UserAccount buddyUser = bp.getUser();
                if (buddyUser != null) {
                    String cancelTitle = "🚫 تم إلغاء حجز اللعبة (Invitation Cancelled)";
                    String cancelMsg = "تم إلغاء حجز اللعبة من " + booker.getFullName() + " بملعب " + booking.getFacility().getName() + " لأن أحد الزملاء اعتذر عن الحضور.";
                    try {
                        notificationService.sendInAppNotification(buddyUser, cancelTitle, cancelMsg, NotificationType.BOOKING_CANCELLED);
                    } catch (Exception e) {
                        System.err.println("Failed to send notification: " + e.getMessage());
                    }
                }
            }
        }

        return ResponseEntity.ok(Map.of("success", true, "bookingStatus", booking.getStatus()));
    }

    private void logEvent(Long bookingId, Long userId, String eventType, String details) {
        try {
            BookingEvent event = new BookingEvent();
            event.setBookingId(bookingId);
            event.setUserId(userId);
            event.setEventType(eventType);
            event.setDetails(details);
            bookingEventRepository.save(event);
        } catch (Exception ex) {
            System.err.println("Failed to log event: " + ex.getMessage());
        }
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
