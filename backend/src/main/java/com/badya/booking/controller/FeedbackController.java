package com.badya.booking.controller;

import com.badya.booking.dto.CreateFeedbackRequest;
import com.badya.booking.model.Facility;
import com.badya.booking.model.Feedback;
import com.badya.booking.model.FeedbackType;
import com.badya.booking.model.UserAccount;
import com.badya.booking.model.UserRole;
import com.badya.booking.repository.FacilityRepository;
import com.badya.booking.repository.FeedbackRepository;
import com.badya.booking.repository.UserRepository;
import jakarta.validation.Valid;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/feedback")
public class FeedbackController {
    private final FeedbackRepository feedbackRepository;
    private final UserRepository userRepository;
    private final FacilityRepository facilityRepository;

    public FeedbackController(
            FeedbackRepository feedbackRepository,
            UserRepository userRepository,
            FacilityRepository facilityRepository) {
        this.feedbackRepository = feedbackRepository;
        this.userRepository = userRepository;
        this.facilityRepository = facilityRepository;
    }

    @PostMapping
    public ResponseEntity<?> submitFeedback(
            @RequestParam(name = "userId", required = false) Long userId,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @Valid @RequestBody CreateFeedbackRequest request) {
        
        UserAccount user = null;
        if (userId != null) {
            user = userRepository.findById(userId).orElse(null);
        }
        if (user == null && authHeader != null) {
            try {
                user = getAuthenticatedUser(authHeader);
            } catch (Exception e) {
                // ignore
            }
        }
        
        if (user == null) {
            throw new IllegalArgumentException("User not found or unauthorized");
        }

        if (request.getFacilityId() == null) {
            throw new IllegalArgumentException("facilityId is required");
        }
        Facility facility = facilityRepository.findById(request.getFacilityId())
                .orElseThrow(() -> new IllegalArgumentException("Facility not found"));

        String content = request.getContent();
        if (content == null || content.trim().isEmpty()) {
            throw new IllegalArgumentException("Content/comment is required");
        }

        FeedbackType feedbackType = FeedbackType.GENERAL_FEEDBACK;
        if (request.getType() != null) {
            try {
                feedbackType = FeedbackType.valueOf(request.getType());
            } catch (IllegalArgumentException e) {
                // fallback
            }
        } else if (request.getFacilityId() != null) {
            feedbackType = FeedbackType.FACILITY_REVIEW;
        }

        Feedback feedback = new Feedback();
        feedback.setUser(user);
        feedback.setFacility(facility);
        feedback.setBookingId(request.getBookingId());
        feedback.setContent(content);
        feedback.setRating(request.getRating());
        feedback.setType(feedbackType);
        feedback.setCreatedAt(LocalDateTime.now());

        Feedback saved = feedbackRepository.save(feedback);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Feedback submitted successfully",
                "feedbackId", saved.getId()));
    }

    @GetMapping
    public ResponseEntity<?> getAllFeedback(@RequestHeader("Authorization") String authHeader) {
        UserAccount admin = getCurrentAdmin(authHeader);
        if (admin == null) {
            throw new IllegalArgumentException("Unauthorized: Admin privilege required.");
        }
        List<Feedback> feedbacks = feedbackRepository.findAll(
                org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt")
        );
        return ResponseEntity.ok(feedbacks);
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<?> getUserFeedback(@PathVariable @NonNull Long userId) {
        UserAccount user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<Feedback> feedbacks = feedbackRepository.findByUser(user);
        return ResponseEntity.ok(feedbacks);
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

    private UserAccount getAuthenticatedUser(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new IllegalArgumentException("Unauthorized: Missing bearer token.");
        }
        String token = authHeader.replace("Bearer ", "").trim();
        if (!token.startsWith("demo-token-")) {
            throw new IllegalArgumentException("Unauthorized: Invalid token format.");
        }
        try {
            Long parsedUserId = Long.parseLong(token.replace("demo-token-", ""));
            return userRepository.findById(parsedUserId)
                    .orElseThrow(() -> new IllegalArgumentException("Unauthorized: User not found."));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Unauthorized: Invalid token signature.");
        }
    }
}
