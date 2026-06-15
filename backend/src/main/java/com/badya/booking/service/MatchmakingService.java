package com.badya.booking.service;

import com.badya.booking.model.Booking;
import com.badya.booking.model.BookingParticipant;
import com.badya.booking.model.BookingStatus;
import com.badya.booking.model.Facility;
import com.badya.booking.model.MatchmakingQueue;
import com.badya.booking.model.NotificationType;
import com.badya.booking.model.UserAccount;
import com.badya.booking.repository.BookingParticipantRepository;
import com.badya.booking.repository.BookingRepository;
import com.badya.booking.repository.FacilityRepository;
import com.badya.booking.repository.MatchmakingQueueRepository;
import com.badya.booking.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class MatchmakingService {

    private final MatchmakingQueueRepository matchmakingQueueRepository;
    private final BookingParticipantRepository bookingParticipantRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final FacilityRepository facilityRepository;
    private final NotificationService notificationService;

    public MatchmakingService(
            MatchmakingQueueRepository matchmakingQueueRepository,
            BookingParticipantRepository bookingParticipantRepository,
            BookingRepository bookingRepository,
            UserRepository userRepository,
            FacilityRepository facilityRepository,
            NotificationService notificationService
    ) {
        this.matchmakingQueueRepository = matchmakingQueueRepository;
        this.bookingParticipantRepository = bookingParticipantRepository;
        this.bookingRepository = bookingRepository;
        this.userRepository = userRepository;
        this.facilityRepository = facilityRepository;
        this.notificationService = notificationService;
    }

    public static class QueueStatusResponse {
        public int count;
        public int ideal;
        public int min;
        public String sportName;

        public QueueStatusResponse(int count, int ideal, int min, String sportName) {
            this.count = count;
            this.ideal = ideal;
            this.min = min;
            this.sportName = sportName;
        }
    }

    public static class MatchPlayer {
        public Long userId;
        public String skillLevel;

        public MatchPlayer(Long userId, String skillLevel) {
            this.userId = userId;
            this.skillLevel = skillLevel;
        }
    }

    public static class BalancedPlayer {
        public Long userId;
        public String team;

        public BalancedPlayer(Long userId, String team) {
            this.userId = userId;
            this.team = team;
        }
    }

    @Transactional
    public MatchmakingQueue joinQueue(Long userId, String sportId, Long facilityId, String date, String timeSlot) {
        // 1. Verify user exists and is not banned
        UserAccount user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (user.isBanned()) {
            throw new IllegalArgumentException("You are currently banned from making bookings or joining queues.");
        }

        // 2. Verify facility exists and is open
        Facility facility = facilityRepository.findById(facilityId)
                .orElseThrow(() -> new IllegalArgumentException("Facility not found"));
        if (!Boolean.TRUE.equals(facility.getActive())) {
            throw new IllegalArgumentException("Facility is deactivated");
        }
        if (!"OPEN".equalsIgnoreCase(facility.getStatus())) {
            throw new IllegalArgumentException("Facility is currently " + facility.getStatus());
        }

        // 3. Parse and validate time slot
        LocalDateTime start;
        try {
            if (timeSlot.length() == 5) {
                start = LocalDateTime.parse(date + "T" + timeSlot + ":00");
            } else {
                start = LocalDateTime.parse(date + "T" + timeSlot);
            }
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid date or time slot format");
        }

        if (start.isBefore(LocalDateTime.now().plusHours(1))) {
            throw new IllegalArgumentException("You must join the queue at least 1 hour in advance of the slot.");
        }

        // 4. Operating hours check
        double startTimeVal = start.getHour() + start.getMinute() / 60.0;
        double facilityOpenVal = parseTimeString(facility.getOpenTime());
        double facilityCloseVal = parseTimeString(facility.getCloseTime());

        if (startTimeVal < facilityOpenVal || startTimeVal >= facilityCloseVal) {
            throw new IllegalArgumentException("Facilities are only open between " + facility.getOpenTime() + " and " + facility.getCloseTime() + ".");
        }

        // 5. Booking overlaps check
        int durationMins = facility.getDefaultSlotMins() != null ? facility.getDefaultSlotMins() : 60;
        LocalDateTime end = start.plusMinutes(durationMins);

        List<Booking> activeUserBookings = bookingRepository.findByUserId(userId).stream()
                .filter(b -> b.getStatus() == BookingStatus.CONFIRMED || b.getStatus() == BookingStatus.PENDING)
                .filter(b -> b.getStartTime().isBefore(end) && b.getEndTime().isAfter(start))
                .toList();

        if (!activeUserBookings.isEmpty()) {
            throw new IllegalArgumentException("You already have an active booking overlapping with this time slot.");
        }

        // Check overlapping BookingParticipant roles
        List<BookingParticipant> participantReservations = bookingParticipantRepository.findByUserId(userId).stream()
                .filter(bp -> {
                    Booking b = bp.getBooking();
                    return b.getStatus() == BookingStatus.CONFIRMED || b.getStatus() == BookingStatus.PENDING;
                })
                .filter(bp -> {
                    Booking b = bp.getBooking();
                    return b.getStartTime().isBefore(end) && b.getEndTime().isAfter(start);
                })
                .toList();

        if (!participantReservations.isEmpty()) {
            throw new IllegalArgumentException("You are already registered as a participant in a booking overlapping with this time slot.");
        }

        // 6. Check if user already in the queue for this exact slot
        Optional<MatchmakingQueue> existing = matchmakingQueueRepository.findByUserIdAndSportIdAndDateAndTimeSlot(userId, sportId, date, timeSlot);
        if (existing.isPresent()) {
            return existing.get();
        }

        // 7. Add to queue
        MatchmakingQueue entry = new MatchmakingQueue();
        entry.setUser(user);
        entry.setSportId(sportId);
        entry.setFacility(facility);
        entry.setDate(date);
        entry.setTimeSlot(timeSlot);
        entry.setCreatedAt(LocalDateTime.now());
        entry = matchmakingQueueRepository.save(entry);

        // 8. Trigger matchmaking process
        final Long entryFacilityId = facilityId;
        final String entrySportId = sportId;
        final String entryDate = date;
        final String entryTimeSlot = timeSlot;
        new Thread(() -> {
            try {
                // Short sleep to ensure transaction commits before processing
                Thread.sleep(500);
                processQueue(entrySportId, entryFacilityId, entryDate, entryTimeSlot);
            } catch (Exception ex) {
                System.err.println("Error in async processQueue: " + ex.getMessage());
            }
        }).start();

        return entry;
    }

    @Transactional
    public void leaveQueue(Long userId, String sportId, String date, String timeSlot) {
        Optional<MatchmakingQueue> entry = matchmakingQueueRepository.findByUserIdAndSportIdAndDateAndTimeSlot(userId, sportId, date, timeSlot);
        if (entry.isPresent()) {
            matchmakingQueueRepository.delete(entry.get());
        } else {
            throw new IllegalArgumentException("Queue entry not found");
        }
    }

    public QueueStatusResponse getQueueStatus(String sportId, Long facilityId, String date, String timeSlot) {
        Facility facility = facilityRepository.findById(facilityId)
                .orElseThrow(() -> new IllegalArgumentException("Facility not found"));

        long count = matchmakingQueueRepository.countBySportIdAndFacilityIdAndDateAndTimeSlot(sportId, facilityId, date, timeSlot);
        
        // Sports rules default defaults
        int ideal = "Basketball".equalsIgnoreCase(sportId) ? 10 : 12; // Volleyball ideal is 12, Basketball is 10
        int min = facility.getMinParticipants() != null ? facility.getMinParticipants() : 6;

        return new QueueStatusResponse((int) count, ideal, min, sportId);
    }

    public List<BalancedPlayer> balanceTeams(List<MatchPlayer> players) {
        Map<String, Integer> skillScores = new HashMap<>();
        skillScores.put("Advanced", 3);
        skillScores.put("Intermediate", 2);
        skillScores.put("Beginner", 1);

        List<Map.Entry<MatchPlayer, Integer>> scoredPlayers = players.stream()
                .map(p -> Map.entry(p, skillScores.getOrDefault(p.skillLevel, 2)))
                .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                .collect(Collectors.toList());

        List<BalancedPlayer> teamA = new ArrayList<>();
        List<BalancedPlayer> teamB = new ArrayList<>();
        int sumA = 0;
        int sumB = 0;
        int maxTeamSize = (int) Math.ceil(players.size() / 2.0);

        for (var entry : scoredPlayers) {
            MatchPlayer player = entry.getKey();
            int score = entry.getValue();

            boolean spaceA = teamA.size() < maxTeamSize;
            boolean spaceB = teamB.size() < maxTeamSize;

            if (spaceA && !spaceB) {
                teamA.add(new BalancedPlayer(player.userId, "A"));
                sumA += score;
            } else if (!spaceA && spaceB) {
                teamB.add(new BalancedPlayer(player.userId, "B"));
                sumB += score;
            } else {
                if (sumA < sumB) {
                    teamA.add(new BalancedPlayer(player.userId, "A"));
                    sumA += score;
                } else if (sumB < sumA) {
                    teamB.add(new BalancedPlayer(player.userId, "B"));
                    sumB += score;
                } else {
                    if (teamA.size() <= teamB.size()) {
                        teamA.add(new BalancedPlayer(player.userId, "A"));
                        sumA += score;
                    } else {
                        teamB.add(new BalancedPlayer(player.userId, "B"));
                        sumB += score;
                    }
                }
            }
        }

        List<BalancedPlayer> result = new ArrayList<>();
        result.addAll(teamA);
        result.addAll(teamB);
        return result;
    }

    @Transactional
    public synchronized Booking processQueue(String sportId, Long facilityId, String date, String timeSlot) {
        Facility facility = facilityRepository.findById(facilityId).orElse(null);
        if (facility == null) return null;

        LocalDateTime start;
        if (timeSlot.length() == 5) {
            start = LocalDateTime.parse(date + "T" + timeSlot + ":00");
        } else {
            start = LocalDateTime.parse(date + "T" + timeSlot);
        }

        int durationMins = facility.getDefaultSlotMins() != null ? facility.getDefaultSlotMins() : 60;
        LocalDateTime end = start.plusMinutes(durationMins);

        // 1. Check overlaps on this facility
        List<Booking> overlaps = bookingRepository.findByFacilityIdAndStatusInAndStartTimeLessThanAndEndTimeGreaterThan(
                facilityId,
                List.of(BookingStatus.CONFIRMED, BookingStatus.PENDING),
                end,
                start
        );

        if (!overlaps.isEmpty()) {
            System.out.println("Matchmaking skipped: Facility already booked.");
            return null;
        }

        // 2. Fetch queued players
        List<MatchmakingQueue> queue = matchmakingQueueRepository.findBySportIdAndFacilityIdAndDateAndTimeSlotOrderByCreatedAtAsc(
                sportId, facilityId, date, timeSlot
        );

        if (queue.isEmpty()) return null;

        long hoursToStart = Duration.between(LocalDateTime.now(), start).toHours();
        int ideal = "Basketball".equalsIgnoreCase(sportId) ? 10 : 12;
        int min = facility.getMinParticipants() != null ? facility.getMinParticipants() : 6;

        List<MatchmakingQueue> matchedQueueItems = new ArrayList<>();

        if (hoursToStart > 24) {
            // Match same skill groups
            Map<String, List<MatchmakingQueue>> skillGroups = new HashMap<>();
            skillGroups.put("Beginner", new ArrayList<>());
            skillGroups.put("Intermediate", new ArrayList<>());
            skillGroups.put("Advanced", new ArrayList<>());

            for (MatchmakingQueue q : queue) {
                String skill = q.getUser().getSkillLevel();
                if (skill == null) skill = "Intermediate";
                skillGroups.computeIfAbsent(skill, k -> new ArrayList<>()).add(q);
            }

            for (String skill : List.of("Advanced", "Intermediate", "Beginner")) {
                List<MatchmakingQueue> group = skillGroups.get(skill);
                if (group != null && group.size() >= ideal) {
                    matchedQueueItems = group.subList(0, ideal);
                    break;
                }
            }
        } else {
            // Relaxes matching constraint
            if (queue.size() >= min) {
                int matchedSize = Math.min(queue.size(), ideal);
                matchedQueueItems = queue.subList(0, matchedSize);
            }
        }

        if (matchedQueueItems.isEmpty()) {
            return null;
        }

        // Match found!
        List<MatchPlayer> matchPlayers = matchedQueueItems.stream()
                .map(q -> new MatchPlayer(q.getUser().getId(), q.getUser().getSkillLevel()))
                .collect(Collectors.toList());

        // Balance teams
        List<BalancedPlayer> balancedPlayers = balanceTeams(matchPlayers);

        // Deduct credits and update users
        for (MatchmakingQueue q : matchedQueueItems) {
            UserAccount user = q.getUser();
            if (user.getCredits() != null && user.getCredits() > 0) {
                user.setCredits(user.getCredits() - 1);
                userRepository.save(user);
            }
        }

        // Create Booking
        Booking booking = new Booking();
        booking.setUser(matchedQueueItems.get(0).getUser());
        booking.setFacility(facility);
        booking.setStartTime(start);
        booking.setEndTime(end);
        booking.setParticipants(matchedQueueItems.size());
        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setCreatedAt(LocalDateTime.now());
        booking.setScannedIdData("matchmaking:" + sportId);
        booking = bookingRepository.save(booking);

        // Add Participants
        for (BalancedPlayer bp : balancedPlayers) {
            UserAccount playerUser = userRepository.findById(bp.userId).orElse(null);
            if (playerUser != null) {
                BookingParticipant participant = new BookingParticipant();
                participant.setBooking(booking);
                participant.setUser(playerUser);
                participant.setTeam(bp.team);
                bookingParticipantRepository.save(participant);
            }
        }

        // Delete from Queue
        matchmakingQueueRepository.deleteAll(matchedQueueItems);

        // Notify players
        for (BalancedPlayer bp : balancedPlayers) {
            UserAccount playerUser = userRepository.findById(bp.userId).orElse(null);
            if (playerUser != null) {
                String teamName = bp.team.equals("A") ? "Team A (اليمين)" : "Team B (اليسار)";
                String title = "🎯 تم العثور على مباراة! (Game Matched)";
                String message = "تم تسجيلك بنجاح في مباراة " + sportId + " بملعب " + facility.getName() + " يوم " + date + " في تمام الساعة " + timeSlot + ". لقد تم توزيعك في: [" + teamName + "]. حظاً موفقاً!";
                
                try {
                    notificationService.sendInAppNotification(playerUser, title, message, NotificationType.BOOKING_CONFIRMED);
                    if (playerUser.getEmail() != null) {
                        notificationService.sendEmail(playerUser.getEmail(), title, message);
                    }
                } catch (Exception ex) {
                    System.err.println("Failed to send matchmaking notifications: " + ex.getMessage());
                }
            }
        }

        System.out.println("Successfully matched " + matchedQueueItems.size() + " players for booking " + booking.getId());
        return booking;
    }

    private double parseTimeString(String time) {
        if (time == null || time.isEmpty()) return 0.0;
        String[] parts = time.split(":");
        double hours = Double.parseDouble(parts[0]);
        double minutes = parts.length > 1 ? Double.parseDouble(parts[1]) : 0.0;
        return hours + minutes / 60.0;
    }

    @Scheduled(cron = "0 */10 * * * *") // Run every 10 minutes
    @Transactional
    public void processRelaxedQueues() {
        List<MatchmakingQueue> allQueueItems = matchmakingQueueRepository.findAll();
        if (allQueueItems.isEmpty()) return;

        // Group active queues by unique slot: facilityId + sportId + date + timeSlot
        Map<String, List<MatchmakingQueue>> groups = allQueueItems.stream()
                .collect(Collectors.groupingBy(q -> 
                    q.getFacility().getId() + "|" + q.getSportId() + "|" + q.getDate() + "|" + q.getTimeSlot()
                ));

        for (var entry : groups.entrySet()) {
            String[] parts = entry.getKey().split("\\|");
            Long facilityId = Long.parseLong(parts[0]);
            String sportId = parts[1];
            String date = parts[2];
            String timeSlot = parts[3];

            LocalDateTime start;
            try {
                if (timeSlot.length() == 5) {
                    start = LocalDateTime.parse(date + "T" + timeSlot + ":00");
                } else {
                    start = LocalDateTime.parse(date + "T" + timeSlot);
                }
            } catch (Exception e) {
                continue;
            }

            LocalDateTime now = LocalDateTime.now();
            if (start.isAfter(now) && start.isBefore(now.plusHours(24))) {
                try {
                    processQueue(sportId, facilityId, date, timeSlot);
                } catch (Exception ex) {
                    System.err.println("Error running relaxed matchmaking for " + entry.getKey() + ": " + ex.getMessage());
                }
            } else if (start.isBefore(now)) {
                // Prune/Clean up expired queue entries
                matchmakingQueueRepository.deleteAll(entry.getValue());
                System.out.println("Cleaned up expired matchmaking queue for " + entry.getKey());
            }
        }
    }
}
