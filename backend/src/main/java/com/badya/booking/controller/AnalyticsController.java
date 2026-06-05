package com.badya.booking.controller;

import com.badya.booking.model.AttendanceStatus;
import com.badya.booking.model.Booking;
import com.badya.booking.model.BookingStatus;
import com.badya.booking.model.UserRole;
import com.badya.booking.model.FairnessConfig;
import com.badya.booking.repository.BookingRepository;
import com.badya.booking.repository.FacilityRepository;
import com.badya.booking.repository.UserRepository;
import com.badya.booking.repository.FeedbackRepository;
import com.badya.booking.repository.FairnessConfigRepository;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final FacilityRepository facilityRepository;
    private final FeedbackRepository feedbackRepository;
    private final FairnessConfigRepository fairnessConfigRepository;

    public AnalyticsController(
            BookingRepository bookingRepository,
            UserRepository userRepository,
            FacilityRepository facilityRepository,
            FeedbackRepository feedbackRepository,
            FairnessConfigRepository fairnessConfigRepository
    ) {
        this.bookingRepository = bookingRepository;
        this.userRepository = userRepository;
        this.facilityRepository = facilityRepository;
        this.feedbackRepository = feedbackRepository;
        this.fairnessConfigRepository = fairnessConfigRepository;
    }

    @GetMapping("/summary")
    public Map<String, Object> summary() {
        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);

        long totalBookings = bookingRepository.count();
        long activeUsers = userRepository.findAll().stream()
                .filter(u -> u.getRole() == UserRole.STUDENT)
                .filter(u -> {
                    List<Booking> userBookings = bookingRepository.findByUserIdAndStatusInAndStartTimeBetween(
                            u.getId(),
                            List.of(BookingStatus.CONFIRMED, BookingStatus.PENDING, BookingStatus.COMPLETED),
                            thirtyDaysAgo,
                            LocalDateTime.now()
                    );
                    return !userBookings.isEmpty();
                })
                .count();
        long openCourts = facilityRepository.findAll().stream()
                .filter(f -> "OPEN".equals(f.getStatus()))
                .filter(f -> Boolean.TRUE.equals(f.getActive()))
                .count();
        long pendingConflicts = bookingRepository.findAll().stream()
                .filter(b -> b.getConflictId() != null && !b.getConflictId().isBlank())
                .filter(b -> b.getStatus() == BookingStatus.CONFIRMED)
                .collect(Collectors.groupingBy(Booking::getConflictId))
                .entrySet().stream()
                .filter(e -> e.getValue().size() >= 2)
                .count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalBookings", totalBookings);
        result.put("activeUsers", activeUsers);
        result.put("openCourts", openCourts);
        result.put("pendingConflicts", pendingConflicts);
        return result;
    }

    @GetMapping("/trends")
    public List<Map<String, Object>> trends() {
        int days = 30;
        LocalDate startDate = LocalDate.now().minusDays(days);

        List<Booking> bookings = bookingRepository.findByStartTimeBetween(
                startDate.atStartOfDay(),
                LocalDateTime.now()
        );

        Map<String, Long> dailyCounts = new LinkedHashMap<>();
        for (int i = 0; i <= days; i++) {
            String key = startDate.plusDays(i).toString();
            dailyCounts.put(key, 0L);
        }

        for (Booking b : bookings) {
            String key = b.getStartTime().toLocalDate().toString();
            dailyCounts.merge(key, 1L, Long::sum);
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<String, Long> entry : dailyCounts.entrySet()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("date", entry.getKey());
            item.put("count", entry.getValue());
            result.add(item);
        }

        return result;
    }

    @GetMapping("/popularity")
    public List<Map<String, Object>> popularity() {
        List<Booking> allBookings = bookingRepository.findAll();

        Map<String, Long> sportCounts = new HashMap<>();
        for (Booking b : allBookings) {
            String sportName = b.getFacility().getName();
            String sports = b.getFacility().getSports();
            if (sports != null && !sports.isEmpty()) {
                for (String s : sports.split(",")) {
                    s = s.trim();
                    if (!s.isEmpty()) {
                        sportCounts.merge(s, 1L, Long::sum);
                    }
                }
            } else {
                sportCounts.merge(sportName, 1L, Long::sum);
            }
        }

        List<Map<String, Object>> result = sportCounts.entrySet().stream()
                .map(e -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("name", e.getKey());
                    item.put("count", e.getValue());
                    return item;
                })
                .sorted((a, b) -> Long.compare((Long) b.get("count"), (Long) a.get("count")))
                .collect(Collectors.toList());

        return result;
    }

    @GetMapping("/density")
    public List<Map<String, Object>> density() {
        List<Booking> bookings = bookingRepository.findAll();

        int[][] density = new int[7][24];
        String[] days = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};

        for (Booking b : bookings) {
            LocalDateTime start = b.getStartTime();
            int day = start.getDayOfWeek().getValue() % 7;
            int hour = start.getHour();
            if (hour >= 0 && hour < 24) {
                density[day][hour]++;
            }
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (int day = 0; day < 7; day++) {
            for (int hour = 0; hour < 24; hour++) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("day", days[day]);
                item.put("dayIdx", day);
                item.put("hour", hour);
                item.put("count", density[day][hour]);
                result.add(item);
            }
        }

        return result;
    }

    @GetMapping("/leaderboard")
    public List<Map<String, Object>> leaderboard() {
        List<Booking> allBookings = bookingRepository.findAll();

        Map<Long, List<Booking>> byUser = allBookings.stream()
                .filter(b -> b.getUser() != null)
                .collect(Collectors.groupingBy(b -> b.getUser().getId()));

        List<Map<String, Object>> result = byUser.entrySet().stream()
                .map(entry -> {
                    Long userId = entry.getKey();
                    List<Booking> userBookings = entry.getValue();
                    var user = userBookings.get(0).getUser();

                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", userId);
                    item.put("fullName", user.getFullName());
                    item.put("studentId", "");
                    item.put("bookingCount", userBookings.size());
                    return item;
                })
                .sorted((a, b) -> Integer.compare((Integer) b.get("bookingCount"), (Integer) a.get("bookingCount")))
                .limit(10)
                .collect(Collectors.toList());

        return result;
    }

    @GetMapping("/fairness")
    public Map<String, Object> fairness(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new IllegalArgumentException("Unauthorized: Missing bearer token.");
        }

        LocalDate today = LocalDate.now();
        int weekNumber = today.get(java.time.temporal.IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        int year = today.get(java.time.temporal.IsoFields.WEEK_BASED_YEAR);

        LocalDate startOfWeek = today.with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate endOfWeek = today.with(java.time.temporal.TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));
        LocalDateTime weekStart = startOfWeek.atStartOfDay();
        LocalDateTime weekEnd = endOfWeek.atTime(LocalTime.MAX);

        com.badya.booking.model.Facility mcFacility = facilityRepository.findAll().stream()
                .filter(f -> f.getName().equalsIgnoreCase("Multipurpose Court"))
                .findFirst()
                .orElse(null);

        List<Booking> bookings = bookingRepository.findByStartTimeBetween(weekStart, weekEnd);
        if (mcFacility != null) {
            final Long mcId = mcFacility.getId();
            bookings = bookings.stream()
                    .filter(b -> b.getFacility() != null && mcId.equals(b.getFacility().getId()))
                    .collect(Collectors.toList());
        }

        FairnessConfig config = fairnessConfigRepository.findTopByOrderByIdAsc()
                .orElseGet(() -> {
                    FairnessConfig newConfig = new FairnessConfig();
                    newConfig.setPrimeTimeStartHour(17);
                    newConfig.setPrimeTimeEndHour(21);
                    newConfig.setBasketballQuotaPercent(60.0);
                    newConfig.setVolleyballQuotaPercent(40.0);
                    newConfig.setCooldownPeriodHours(24);
                    newConfig.setMaxWeeklyReservationsPerUser(3);
                    newConfig.setConsecutiveSlotLimit(2);
                    newConfig.setTeamOverlapThresholdPercent(50.0);
                    newConfig.setPlayerWeightCoeff(0.4);
                    newConfig.setUnusedHoursWeightCoeff(0.3);
                    newConfig.setPrimeTimeDisadvantageCoeff(0.3);
                    return fairnessConfigRepository.save(newConfig);
                });

        double basketballHours = 0.0;
        double volleyballHours = 0.0;
        double bbPtHours = 0.0;
        double vbPtHours = 0.0;
        int bbRejected = 0;
        int vbRejected = 0;

        for (Booking b : bookings) {
            double hours = java.time.Duration.between(b.getStartTime(), b.getEndTime()).toMinutes() / 60.0;
            String sport = "Basketball";
            String scanned = b.getScannedIdData();
            if (scanned != null && scanned.startsWith("matchmaking:")) {
                sport = scanned.replace("matchmaking:", "");
            } else if (b.getFacility().getSports() != null) {
                String sports = b.getFacility().getSports();
                if (sports.toLowerCase().contains("volleyball")) {
                    sport = "Basketball";
                } else if (sports.toLowerCase().contains("tennis")) {
                    sport = "Tennis";
                }
            }

            if (b.getStatus() == BookingStatus.CANCELLED || b.getStatus() == BookingStatus.REJECTED) {
                if ("Basketball".equalsIgnoreCase(sport)) {
                    bbRejected++;
                } else if ("Volleyball".equalsIgnoreCase(sport)) {
                    vbRejected++;
                }
                continue;
            }

            if (b.getStatus() == BookingStatus.CONFIRMED || b.getStatus() == BookingStatus.COMPLETED) {
                if ("Basketball".equalsIgnoreCase(sport)) {
                    basketballHours += hours;
                    if (b.getStartTime().getHour() >= config.getPrimeTimeStartHour() && b.getStartTime().getHour() < config.getPrimeTimeEndHour()) {
                        bbPtHours += hours;
                    }
                } else if ("Volleyball".equalsIgnoreCase(sport)) {
                    volleyballHours += hours;
                    if (b.getStartTime().getHour() >= config.getPrimeTimeStartHour() && b.getStartTime().getHour() < config.getPrimeTimeEndHour()) {
                        vbPtHours += hours;
                    }
                }
            }
        }

        int activeBasketball = 15 + (int)(basketballHours * 0.5);
        int activeVolleyball = 10 + (int)(volleyballHours * 0.5);

        double totalPlayers = Math.max(1, activeBasketball + activeVolleyball);
        double bbPlayerWeight = activeBasketball / totalPlayers;
        double vbPlayerWeight = activeVolleyball / totalPlayers;

        double totalOpenHours = 84.0;
        if (mcFacility != null && mcFacility.getOpenTime() != null && mcFacility.getCloseTime() != null) {
            try {
                double dailyHours = java.time.Duration.between(
                        LocalTime.parse(mcFacility.getOpenTime()),
                        LocalTime.parse(mcFacility.getCloseTime())
                ).toMinutes() / 60.0;
                totalOpenHours = dailyHours * 7;
            } catch (Exception e) {
                // Keep default 84.0
            }
        }
        double bbQuotaHours = totalOpenHours * (config.getBasketballQuotaPercent() / 100.0);
        double vbQuotaHours = totalOpenHours * (config.getVolleyballQuotaPercent() / 100.0);

        double bbUnusedWeight = Math.max(0.0, (bbQuotaHours - basketballHours) / bbQuotaHours);
        double vbUnusedWeight = Math.max(0.0, (vbQuotaHours - volleyballHours) / vbQuotaHours);

        double totalPTHours = Math.max(1.0, bbPtHours + vbPtHours);
        double bbPtDisadvantage = 1.0 - (bbPtHours / totalPTHours);
        double vbPtDisadvantage = 1.0 - (vbPtHours / totalPTHours);

        double bbScore = bbPlayerWeight * config.getPlayerWeightCoeff() + bbUnusedWeight * config.getUnusedHoursWeightCoeff() + bbPtDisadvantage * config.getPrimeTimeDisadvantageCoeff();
        double vbScore = vbPlayerWeight * config.getPlayerWeightCoeff() + vbUnusedWeight * config.getUnusedHoursWeightCoeff() + vbPtDisadvantage * config.getPrimeTimeDisadvantageCoeff();

        String currentPriority = bbScore >= vbScore ? "Basketball" : "Volleyball";
        String primeTimePriority = (weekNumber % 2 == 0) ? "Basketball" : "Volleyball";

        double utilizationRate = Math.min(100.0, ((basketballHours + volleyballHours) / totalOpenHours) * 100.0);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("year", year);
        result.put("weekNumber", weekNumber);
        result.put("utilizationRate", Math.round(utilizationRate * 10.0) / 10.0);

        Map<String, Object> activePlayers = new HashMap<>();
        activePlayers.put("Basketball", activeBasketball);
        activePlayers.put("Volleyball", activeVolleyball);
        result.put("activePlayers", activePlayers);

        Map<String, Object> bookedHours = new HashMap<>();
        bookedHours.put("Basketball", Math.round(basketballHours * 10.0) / 10.0);
        bookedHours.put("Volleyball", Math.round(volleyballHours * 10.0) / 10.0);
        result.put("bookedHours", bookedHours);

        Map<String, Object> quotaAchievement = new HashMap<>();
        quotaAchievement.put("Basketball", Math.round((basketballHours / Math.max(1, bbQuotaHours) * 100.0) * 10.0) / 10.0);
        quotaAchievement.put("Volleyball", Math.round((volleyballHours / Math.max(1, vbQuotaHours) * 100.0) * 10.0) / 10.0);
        result.put("quotaAchievement", quotaAchievement);

        Map<String, Object> primeTimeHours = new HashMap<>();
        primeTimeHours.put("Basketball", Math.round(bbPtHours * 10.0) / 10.0);
        primeTimeHours.put("Volleyball", Math.round(vbPtHours * 10.0) / 10.0);
        result.put("primeTimeHours", primeTimeHours);

        Map<String, Object> fairnessScore = new HashMap<>();
        fairnessScore.put("Basketball", Math.round(bbScore * 100.0) / 100.0);
        fairnessScore.put("Volleyball", Math.round(vbScore * 100.0) / 100.0);
        result.put("fairnessScore", fairnessScore);

        result.put("currentPrioritySport", currentPriority);
        result.put("primeTimePrioritySport", primeTimePriority);

        List<Map<String, Object>> weeklyComparison = new ArrayList<>();
        Map<String, Object> bbComp = new LinkedHashMap<>();
        bbComp.put("sport", "Basketball");
        bbComp.put("booked", Math.round(basketballHours * 10.0) / 10.0);
        bbComp.put("rejected", bbRejected);
        weeklyComparison.add(bbComp);

        Map<String, Object> vbComp = new LinkedHashMap<>();
        vbComp.put("sport", "Volleyball");
        vbComp.put("booked", Math.round(volleyballHours * 10.0) / 10.0);
        vbComp.put("rejected", vbRejected);
        weeklyComparison.add(vbComp);

        result.put("weeklyComparison", weeklyComparison);

        return result;
    }
}
