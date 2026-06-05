package com.badya.booking.controller;

import com.badya.booking.model.Booking;
import com.badya.booking.model.BookingParticipant;
import com.badya.booking.model.Facility;
import com.badya.booking.model.MatchmakingQueue;
import com.badya.booking.model.UserAccount;
import com.badya.booking.repository.BookingParticipantRepository;
import com.badya.booking.repository.BookingRepository;
import com.badya.booking.repository.FacilityRepository;
import com.badya.booking.repository.MatchmakingQueueRepository;
import com.badya.booking.repository.UserRepository;
import com.badya.booking.service.MatchmakingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/matchmaking")
public class MatchmakingController {

    private final MatchmakingService matchmakingService;
    private final FacilityRepository facilityRepository;
    private final MatchmakingQueueRepository matchmakingQueueRepository;
    private final BookingParticipantRepository bookingParticipantRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;

    public MatchmakingController(
            MatchmakingService matchmakingService,
            FacilityRepository facilityRepository,
            MatchmakingQueueRepository matchmakingQueueRepository,
            BookingParticipantRepository bookingParticipantRepository,
            BookingRepository bookingRepository,
            UserRepository userRepository
    ) {
        this.matchmakingService = matchmakingService;
        this.facilityRepository = facilityRepository;
        this.matchmakingQueueRepository = matchmakingQueueRepository;
        this.bookingParticipantRepository = bookingParticipantRepository;
        this.bookingRepository = bookingRepository;
        this.userRepository = userRepository;
    }

    public record JoinQueueRequest(String sportId, Long facilityId, String date, String timeSlot) {}
    public record LeaveQueueRequest(String sportId, String date, String timeSlot) {}

    private String getSportIcon(String sport) {
        if (sport == null) return "🏅";
        if (sport.toLowerCase().contains("basketball")) return "🏀";
        if (sport.toLowerCase().contains("volleyball")) return "🏐";
        if (sport.toLowerCase().contains("tennis")) return "🎾";
        if (sport.toLowerCase().contains("fitness") || sport.toLowerCase().contains("gym")) return "💪";
        return "🏅";
    }

    private int getIdealParticipants(String sport) {
        if (sport == null) return 10;
        if (sport.toLowerCase().contains("basketball")) return 10;
        if (sport.toLowerCase().contains("volleyball")) return 12;
        if (sport.toLowerCase().contains("tennis")) return 4;
        return 10;
    }

    @GetMapping("/options")
    public List<Map<String, Object>> getOptions(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        getAuthenticatedUser(authHeader); // Validate user

        List<Facility> facilities = facilityRepository.findAll().stream()
                .filter(f -> Boolean.TRUE.equals(f.getActive()))
                .filter(f -> "OPEN".equalsIgnoreCase(f.getStatus()))
                .filter(f -> f.getSports() != null && !f.getSports().isBlank())
                .collect(Collectors.toList());

        List<Map<String, Object>> options = new ArrayList<>();
        for (Facility f : facilities) {
            String[] sports = f.getSports().split(",");
            for (String s : sports) {
                String sportName = s.trim();
                if (!sportName.isEmpty()) {
                    Map<String, Object> opt = new LinkedHashMap<>();
                    opt.put("facilityId", f.getId());
                    opt.put("facilityName", f.getName());
                    opt.put("sportId", sportName);
                    opt.put("sportName", sportName);
                    opt.put("icon", getSportIcon(sportName));
                    opt.put("minParticipants", f.getMinParticipants() != null ? f.getMinParticipants() : 6);
                    opt.put("idealParticipants", getIdealParticipants(sportName));
                    opt.put("openTime", f.getOpenTime());
                    opt.put("closeTime", f.getCloseTime());
                    opt.put("defaultSlotMins", f.getDefaultSlotMins() != null ? f.getDefaultSlotMins() : 60);
                    options.add(opt);
                }
            }
        }

        return options;
    }

    @PostMapping("/join")
    public ResponseEntity<?> joinQueue(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody JoinQueueRequest body
    ) {
        UserAccount current = getAuthenticatedUser(authHeader);
        try {
            MatchmakingQueue queueEntry = matchmakingService.joinQueue(
                    current.getId(),
                    body.sportId(),
                    body.facilityId(),
                    body.date(),
                    body.timeSlot()
            );
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Successfully joined the queue",
                    "queueEntry", queueEntry
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/leave")
    public ResponseEntity<?> leaveQueue(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody LeaveQueueRequest body
    ) {
        UserAccount current = getAuthenticatedUser(authHeader);
        try {
            matchmakingService.leaveQueue(
                    current.getId(),
                    body.sportId(),
                    body.date(),
                    body.timeSlot()
            );
            return ResponseEntity.ok(Map.of("success", true, "message", "Left queue successfully"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/status")
    public ResponseEntity<?> getQueueStatus(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam String sportId,
            @RequestParam Long facilityId,
            @RequestParam String date,
            @RequestParam String timeSlot
    ) {
        getAuthenticatedUser(authHeader);
        try {
            MatchmakingService.QueueStatusResponse status = matchmakingService.getQueueStatus(sportId, facilityId, date, timeSlot);
            return ResponseEntity.ok(status);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/my-queues")
    public List<Map<String, Object>> getMyQueues(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        UserAccount current = getAuthenticatedUser(authHeader);
        List<MatchmakingQueue> queues = matchmakingQueueRepository.findByUserId(current.getId());

        List<Map<String, Object>> result = new ArrayList<>();
        for (MatchmakingQueue q : queues) {
            Map<String, Object> qMap = new LinkedHashMap<>();
            qMap.put("id", q.getId());
            qMap.put("sportId", q.getSportId());
            qMap.put("date", q.getDate());
            qMap.put("timeSlot", q.getTimeSlot());

            Map<String, Object> sportMap = new HashMap<>();
            sportMap.put("name", q.getSportId());
            sportMap.put("icon", getSportIcon(q.getSportId()));
            qMap.put("sport", sportMap);

            Map<String, Object> facilityMap = new HashMap<>();
            facilityMap.put("name", q.getFacility().getName());
            qMap.put("facility", facilityMap);

            // Compute dynamic queue progress/stats
            long count = matchmakingQueueRepository.countBySportIdAndFacilityIdAndDateAndTimeSlot(
                q.getSportId(), q.getFacility().getId(), q.getDate(), q.getTimeSlot()
            );
            int ideal = getIdealParticipants(q.getSportId());
            int min = q.getFacility().getMinParticipants() != null ? q.getFacility().getMinParticipants() : 6;

            qMap.put("playersCount", count);
            qMap.put("idealCount", ideal);
            qMap.put("minCount", min);

            result.add(qMap);
        }

        return result;
    }

    @GetMapping("/my-matches")
    public ResponseEntity<?> getMyMatches(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        UserAccount current = getAuthenticatedUser(authHeader);
        Long userId = current.getId();

        // Find bookings where user is a participant in booking_participants
        List<BookingParticipant> participations = bookingParticipantRepository.findByUserId(userId);

        List<Map<String, Object>> formattedMatches = new ArrayList<>();
        for (BookingParticipant p : participations) {
            Booking b = p.getBooking();
            
            // Filter out non-active bookings
            if (b.getStatus() == com.badya.booking.model.BookingStatus.CANCELLED) {
                continue;
            }

            List<BookingParticipant> allParticipants = bookingParticipantRepository.findByBookingId(b.getId());

            List<Map<String, Object>> teamA = new ArrayList<>();
            List<Map<String, Object>> teamB = new ArrayList<>();

            for (BookingParticipant bp : allParticipants) {
                Map<String, Object> pInfo = new HashMap<>();
                pInfo.put("fullName", bp.getUser().getFullName() != null ? bp.getUser().getFullName() : "Anonymous Student");
                pInfo.put("studentId", bp.getUser().getStudentId());
                pInfo.put("skillLevel", bp.getUser().getSkillLevel() != null ? bp.getUser().getSkillLevel() : "Intermediate");

                if ("A".equals(bp.getTeam())) {
                    teamA.add(pInfo);
                } else {
                    teamB.add(pInfo);
                }
            }

            // Extract sportName from scannedIdData
            String sportName = "Unknown Sport";
            String scanned = b.getScannedIdData();
            if (scanned != null && scanned.startsWith("matchmaking:")) {
                sportName = scanned.replace("matchmaking:", "");
            } else if (b.getFacility().getSports() != null) {
                sportName = b.getFacility().getSports().split(",")[0];
            }

            Map<String, Object> match = new LinkedHashMap<>();
            match.put("id", b.getId());
            match.put("startTime", b.getStartTime());
            match.put("endTime", b.getEndTime());
            match.put("facilityName", b.getFacility().getName());
            match.put("sportName", sportName);
            match.put("myTeam", p.getTeam());
            match.put("teamA", teamA);
            match.put("teamB", teamB);

            formattedMatches.add(match);
        }

        return ResponseEntity.ok(formattedMatches);
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
}
