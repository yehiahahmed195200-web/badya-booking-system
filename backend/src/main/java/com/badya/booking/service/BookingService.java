package com.badya.booking.service;

import com.badya.booking.dto.CreateBookingRequest;
import com.badya.booking.model.Booking;
import com.badya.booking.model.BookingStatus;
import com.badya.booking.model.Facility;
import com.badya.booking.model.SystemRule;
import com.badya.booking.model.UserAccount;
import com.badya.booking.repository.BookingRepository;
import com.badya.booking.repository.FacilityRepository;
import com.badya.booking.repository.UserRepository;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import com.badya.booking.repository.WaitlistRepository;
import com.badya.booking.model.WaitlistEntry;
import com.badya.booking.model.Notification;
import com.badya.booking.repository.NotificationRepository;
import com.badya.booking.model.UserRole;
import com.badya.booking.model.FairnessConfig;
import com.badya.booking.repository.FairnessConfigRepository;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.DayOfWeek;
import java.util.Optional;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class BookingService {
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final FacilityRepository facilityRepository;
    private final SystemRuleService systemRuleService;
    private final FairnessConfigRepository fairnessConfigRepository;

    @Autowired
    private WaitlistRepository waitlistRepository;
    @Autowired
    private NotificationRepository notificationRepository;
    @Autowired
    private NotificationService notificationService;

    public BookingService(
            BookingRepository bookingRepository,
            UserRepository userRepository,
            FacilityRepository facilityRepository,
            SystemRuleService systemRuleService,
            FairnessConfigRepository fairnessConfigRepository) {
        this.bookingRepository = bookingRepository;
        this.userRepository = userRepository;
        this.facilityRepository = facilityRepository;
        this.systemRuleService = systemRuleService;
        this.fairnessConfigRepository = fairnessConfigRepository;
    }

    @Transactional
    public Booking create(CreateBookingRequest request) {
        Long userId = Objects.requireNonNull(request.userId(), "userId is required");
        Long facilityId = Objects.requireNonNull(request.facilityId(), "facilityId is required");
        LocalDateTime startTime = Objects.requireNonNull(request.startTime(), "startTime is required");
        Integer participants = Objects.requireNonNull(request.participants(), "participants is required");

        UserAccount user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Facility facility = facilityRepository.findById(facilityId)
                .orElseThrow(() -> new IllegalArgumentException("Facility not found"));

        SystemRule rules = systemRuleService.getCurrentRules();

        // 1. Sport Validation for Shared Facilities
        String sport = request.sport();
        if (facility.getSports() != null && facility.getSports().contains(",")) {
            if (sport == null || sport.trim().isEmpty()) {
                throw new IllegalArgumentException("Booking rejected: Sport selection (Basketball or Volleyball) is required for this shared court.");
            }
            if (!"Basketball".equalsIgnoreCase(sport) && !"Volleyball".equalsIgnoreCase(sport)) {
                throw new IllegalArgumentException("Booking rejected: Invalid sport selection. Must be Basketball or Volleyball.");
            }
        }

        String effectiveSport = sport;
        if (effectiveSport == null || effectiveSport.trim().isEmpty()) {
            if (facility.getSports() != null) {
                effectiveSport = facility.getSports().split(",")[0].trim();
            } else {
                effectiveSport = "Basketball";
            }
        }

        int duration = request.durationMins() != null ? request.durationMins() : facility.getDefaultSlotMins();

        // 2. Dynamic Weekly Quota Enforcement on Multipurpose Court
        if (facility.getName().equalsIgnoreCase("Multipurpose Court")) {
            LocalDate bookingDate = startTime.toLocalDate();
            LocalDate startOfWeek = bookingDate.with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            LocalDate endOfWeek = bookingDate.with(java.time.temporal.TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));
            LocalDateTime weekStart = startOfWeek.atStartOfDay();
            LocalDateTime weekEnd = endOfWeek.atTime(LocalTime.MAX);

            List<Booking> weeklyBookings = bookingRepository.findByFacilityIdAndStartTimeBetween(facility.getId(), weekStart, weekEnd);
            double basketballHours = 0.0;
            double volleyballHours = 0.0;

            for (Booking b : weeklyBookings) {
                if (b.getStatus() == BookingStatus.CANCELLED || b.getStatus() == BookingStatus.REJECTED) {
                    continue;
                }
                double hours = java.time.Duration.between(b.getStartTime(), b.getEndTime()).toMinutes() / 60.0;
                String bSport = "Basketball";
                String scanned = b.getScannedIdData();
                if (scanned != null && scanned.startsWith("matchmaking:")) {
                    bSport = scanned.replace("matchmaking:", "");
                } else if (b.getFacility().getSports() != null) {
                    String sportsStr = b.getFacility().getSports();
                    if (sportsStr.toLowerCase().contains("volleyball")) {
                        bSport = "Basketball";
                    }
                }

                if ("Basketball".equalsIgnoreCase(bSport)) {
                    basketballHours += hours;
                } else if ("Volleyball".equalsIgnoreCase(bSport)) {
                    volleyballHours += hours;
                }
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

            // Calculate weekly open hours dynamically
            double dailyHours = java.time.Duration.between(
                    LocalTime.parse(facility.getOpenTime()),
                    LocalTime.parse(facility.getCloseTime())
            ).toMinutes() / 60.0;
            double totalOpenHours = dailyHours * 7;

            double maxBasketballHours = totalOpenHours * (config.getBasketballQuotaPercent() / 100.0);
            double maxVolleyballHours = totalOpenHours * (config.getVolleyballQuotaPercent() / 100.0);

            if ("Basketball".equalsIgnoreCase(effectiveSport)) {
                if (basketballHours + (duration / 60.0) > maxBasketballHours) {
                    if (user.getRole() != UserRole.ADMIN) {
                        throw new IllegalArgumentException("Booking rejected: Basketball has exceeded its weekly quota of " + config.getBasketballQuotaPercent() + "%.");
                    }
                }
            } else if ("Volleyball".equalsIgnoreCase(effectiveSport)) {
                if (volleyballHours + (duration / 60.0) > maxVolleyballHours) {
                    if (user.getRole() != UserRole.ADMIN) {
                        throw new IllegalArgumentException("Booking rejected: Volleyball has exceeded its weekly quota of " + config.getVolleyballQuotaPercent() + "%.");
                    }
                }
            }
        }

        if (user.isBanned()) {
            throw new IllegalArgumentException("Booking rejected: account is banned");
        }

        if (user.getCredits() == null || user.getCredits() <= 0) {
            throw new IllegalArgumentException("Booking rejected: Insufficient credits. Your remaining credit balance is 0.");
        }

        Integer warningThreshold = rules.getAutoBanWarningThreshold();
        if (warningThreshold != null && warningThreshold > 0 && user.getWarnings() != null && user.getWarnings() >= warningThreshold) {
            user.setBanned(true);
            userRepository.save(user);
            throw new IllegalArgumentException("Booking rejected: warning threshold reached, account auto-banned");
        }

        if (!Boolean.TRUE.equals(facility.getActive())) {
            throw new IllegalArgumentException("Facility is deactivated");
        }

        if (participants < facility.getMinParticipants()
            || participants > facility.getMaxParticipants()) {
            throw new IllegalArgumentException("Participants outside allowed range");
        }


        if (duration < rules.getMinBookingDurationMins() || duration > rules.getMaxBookingDurationMins()) {
            throw new IllegalArgumentException("Booking duration must be between " + rules.getMinBookingDurationMins() + " and " + rules.getMaxBookingDurationMins() + " minutes");
        }

        if (startTime.isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Booking start time cannot be in the past");
        }

        LocalDateTime allowedUntil = LocalDateTime.now().plusDays(rules.getAdvanceBookingWindowDays());
        boolean isPriorityUser = Boolean.TRUE.equals(rules.getPriorityBookingEnabled())
                && user.getEarnedPoints() != null
                && user.getEarnedPoints() >= rules.getPriorityScoreThreshold();
        if (isPriorityUser) {
            allowedUntil = allowedUntil.plusHours(rules.getPriorityEarlyAccessHours());
        }
        if (startTime.isAfter(allowedUntil)) {
            throw new IllegalArgumentException("Booking exceeds advance window. Allowed until " + allowedUntil);
        }

        LocalDateTime dayStart = startTime.toLocalDate().atStartOfDay();
        LocalDateTime dayEnd = dayStart.plusDays(1).minusNanos(1);
        long dailyCount = bookingRepository.countByUserIdAndStatusInAndStartTimeBetween(
                userId,
                List.of(BookingStatus.CONFIRMED, BookingStatus.PENDING),
                dayStart,
                dayEnd);
        if (dailyCount >= rules.getMaxBookingsPerUserPerDay()) {
            throw new IllegalArgumentException("Daily booking limit reached (" + rules.getMaxBookingsPerUserPerDay() + ")");
        }

        LocalDateTime endTime = startTime.plusMinutes(duration);

        if (!Boolean.TRUE.equals(rules.getAllowBackToBackBookings())) {
            List<Booking> sameDayBookings = bookingRepository.findByUserIdAndStatusInAndStartTimeBetween(
                    userId,
                    List.of(BookingStatus.CONFIRMED, BookingStatus.PENDING),
                    dayStart,
                    dayEnd);
            boolean hasBackToBack = sameDayBookings.stream().anyMatch(existing ->
                    existing.getEndTime().equals(startTime) || existing.getStartTime().equals(endTime));
            if (hasBackToBack) {
                throw new IllegalArgumentException("Back-to-back bookings are disabled by current system rules");
            }
        }

        Long persistedFacilityId = Objects.requireNonNull(facility.getId(), "facilityId is missing");

        List<Booking> overlaps = bookingRepository
                .findByFacilityIdAndStatusInAndStartTimeLessThanAndEndTimeGreaterThan(
                        persistedFacilityId,
                List.of(BookingStatus.CONFIRMED),
                        endTime,
                        startTime);

        Booking booking = new Booking();
        booking.setUser(user);
        booking.setFacility(facility);
        booking.setStartTime(startTime);
        booking.setEndTime(endTime);
        booking.setParticipants(participants);
        booking.setCreatedAt(LocalDateTime.now());
        String scannedIdData = request.scannedIdData();
        if (scannedIdData == null || scannedIdData.trim().isEmpty()) {
            scannedIdData = "matchmaking:" + effectiveSport;
        }
        booking.setScannedIdData(scannedIdData);

        booking.setStatus(BookingStatus.CONFIRMED);

        // Deduct credit since all validations passed
        user.setCredits(user.getCredits() - 1);
        userRepository.save(user);

        if (overlaps.isEmpty()) {
            booking.setConflictId(null);
            Booking saved = bookingRepository.save(booking);
            return saved;
        }

        String conflictId = overlaps.stream()
                .map(Booking::getConflictId)
                .filter(id -> id != null && !id.isBlank())
                .findFirst()
                .orElse("conflict-" + UUID.randomUUID());

        booking.setConflictId(conflictId);
        Booking saved = bookingRepository.save(booking);

        for (Booking overlap : overlaps) {
            boolean changed = false;
            if (!conflictId.equals(overlap.getConflictId())) {
                overlap.setConflictId(conflictId);
                changed = true;
            }
            if (changed) {
                bookingRepository.save(overlap);
            }
        }

        try {
            notificationService.sendConflictAlert(saved, true);
        } catch (Exception ex) {
            System.err.println("Failed to send conflict notification: " + ex.getMessage());
        }

        return saved;
    }

    public List<Booking> all() {
        return bookingRepository.findAll();
    }

    @Transactional
    public Booking cancel(Long id) {
        Long bookingId = Objects.requireNonNull(id, "booking id is required");
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
        if (booking.getStatus() != BookingStatus.CANCELLED) {
            booking.setStatus(BookingStatus.CANCELLED);
            UserAccount user = booking.getUser();
            if (user != null) {
                user.setCredits(user.getCredits() + 1);
                userRepository.save(user);
            }
            try {
                notificationService.sendBookingCancelled(booking, true);
            } catch (Exception ex) {
                System.err.println("Cancellation notification failed: " + ex.getMessage());
            }
        }
        booking.setConflictId(null);
        Booking saved = bookingRepository.save(booking);

        // After cancellation, try to promote earliest waitlist entry for same facility/time
        try {
            Optional<WaitlistEntry> maybe = waitlistRepository.findFirstByFacility_IdAndDesiredStartTimeOrderByCreatedAtAsc(
                    booking.getFacility().getId(), booking.getStartTime());
            if (maybe.isPresent()) {
                WaitlistEntry entry = maybe.get();
                UserAccount waitlistUser = entry.getUser();
                if (waitlistUser != null && waitlistUser.getCredits() != null && waitlistUser.getCredits() > 0) {
                    waitlistUser.setCredits(waitlistUser.getCredits() - 1);
                    userRepository.save(waitlistUser);

                    Booking auto = new Booking();
                    auto.setUser(waitlistUser);
                    auto.setFacility(booking.getFacility());
                    LocalDateTime start = entry.getDesiredStartTime();
                    // use facility default if available
                    int duration = entry.getFacility().getDefaultSlotMins() != null ? entry.getFacility().getDefaultSlotMins() : 60;
                    auto.setStartTime(start);
                    auto.setEndTime(start.plusMinutes(duration));
                    auto.setParticipants(entry.getParticipants());
                    auto.setCreatedAt(LocalDateTime.now());
                    auto.setStatus(BookingStatus.CONFIRMED);
                    Booking confirmed = bookingRepository.save(auto);

                    // remove from waitlist
                    waitlistRepository.delete(entry);

                    // create notification for user
                    try {
                        notificationService.sendBookingConfirmed(confirmed, false, false, true);
                    } catch (Exception ex) {
                        System.err.println("Waitlist promotion notification failed: " + ex.getMessage());
                    }
                }
            }
        } catch (Exception ex) {
            System.err.println("Waitlist promotion error: " + ex.getMessage());
        }

        return saved;
    }
}
