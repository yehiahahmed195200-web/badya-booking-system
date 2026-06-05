package com.badya.booking.controller;

import com.badya.booking.dto.UpdateFacilityStatusRequest;
import com.badya.booking.model.Facility;
import com.badya.booking.model.UserAccount;
import com.badya.booking.model.UserRole;
import com.badya.booking.repository.UserRepository;
import com.badya.booking.service.FacilityService;
import com.badya.booking.service.AuditLogService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import com.badya.booking.dto.ChangeFacilityStatusRequest;
import com.badya.booking.dto.UpdateFacilityConfigRequest;
import com.badya.booking.repository.FacilityRepository;

@RestController
@RequestMapping("/api/facilities")
public class FacilityController {
    private final FacilityService facilityService;

    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FacilityRepository facilityRepository;

    public FacilityController(FacilityService facilityService) {
        this.facilityService = facilityService;
    }

    @GetMapping
    public List<Facility> all(
            @RequestParam(name = "activeOnly", required = false) Boolean activeOnly,
            @RequestParam(name = "active", required = false) Boolean active) {
        boolean onlyActive = activeOnly != null ? activeOnly : Boolean.TRUE.equals(active);
        return facilityService.all(onlyActive);
    }

    @PostMapping
    public Facility create(@Valid @RequestBody Facility facility) {
        Facility created = facilityService.create(facility);

        // Log the action
        UserAccount admin = getCurrentAdmin();
        if (admin != null) {
            auditLogService.log(admin, "FACILITY_CREATED", Map.of(
                    "facilityId", created.getId(),
                    "facilityName", created.getName(),
                    "category", created.getCategory()
            ));
        }

        return created;
    }
    @PatchMapping("/{id}/status")
    public Facility updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateFacilityStatusRequest request) {
        Facility updated = facilityService.updateStatus(id, request.active(), request.policy());

        // Log the action
        UserAccount admin = getCurrentAdmin();
        if (admin != null) {
            auditLogService.log(admin, "FACILITY_UPDATED", Map.of(
                    "facilityId", updated.getId(),
                    "facilityName", updated.getName(),
                    "active", updated.getActive() != null ? updated.getActive() : false,
                    "policy", request.policy()
            ));
        }

        return updated;
    }

    /**
     * FR-4.1, FR-4.2: Change facility status (OPEN, MAINTENANCE, TOURNAMENT)
     */
    @PostMapping("/{id}/status/change")
    public Facility changeStatus(
            @PathVariable Long id,
            @Valid @RequestBody ChangeFacilityStatusRequest request) {
        Facility updated = facilityService.changeStatus(id, request.status(), request.reason());

        // Log the action
        UserAccount admin = getCurrentAdmin();
        if (admin != null) {
            auditLogService.log(admin, "FACILITY_STATUS_CHANGED", Map.of(
                    "facilityId", updated.getId(),
                    "facilityName", updated.getName(),
                    "status", updated.getStatus(),
                    "reason", request.reason() != null ? request.reason() : "N/A"
            ));
        }

        return updated;
    }

    /**
     * FR-4.4, FR-4.5: Update facility configuration (schedule, sports/activities)
     */
    @PatchMapping("/{id}/config")
    public Facility updateConfig(
            @PathVariable Long id,
            @Valid @RequestBody UpdateFacilityConfigRequest request) {
        Facility facility = new Facility();
        facility.setName(request.name());
        facility.setCategory(request.category());
        facility.setOpenTime(request.openTime());
        facility.setCloseTime(request.closeTime());
        facility.setMinParticipants(request.minParticipants());
        facility.setMaxParticipants(request.maxParticipants());
        facility.setSports(request.sports());

        Facility updated = facilityService.updateConfiguration(id, facility);

        // Log the action
        UserAccount admin = getCurrentAdmin();
        if (admin != null) {
            auditLogService.log(admin, "FACILITY_CONFIG_UPDATED", Map.of(
                    "facilityId", updated.getId(),
                    "facilityName", updated.getName(),
                    "sports", updated.getSports() != null ? updated.getSports() : "N/A"
            ));
        }

        return updated;
    }

    /**
     * FR-4.5: Get facility sports/activities
     */
    @GetMapping("/{id}/sports")
    public Map<String, Object> getSports(@PathVariable Long id) {
        Facility facility = facilityRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Facility not found"));

        String[] sports = (facility.getSports() != null ? facility.getSports() : "").split(",");
        return Map.of(
                "facilityId", id,
                "facilityName", facility.getName(),
                "sports", sports
        );
    }

    private UserAccount getCurrentAdmin() {
        return userRepository.findAll().stream()
                .filter(u -> u.getRole() == UserRole.ADMIN)
                .findFirst()
                .orElse(null);
    }
}
