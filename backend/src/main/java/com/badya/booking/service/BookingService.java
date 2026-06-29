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
import com.badya.booking.model.ParticipantStatus;
import com.badya.booking.model.BookingParticipant;
import com.badya.booking.model.BookingEvent;
import com.badya.booking.repository.BookingParticipantRepository;
import com.badya.booking.repository.BookingEventRepository;
import org.springframework.scheduling.annotation.Scheduled;
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

    @Autowired
    private BookingParticipantRepository bookingParticipantRepository;

    @Autowired
    private BookingEventRepository bookingEventRepository;

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
                throw new IllegalArgumentException("Booking rejected: Sport selection is required for this shared facility.");
            }
            boolean isValidSport = false;
            String[] allowedSports = facility.getSports().split(",");
            for (String allowedSport : allowedSports) {
                if (allowedSport.trim().equalsIgnoreCase(sport.trim())) {
                    isValidSport = true;
                    break;
                }
            }
            if (!isValidSport) {
                throw new IllegalArgumentException("Booking rejected: Invalid sport selection. Must be one of: " + facility.getSports());
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
                } else if (scanned != null && !scanned.trim().isEmpty()) {
                    bSport = scanned.trim();
                } else if (b.getFacility().getSports() != null) {
                    String sportsStr = b.getFacility().getSports();
                    bSport = sportsStr.split(",")[0].trim();
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

        List<String> buddyIds = request.buddyIds();
        boolean hasBuddies = buddyIds != null && !buddyIds.isEmpty();
        List<UserAccount> buddyUsers = new java.util.ArrayList<>();

        if (hasBuddies) {
            long pendingCount = bookingRepository.countByUserIdAndStatus(userId, BookingStatus.RESERVED_PENDING_PLAYERS);
            if (pendingCount >= 5) {
                throw new IllegalArgumentException("Booking rejected: You have reached the limit of 5 pending teammate invitations. Please wait for your friends to respond or cancel your pending invitations first.");
            }

            for (String buddyId : buddyIds) {
                if (buddyId.trim().equalsIgnoreCase(user.getStudentId())) {
                    throw new IllegalArgumentException("Booking rejected: You cannot add yourself as a buddy.");
                }
                UserAccount buddy = userRepository.findByStudentId(buddyId.trim())
                        .orElseThrow(() -> new IllegalArgumentException("Booking rejected: Student ID '" + buddyId + "' is not registered."));
                if (buddy.isBanned()) {
                    throw new IllegalArgumentException("Booking rejected: Teammate '" + buddy.getFullName() + "' is currently banned.");
                }
                if (hasOverlappingBooking(buddy.getId(), startTime, startTime.plusMinutes(duration))) {
                    throw new IllegalArgumentException("Booking rejected: Teammate '" + buddy.getFullName() + "' already has another overlapping booking or invitation at this time.");
                }
                buddyUsers.add(buddy);
            }
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

        // Fetch same-day bookings for the user to validate constraints
        List<Booking> sameDayUserBookings = bookingRepository.findByUserIdAndStatusInAndStartTimeBetween(
                userId,
                List.of(BookingStatus.CONFIRMED, BookingStatus.PENDING),
                dayStart,
                dayEnd);

        // Validate daily booking limit per facility (each student should be allowed to try different facilities per day)
        long dailyFacilityCount = sameDayUserBookings.stream()
                .filter(b -> b.getFacility().getId().equals(facilityId))
                .count();
        Integer maxLimit = rules.getMaxBookingsPerUserPerDay();
        if (maxLimit != null && dailyFacilityCount >= maxLimit) {
            throw new IllegalArgumentException("Daily booking limit reached for this facility (" + maxLimit + ")");
        }

        LocalDateTime endTime = startTime.plusMinutes(duration);

        // Check if the user already has an active booking overlapping with this time slot
        List<Booking> userOverlaps = sameDayUserBookings.stream()
                .filter(existing -> existing.getStartTime().isBefore(endTime) && existing.getEndTime().isAfter(startTime))
                .toList();

        if (!userOverlaps.isEmpty()) {
            if (Boolean.TRUE.equals(request.forceCancelOverlap())) {
                for (Booking overlap : userOverlaps) {
                    overlap.setStatus(BookingStatus.CANCELLED);
                    overlap.setConflictId(null);
                    bookingRepository.save(overlap);
                    user.setCredits(user.getCredits() + 1);
                }
                userRepository.save(user);
            } else {
                throw new IllegalArgumentException("OVERLAP_DETECTED: You already have another active booking at this time. If you proceed with this booking, your other booking will be cancelled.");
            }
        }

        if (facility.getOpenTime() != null && facility.getCloseTime() != null) {
            LocalTime openTime = LocalTime.parse(facility.getOpenTime());
            LocalTime closeTime = LocalTime.parse(facility.getCloseTime());
            LocalTime startLocal = startTime.toLocalTime();
            LocalTime endLocal = endTime.toLocalTime();

            if (startLocal.isBefore(openTime) || endLocal.isAfter(closeTime) || endLocal.isBefore(startLocal)) {
                throw new IllegalArgumentException("Booking must fall within facility operating hours.");
            }
        }

        if (!Boolean.TRUE.equals(rules.getAllowBackToBackBookings())) {
            boolean hasBackToBack = sameDayUserBookings.stream().anyMatch(existing ->
                    existing.getEndTime().equals(startTime) || existing.getStartTime().equals(endTime));
            if (hasBackToBack) {
                throw new IllegalArgumentException("Back-to-back bookings are disabled by current system rules");
            }
        }

        Long persistedFacilityId = Objects.requireNonNull(facility.getId(), "facilityId is missing");

        List<Booking> overlaps = bookingRepository
                .findByFacilityIdAndStatusInAndStartTimeLessThanAndEndTimeGreaterThan(
                        persistedFacilityId,
                        List.of(BookingStatus.CONFIRMED, BookingStatus.PENDING, BookingStatus.RESERVED_PENDING_PLAYERS),
                        endTime,
                        startTime);

        if (!overlaps.isEmpty()) {
            List<String> freeSlots = getAvailableSlotsForDate(facility, startTime.toLocalDate());
            String freeSlotsStr = freeSlots.isEmpty() ? "No available slots today" : String.join(", ", freeSlots);
            throw new IllegalArgumentException("Booking rejected: This court is already booked during the requested time slot. Available times today: " + freeSlotsStr);
        }

        Booking booking = new Booking();
        booking.setUser(user);
        booking.setFacility(facility);
        booking.setStartTime(startTime);
        booking.setEndTime(endTime);
        booking.setParticipants(participants);
        LocalDateTime nowDT = LocalDateTime.now();
        booking.setCreatedAt(nowDT);
        String scannedIdData = request.scannedIdData();
        if (scannedIdData == null || scannedIdData.trim().isEmpty()) {
            scannedIdData = "matchmaking:" + effectiveSport;
        }
        booking.setScannedIdData(scannedIdData);
        booking.setConflictId(null);

        if (hasBuddies) {
            booking.setStatus(BookingStatus.RESERVED_PENDING_PLAYERS);
            booking.setExpiryTime(nowDT.plusMinutes(15));

            // Option A: Booker credits hold (Reserved credits)
            user.setCredits(user.getCredits() - 1);
            user.setReservedCredits(user.getReservedCredits() + 1);
            userRepository.save(user);

            booking = bookingRepository.save(booking);

            // Log and create events
            logEvent(booking.getId(), user.getId(), "INVITATION_SENT", "Booker reserved the court and sent buddy invitations.");

            // Create BookingParticipant for each buddy
            for (UserAccount buddyUser : buddyUsers) {
                BookingParticipant participant = new BookingParticipant();
                participant.setBooking(booking);
                participant.setUser(buddyUser);
                participant.setStatus(ParticipantStatus.PENDING);
                bookingParticipantRepository.save(participant);

                // Notify buddy (Invitation Sent)
                String title = "🎾 دعوة للانضمام إلى مباراة! (Teammate Invitation)";
                String message = user.getFullName() + " قام بدعوتك للعب في " + facility.getName() + " يوم " + startTime.toLocalDate() + " الساعة " + startTime.toLocalTime() + ". يرجى الرد على الدعوة بالقبول أو الرفض خلال 15 دقيقة.";
                try {
                    notificationService.sendInAppNotification(buddyUser, title, message, com.badya.booking.model.NotificationType.BOOKING_CONFIRMED);
                    if (buddyUser.getEmail() != null) {
                        notificationService.sendEmail(buddyUser.getEmail(), title, message);
                    }
                } catch (Exception e) {
                    System.err.println("Failed to send buddy invitation notifications: " + e.getMessage());
                }
            }
        } else {
            booking.setStatus(BookingStatus.CONFIRMED);

            // Deduct credit directly
            user.setCredits(user.getCredits() - 1);
            userRepository.save(user);

            booking = bookingRepository.save(booking);
            logEvent(booking.getId(), user.getId(), "BOOKING_CONFIRMED", "Booking confirmed immediately.");
        }

        return booking;
    }

    public List<Booking> all() {
        return bookingRepository.findAll();
    }
    @Transactional(noRollbackFor = IllegalArgumentException.class)
    public Booking cancel(Long id) {
        Long bookingId = Objects.requireNonNull(id, "booking id is required");
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
        
        if (booking.getStatus() == BookingStatus.CANCELLED) {
            return booking;
        }

        BookingStatus originalStatus = booking.getStatus();

        // Late cancellation check (less than 2 hours before start time) - only for non-reserved bookings
        if (originalStatus != BookingStatus.RESERVED_PENDING_PLAYERS && LocalDateTime.now().isAfter(booking.getStartTime().minusHours(2))) {
            UserAccount user = booking.getUser();
            if (user != null) {
                user.setWarnings((user.getWarnings() != null ? user.getWarnings() : 0) + 1);
                userRepository.save(user);
                
                // Send notification about the warning
                try {
                    Notification warningNotif = new Notification();
                    warningNotif.setUser(user);
                    warningNotif.setTitle("Late Cancellation Warning / إنذار إلغاء متأخر");
                    warningNotif.setMessage("Cancellation is blocked less than 2 hours before start time. A warning has been recorded.");
                    warningNotif.setType(com.badya.booking.model.NotificationType.BOOKING_CANCELLED);
                    notificationRepository.save(warningNotif);
                } catch (Exception ex) {
                    System.err.println("Late cancellation warning notification failed: " + ex.getMessage());
                }
            }
            throw new IllegalArgumentException("Cancellation rejected: You cannot cancel a booking less than 2 hours before its start time. A warning has been recorded against your account.");
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setConflictId(null);
        Booking saved = bookingRepository.save(booking);

        UserAccount user = booking.getUser();
        if (user != null) {
            if (originalStatus == BookingStatus.RESERVED_PENDING_PLAYERS) {
                user.setCredits(user.getCredits() + 1);
                if (user.getReservedCredits() > 0) {
                    user.setReservedCredits(user.getReservedCredits() - 1);
                }
                userRepository.save(user);
                logEvent(booking.getId(), user.getId(), "BOOKING_CANCELLED", "Booker cancelled the pending booking.");
                logEvent(booking.getId(), user.getId(), "REFUND_ISSUED", "Refunded 1 reserved credit to booker.");
            } else {
                user.setCredits(user.getCredits() + 1);
                userRepository.save(user);
                logEvent(booking.getId(), user.getId(), "BOOKING_CANCELLED", "Booker cancelled the confirmed booking.");
                logEvent(booking.getId(), user.getId(), "REFUND_ISSUED", "Refunded 1 credit to booker.");
            }
        }

        // Refund and update buddy participants
        List<BookingParticipant> participants = bookingParticipantRepository.findByBookingId(booking.getId());
        for (BookingParticipant bp : participants) {
            if (bp.getStatus() == ParticipantStatus.CONFIRMED) {
                UserAccount buddy = bp.getUser();
                if (buddy != null) {
                    buddy.setCredits(buddy.getCredits() + 1);
                    userRepository.save(buddy);
                    logEvent(booking.getId(), buddy.getId(), "REFUND_ISSUED", "Refunded 1 credit to buddy due to booking cancellation.");

                    // Notify buddy about cancellation
                    String title = "🚫 تم إلغاء الحجز (Booking Cancelled)";
                    String message = booking.getUser().getFullName() + " قام بإلغاء الحجز لملعب " + booking.getFacility().getName() + " يوم " + booking.getStartTime().toLocalDate() + ". تم إرجاع الرصيد لحسابك.";
                    try {
                        notificationService.sendInAppNotification(buddy, title, message, com.badya.booking.model.NotificationType.BOOKING_CANCELLED);
                    } catch (Exception ex) {
                        System.err.println("Failed to notify buddy of cancellation: " + ex.getMessage());
                    }
                }
            } else if (bp.getStatus() == ParticipantStatus.PENDING) {
                // Notify pending buddy that the invitation was cancelled/withdrawn
                UserAccount buddy = bp.getUser();
                if (buddy != null) {
                    String title = "🚫 تم سحب دعوة الحجز (Invitation Withdrawn)";
                    String message = booking.getUser().getFullName() + " قام بسحب دعوة الحجز لملعب " + booking.getFacility().getName() + " يوم " + booking.getStartTime().toLocalDate() + ".";
                    try {
                        notificationService.sendInAppNotification(buddy, title, message, com.badya.booking.model.NotificationType.BOOKING_CANCELLED);
                    } catch (Exception ex) {
                        System.err.println("Failed to notify buddy of invitation withdrawal: " + ex.getMessage());
                    }
                }
            }
            bp.setStatus(ParticipantStatus.REJECTED);
            bookingParticipantRepository.save(bp);
        }

        try {
            notificationService.sendBookingCancelled(booking, true);
        } catch (Exception ex) {
            System.err.println("Cancellation notification failed: " + ex.getMessage());
        }
        promoteWaitlist(booking);
        return saved;
    }

    // After cancellation, try to promote earliest valid waitlist entry for same facility/time
    private void promoteWaitlist(Booking booking) {
        try {
            List<WaitlistEntry> waitlist = waitlistRepository.findByFacility_IdAndDesiredStartTimeOrderByCreatedAtAsc(
                    booking.getFacility().getId(), booking.getStartTime());
            
            SystemRule rules = systemRuleService.getCurrentRules();

            for (WaitlistEntry entry : waitlist) {
                UserAccount waitlistUser = entry.getUser();
                if (waitlistUser == null) {
                    waitlistRepository.delete(entry);
                    continue;
                }

                // 1. Ban status check
                if (waitlistUser.isBanned()) {
                    waitlistRepository.delete(entry);
                    continue;
                }

                // 2. Warning threshold / auto-ban check
                Integer warningThreshold = rules.getAutoBanWarningThreshold();
                if (warningThreshold != null && warningThreshold > 0 && waitlistUser.getWarnings() != null && waitlistUser.getWarnings() >= warningThreshold) {
                    waitlistUser.setBanned(true);
                    userRepository.save(waitlistUser);
                    waitlistRepository.delete(entry);
                    continue;
                }

                // 3. Credit balance validation
                if (waitlistUser.getCredits() == null || waitlistUser.getCredits() <= 0) {
                    waitlistRepository.delete(entry);
                    continue;
                }

                LocalDateTime start = entry.getDesiredStartTime();
                int duration = entry.getFacility().getDefaultSlotMins() != null ? entry.getFacility().getDefaultSlotMins() : 60;
                LocalDateTime end = start.plusMinutes(duration);

                LocalDateTime dayStart = start.toLocalDate().atStartOfDay();
                LocalDateTime dayEnd = dayStart.plusDays(1).minusNanos(1);

                // 4. Daily booking limit validation (per facility)
                List<Booking> sameDayWaitlistUserBookings = bookingRepository.findByUserIdAndStatusInAndStartTimeBetween(
                        waitlistUser.getId(),
                        List.of(BookingStatus.CONFIRMED, BookingStatus.PENDING),
                        dayStart,
                        dayEnd);
                long dailyFacilityCount = sameDayWaitlistUserBookings.stream()
                        .filter(b -> b.getFacility().getId().equals(entry.getFacility().getId()))
                        .count();
                Integer maxLimit = rules.getMaxBookingsPerUserPerDay();
                if (maxLimit != null && dailyFacilityCount >= maxLimit) {
                    waitlistRepository.delete(entry);
                    continue;
                }

                // 5. Back-to-back booking validation
                if (!Boolean.TRUE.equals(rules.getAllowBackToBackBookings())) {
                    boolean hasBackToBack = sameDayWaitlistUserBookings.stream().anyMatch(existing ->
                            existing.getEndTime().equals(start) || existing.getStartTime().equals(end));
                    if (hasBackToBack) {
                        waitlistRepository.delete(entry);
                        continue;
                    }
                }

                // All validations passed! Promote this user.
                waitlistUser.setCredits(waitlistUser.getCredits() - 1);
                userRepository.save(waitlistUser);

                Booking auto = new Booking();
                auto.setUser(waitlistUser);
                auto.setFacility(booking.getFacility());
                auto.setStartTime(start);
                auto.setEndTime(end);
                auto.setParticipants(entry.getParticipants());
                auto.setCreatedAt(LocalDateTime.now());
                auto.setStatus(BookingStatus.CONFIRMED);

                // Copy scannedIdData from cancelled booking to preserve sport selection, or fallback to default
                String sportData = booking.getScannedIdData();
                if (sportData == null || sportData.trim().isEmpty()) {
                    String defaultSport = "Basketball";
                    if (booking.getFacility().getSports() != null) {
                        defaultSport = booking.getFacility().getSports().split(",")[0].trim();
                    }
                    sportData = "matchmaking:" + defaultSport;
                }
                auto.setScannedIdData(sportData);

                Booking confirmed = bookingRepository.save(auto);
                waitlistRepository.delete(entry);

                // Create notification for user
                try {
                    notificationService.sendBookingConfirmed(confirmed, false, false, true);
                } catch (Exception ex) {
                    System.err.println("Waitlist promotion notification failed: " + ex.getMessage());
                }

                // Successfully promoted one candidate, break the loop
                break;
            }
        } catch (Exception ex) {
            System.err.println("Waitlist promotion error: " + ex.getMessage());
        }
    }

    private List<String> getAvailableSlotsForDate(Facility facility, LocalDate date) {
        LocalDateTime dayStart = date.atStartOfDay();
        LocalDateTime dayEnd = date.atTime(LocalTime.MAX);
        List<Booking> dayBookings = bookingRepository.findByFacilityIdAndStartTimeBetween(facility.getId(), dayStart, dayEnd);
        List<Booking> activeBookings = dayBookings.stream()
                .filter(b -> b.getStatus() != BookingStatus.CANCELLED && b.getStatus() != BookingStatus.REJECTED)
                .toList();

        LocalTime open = LocalTime.parse(facility.getOpenTime());
        LocalTime close = LocalTime.parse(facility.getCloseTime());
        int slotMins = facility.getDefaultSlotMins() != null ? facility.getDefaultSlotMins() : 60;

        List<String> availableTimes = new java.util.ArrayList<>();
        LocalTime current = open;
        java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("HH:mm");

        while (current.plusMinutes(slotMins).isBefore(close) || current.plusMinutes(slotMins).equals(close)) {
            LocalTime slotStart = current;
            LocalTime slotEnd = current.plusMinutes(slotMins);

            LocalDateTime slotStartDT = date.atTime(slotStart);
            LocalDateTime slotEndDT = date.atTime(slotEnd);

            boolean isAvailable = true;
            for (Booking booking : activeBookings) {
                if (slotStartDT.isBefore(booking.getEndTime()) && slotEndDT.isAfter(booking.getStartTime())) {
                    isAvailable = false;
                    break;
                }
            }

            if (isAvailable) {
                availableTimes.add(slotStart.format(formatter));
            }
            current = slotEnd;
        }
        return availableTimes;
    }

    public boolean hasOverlappingBooking(Long userId, LocalDateTime startTime, LocalDateTime endTime) {
        List<Booking> bookerOverlaps = bookingRepository.findByUserIdAndStatusInAndStartTimeLessThanAndEndTimeGreaterThan(
                userId,
                List.of(BookingStatus.CONFIRMED, BookingStatus.RESERVED_PENDING_PLAYERS),
                endTime,
                startTime);
        if (!bookerOverlaps.isEmpty()) {
            return true;
        }

        List<BookingParticipant> participations = bookingParticipantRepository.findByUserId(userId);
        for (BookingParticipant bp : participations) {
            if (bp.getStatus() == ParticipantStatus.CONFIRMED) {
                Booking b = bp.getBooking();
                if (b.getStatus() == BookingStatus.CONFIRMED || b.getStatus() == BookingStatus.RESERVED_PENDING_PLAYERS) {
                    if (b.getStartTime().isBefore(endTime) && b.getEndTime().isAfter(startTime)) {
                        return true;
                    }
                }
            }
        }
        return false;
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
            System.err.println("Failed to log booking event: " + ex.getMessage());
        }
    }

    @Transactional
    @Scheduled(fixedRate = 30000)
    public void checkExpiredBookings() {
        LocalDateTime now = LocalDateTime.now();
        List<Booking> expiredBookings = bookingRepository.findByStatusAndExpiryTimeBefore(
                BookingStatus.RESERVED_PENDING_PLAYERS,
                now);

        for (Booking booking : expiredBookings) {
            try {
                // Fetch fresh status in current transaction to prevent race conditions (multi-instance safety check)
                Booking freshBooking = bookingRepository.findById(booking.getId()).orElse(null);
                if (freshBooking == null || freshBooking.getStatus() != BookingStatus.RESERVED_PENDING_PLAYERS) {
                    continue;
                }
                freshBooking.setStatus(BookingStatus.CANCELLED);
                bookingRepository.save(freshBooking);

                UserAccount booker = freshBooking.getUser();
                if (booker != null) {
                    booker.setCredits(booker.getCredits() + 1);
                    if (booker.getReservedCredits() > 0) {
                        booker.setReservedCredits(booker.getReservedCredits() - 1);
                    }
                    userRepository.save(booker);

                    logEvent(freshBooking.getId(), booker.getId(), "INVITATION_EXPIRED", "Teammate invitation expired.");
                    logEvent(freshBooking.getId(), booker.getId(), "REFUND_ISSUED", "Refunded 1 credit to booker due to expiration.");

                    String title = "⏳ انتهى وقت قبول الدعوة (Invitation Expired)";
                    String message = "انتهى وقت تأكيد الحجز لملعب " + freshBooking.getFacility().getName() + " يوم " + freshBooking.getStartTime().toLocalDate() + " الساعة " + freshBooking.getStartTime().toLocalTime() + " لأن بعض زملائك لم يوافقوا على الدعوة في الوقت المحدد (15 دقيقة). تم إلغاء الحجز وإرجاع الرصيد لحسابك.";
                    notificationService.sendInAppNotification(booker, title, message, com.badya.booking.model.NotificationType.BOOKING_CANCELLED);
                }

                List<BookingParticipant> participants = bookingParticipantRepository.findByBookingId(freshBooking.getId());
                for (BookingParticipant bp : participants) {
                    if (bp.getStatus() == ParticipantStatus.PENDING) {
                        bp.setStatus(ParticipantStatus.REJECTED);
                        bookingParticipantRepository.save(bp);

                        UserAccount buddy = bp.getUser();
                        if (buddy != null) {
                            String title = "⏳ انتهى وقت قبول الدعوة (Invitation Expired)";
                            String message = "انتهى وقت قبول دعوة اللعب من " + freshBooking.getUser().getFullName() + " بملعب " + freshBooking.getFacility().getName() + ". تم إلغاء الحجز.";
                            notificationService.sendInAppNotification(buddy, title, message, com.badya.booking.model.NotificationType.BOOKING_CANCELLED);
                        }
                    }
                }
            } catch (Exception ex) {
                System.err.println("Failed to process expired booking ID " + booking.getId() + ": " + ex.getMessage());
            }
        }
    }
}
