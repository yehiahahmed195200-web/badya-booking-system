package com.badya.booking.service;

import com.badya.booking.model.Booking;
import com.badya.booking.model.BookingStatus;
import com.badya.booking.model.Facility;
import com.badya.booking.repository.BookingRepository;
import com.badya.booking.repository.FacilityRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FacilityService {
    private final FacilityRepository facilityRepository;
    private final BookingRepository bookingRepository;

    public FacilityService(FacilityRepository facilityRepository, BookingRepository bookingRepository) {
        this.facilityRepository = facilityRepository;
        this.bookingRepository = bookingRepository;
    }

    public List<Facility> all(boolean activeOnly) {
        return activeOnly ? facilityRepository.findByActiveTrue() : facilityRepository.findAll();
    }

    public Facility create(Facility facility) {
        facility.setId(null);
        if (facility.getActive() == null) {
            facility.setActive(true);
        }
        return facilityRepository.save(facility);
    }

    @Transactional
    public Facility updateStatus(Long id, boolean active, String policy) {
        Long facilityId = Objects.requireNonNull(id, "facility id is required");
        Facility facility = facilityRepository.findById(facilityId)
                .orElseThrow(() -> new IllegalArgumentException("Facility not found"));
        facility.setActive(active);
        facilityRepository.save(facility);

        if (!active && "CANCEL".equalsIgnoreCase(policy)) {
            List<Booking> future = bookingRepository.findByStartTimeBetween(LocalDateTime.now(), LocalDateTime.now().plusYears(1));
            for (Booking booking : future) {
                Long bookingFacilityId = booking.getFacility() != null ? booking.getFacility().getId() : null;
                if (Objects.equals(bookingFacilityId, facilityId) && booking.getStatus() == BookingStatus.CONFIRMED) {
                    booking.setStatus(BookingStatus.CANCELLED);
                    bookingRepository.save(booking);
                }
            }
        }

        return facility;
    }

    /**
     * FR-4.1, FR-4.2: Change facility status (OPEN, MAINTENANCE, TOURNAMENT)
     */
    @Transactional
    public Facility changeStatus(Long id, String status, String reason) {
        Long facilityId = Objects.requireNonNull(id, "facility id is required");
        Facility facility = facilityRepository.findById(facilityId)
                .orElseThrow(() -> new IllegalArgumentException("Facility not found"));

        // Validate status
        if (!status.matches("^(OPEN|MAINTENANCE|TOURNAMENT|CLOSED)$")) {
            throw new IllegalArgumentException("Invalid status. Must be OPEN, MAINTENANCE, TOURNAMENT, or CLOSED");
        }

        facility.setStatus(status);
        facility.setStatusReason(reason);
        facility.setActive(status.equals("OPEN")); // Mark as inactive if not OPEN

        return facilityRepository.save(facility);
    }

    /**
     * FR-4.5: Configure sports/activities for multi-purpose court
     */
    @Transactional
    public Facility configureSports(Long id, String sports) {
        Long facilityId = Objects.requireNonNull(id, "facility id is required");
        Facility facility = facilityRepository.findById(facilityId)
                .orElseThrow(() -> new IllegalArgumentException("Facility not found"));

        facility.setSports(sports);
        return facilityRepository.save(facility);
    }

    /**
     * FR-4.4: Update facility schedule and configuration
     */
    @Transactional
    public Facility updateConfiguration(Long id, Facility updates) {
        Long facilityId = Objects.requireNonNull(id, "facility id is required");
        Facility facility = facilityRepository.findById(facilityId)
                .orElseThrow(() -> new IllegalArgumentException("Facility not found"));

        if (updates.getName() != null) facility.setName(updates.getName());
        if (updates.getCategory() != null) facility.setCategory(updates.getCategory());
        if (updates.getOpenTime() != null) facility.setOpenTime(updates.getOpenTime());
        if (updates.getCloseTime() != null) facility.setCloseTime(updates.getCloseTime());
        if (updates.getMinParticipants() != null) facility.setMinParticipants(updates.getMinParticipants());
        if (updates.getMaxParticipants() != null) facility.setMaxParticipants(updates.getMaxParticipants());
        if (updates.getSports() != null) facility.setSports(updates.getSports());

        return facilityRepository.save(facility);
    }

    public java.util.Map<String, Object> getAvailabilityForDate(Long id, java.time.LocalDate date) {
        Facility facility = facilityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Facility not found"));

        java.time.LocalDateTime dayStart = date.atStartOfDay();
        java.time.LocalDateTime dayEnd = date.atTime(java.time.LocalTime.MAX);

        // Fetch all bookings for this facility on this day that are not cancelled or rejected
        List<Booking> dayBookings = bookingRepository.findByFacilityIdAndStartTimeBetween(id, dayStart, dayEnd);
        List<Booking> activeBookings = dayBookings.stream()
                .filter(b -> b.getStatus() != BookingStatus.CANCELLED && b.getStatus() != BookingStatus.REJECTED)
                .toList();

        // Parse open and close times
        java.time.LocalTime open = java.time.LocalTime.parse(facility.getOpenTime());
        java.time.LocalTime close = java.time.LocalTime.parse(facility.getCloseTime());
        int slotMins = facility.getDefaultSlotMins() != null ? facility.getDefaultSlotMins() : 60;

        java.util.List<java.util.Map<String, Object>> slots = new java.util.ArrayList<>();
        java.time.LocalTime current = open;

        java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("HH:mm");

        while (current.plusMinutes(slotMins).isBefore(close) || current.plusMinutes(slotMins).equals(close)) {
            java.time.LocalTime slotStart = current;
            java.time.LocalTime slotEnd = current.plusMinutes(slotMins);

            java.time.LocalDateTime slotStartDT = date.atTime(slotStart);
            java.time.LocalDateTime slotEndDT = date.atTime(slotEnd);

            boolean isAvailable = true;
            for (Booking booking : activeBookings) {
                // If overlap occurs: slotStartDT < bookingEndTime && slotEndDT > bookingStartTime
                if (slotStartDT.isBefore(booking.getEndTime()) && slotEndDT.isAfter(booking.getStartTime())) {
                    isAvailable = false;
                    break;
                }
            }

            java.util.Map<String, Object> slotObj = new java.util.LinkedHashMap<>();
            slotObj.put("time", slotStart.format(formatter));
            slotObj.put("available", isAvailable);
            slots.add(slotObj);

            current = slotEnd;
        }

        java.util.Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("facilityId", id);
        response.put("date", date.toString());
        response.put("slots", slots);
        return response;
    }

    @Transactional
    public void delete(Long id) {
        Long facilityId = java.util.Objects.requireNonNull(id, "facility id is required");
        Facility facility = facilityRepository.findById(facilityId)
                .orElseThrow(() -> new IllegalArgumentException("Facility not found"));
        bookingRepository.deleteByFacilityId(facilityId);
        facilityRepository.delete(facility);
    }
}
