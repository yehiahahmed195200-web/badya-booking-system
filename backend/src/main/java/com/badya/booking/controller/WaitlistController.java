package com.badya.booking.controller;

import com.badya.booking.dto.CreateWaitlistRequest;
import com.badya.booking.model.WaitlistEntry;
import com.badya.booking.model.UserAccount;
import com.badya.booking.model.Facility;
import com.badya.booking.repository.UserRepository;
import com.badya.booking.repository.FacilityRepository;
import com.badya.booking.repository.WaitlistRepository;
import jakarta.validation.Valid;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

@RestController
@RequestMapping("/api/waitlist")
public class WaitlistController {
    private final WaitlistRepository waitlistRepository;
    private final UserRepository userRepository;
    private final FacilityRepository facilityRepository;

    public WaitlistController(WaitlistRepository waitlistRepository, UserRepository userRepository, FacilityRepository facilityRepository) {
        this.waitlistRepository = waitlistRepository;
        this.userRepository = userRepository;
        this.facilityRepository = facilityRepository;
    }

    @GetMapping
    public List<WaitlistEntry> all() {
        return waitlistRepository.findAll();
    }

    @PostMapping
    public WaitlistEntry create(@Valid @RequestBody @NonNull CreateWaitlistRequest request) {
        UserAccount user = userRepository.findById(Objects.requireNonNull(request.userId(), "userId is required")).orElseThrow(() -> new IllegalArgumentException("User not found"));
        Facility facility = facilityRepository.findById(Objects.requireNonNull(request.facilityId(), "facilityId is required")).orElseThrow(() -> new IllegalArgumentException("Facility not found"));

        WaitlistEntry e = new WaitlistEntry();
        e.setUser(user);
        e.setFacility(facility);
        e.setDesiredStartTime(request.desiredStartTime());
        e.setParticipants(request.participants());
        e.setCreatedAt(LocalDateTime.now());
        return waitlistRepository.save(e);
    }
}
