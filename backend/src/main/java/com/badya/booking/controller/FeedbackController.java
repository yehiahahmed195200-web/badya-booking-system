package com.badya.booking.controller;

import com.badya.booking.dto.CreateFeedbackRequest;
import com.badya.booking.model.Feedback;
import com.badya.booking.model.FeedbackType;
import com.badya.booking.model.UserAccount;
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

    public FeedbackController(FeedbackRepository feedbackRepository, UserRepository userRepository) {
        this.feedbackRepository = feedbackRepository;
        this.userRepository = userRepository;
    }

    @PostMapping
    public ResponseEntity<?> submitFeedback(
            @RequestParam @NonNull Long userId,
            @Valid @RequestBody CreateFeedbackRequest request) {
        UserAccount user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Feedback feedback = new Feedback();
        feedback.setUser(user);
        feedback.setContent(request.content());
        feedback.setRating(request.rating());
        feedback.setType(FeedbackType.valueOf(request.type()));
        feedback.setCreatedAt(LocalDateTime.now());

        Feedback saved = feedbackRepository.save(feedback);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Feedback submitted successfully",
                "feedbackId", saved.getId()));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<?> getUserFeedback(@PathVariable @NonNull Long userId) {
        UserAccount user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<Feedback> feedbacks = feedbackRepository.findByUser(user);
        return ResponseEntity.ok(feedbacks);
    }
}
