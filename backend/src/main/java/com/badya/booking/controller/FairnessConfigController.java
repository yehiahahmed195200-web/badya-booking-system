package com.badya.booking.controller;

import com.badya.booking.dto.UpdateFairnessConfigRequest;
import com.badya.booking.model.FairnessConfig;
import com.badya.booking.model.UserAccount;
import com.badya.booking.model.UserRole;
import com.badya.booking.repository.FairnessConfigRepository;
import com.badya.booking.repository.UserRepository;
import com.badya.booking.service.AuditLogService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/fairness-config")
public class FairnessConfigController {
    private final FairnessConfigRepository fairnessConfigRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    public FairnessConfigController(
            FairnessConfigRepository fairnessConfigRepository,
            UserRepository userRepository,
            AuditLogService auditLogService) {
        this.fairnessConfigRepository = fairnessConfigRepository;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
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
            Long userId = Long.parseLong(token.replace("demo-token-", ""));
            return userRepository.findById(userId)
                    .orElseThrow(() -> new IllegalArgumentException("Unauthorized: User not found."));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Unauthorized: Invalid token signature.");
        }
    }

    private FairnessConfig getOrCreateConfig() {
        return fairnessConfigRepository.findTopByOrderByIdAsc()
                .orElseGet(() -> {
                    FairnessConfig config = new FairnessConfig();
                    config.setPrimeTimeStartHour(17);
                    config.setPrimeTimeEndHour(21);
                    config.setBasketballQuotaPercent(60.0);
                    config.setVolleyballQuotaPercent(40.0);
                    config.setCooldownPeriodHours(24);
                    config.setMaxWeeklyReservationsPerUser(3);
                    config.setConsecutiveSlotLimit(2);
                    config.setTeamOverlapThresholdPercent(50.0);
                    config.setPlayerWeightCoeff(0.4);
                    config.setUnusedHoursWeightCoeff(0.3);
                    config.setPrimeTimeDisadvantageCoeff(0.3);
                    return fairnessConfigRepository.save(config);
                });
    }

    @GetMapping
    public ResponseEntity<?> getConfig(@RequestHeader("Authorization") String authHeader) {
        UserAccount admin = getCurrentAdmin(authHeader);
        if (admin == null) {
            return ResponseEntity.status(403).body(Map.of("message", "Forbidden"));
        }
        return ResponseEntity.ok(getOrCreateConfig());
    }

    @PutMapping
    public ResponseEntity<?> updateConfig(@RequestBody UpdateFairnessConfigRequest request, @RequestHeader("Authorization") String authHeader) {
        UserAccount admin = getCurrentAdmin(authHeader);
        if (admin == null) {
            return ResponseEntity.status(403).body(Map.of("message", "Forbidden"));
        }

        FairnessConfig config = getOrCreateConfig();

        double nextPlayerCoeff = request.playerWeightCoeff() != null ? request.playerWeightCoeff() : config.getPlayerWeightCoeff();
        double nextUnusedCoeff = request.unusedHoursWeightCoeff() != null ? request.unusedHoursWeightCoeff() : config.getUnusedHoursWeightCoeff();
        double nextPrimeCoeff = request.primeTimeDisadvantageCoeff() != null ? request.primeTimeDisadvantageCoeff() : config.getPrimeTimeDisadvantageCoeff();

        if (Math.abs((nextPlayerCoeff + nextUnusedCoeff + nextPrimeCoeff) - 1.0) > 0.02) {
            return ResponseEntity.status(400).body(Map.of("message", "Fairness scoring coefficients (player, unused, and prime time) must sum to approximately 1.0."));
        }

        if (request.primeTimeStartHour() != null) config.setPrimeTimeStartHour(request.primeTimeStartHour());
        if (request.primeTimeEndHour() != null) config.setPrimeTimeEndHour(request.primeTimeEndHour());
        if (request.basketballQuotaPercent() != null) config.setBasketballQuotaPercent(request.basketballQuotaPercent());
        if (request.volleyballQuotaPercent() != null) config.setVolleyballQuotaPercent(request.volleyballQuotaPercent());
        if (request.cooldownPeriodHours() != null) config.setCooldownPeriodHours(request.cooldownPeriodHours());
        if (request.maxWeeklyReservationsPerUser() != null) config.setMaxWeeklyReservationsPerUser(request.maxWeeklyReservationsPerUser());
        if (request.consecutiveSlotLimit() != null) config.setConsecutiveSlotLimit(request.consecutiveSlotLimit());
        if (request.teamOverlapThresholdPercent() != null) config.setTeamOverlapThresholdPercent(request.teamOverlapThresholdPercent());
        if (request.playerWeightCoeff() != null) config.setPlayerWeightCoeff(request.playerWeightCoeff());
        if (request.unusedHoursWeightCoeff() != null) config.setUnusedHoursWeightCoeff(request.unusedHoursWeightCoeff());
        if (request.primeTimeDisadvantageCoeff() != null) config.setPrimeTimeDisadvantageCoeff(request.primeTimeDisadvantageCoeff());

        FairnessConfig updated = fairnessConfigRepository.save(config);

        auditLogService.log(admin, "UPDATE_FAIRNESS_CONFIG", Map.of(
                "configId", updated.getId(),
                "playerWeightCoeff", updated.getPlayerWeightCoeff(),
                "unusedHoursWeightCoeff", updated.getUnusedHoursWeightCoeff(),
                "primeTimeDisadvantageCoeff", updated.getPrimeTimeDisadvantageCoeff()
        ));

        return ResponseEntity.ok(updated);
    }
}
