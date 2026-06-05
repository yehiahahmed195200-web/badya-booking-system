package com.badya.booking.controller;

import com.badya.booking.model.Booking;
import com.badya.booking.model.BookingStatus;
import com.badya.booking.repository.BookingRepository;
import com.badya.booking.repository.FacilityRepository;
import com.badya.booking.repository.UserRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reports")
public class ReportController {
    private final BookingRepository bookingRepository;
    private final FacilityRepository facilityRepository;
    private final UserRepository userRepository;

    public ReportController(
            BookingRepository bookingRepository,
            FacilityRepository facilityRepository,
            UserRepository userRepository
    ) {
        this.bookingRepository = bookingRepository;
        this.facilityRepository = facilityRepository;
        this.userRepository = userRepository;
    }

    @GetMapping("/monthly")
    public Map<String, Object> monthly(@RequestParam String month) {
        LocalDate first = LocalDate.parse(month + "-01");
        LocalDateTime start = first.atStartOfDay();
        LocalDateTime end = first.plusMonths(1).atStartOfDay();

        List<Booking> bookings = bookingRepository.findByStartTimeBetween(start, end);

        Map<String, long[]> byFacility = new HashMap<>();
        for (Booking b : bookings) {
            String key = b.getFacility().getName();
            long[] acc = byFacility.get(key);
            if (acc == null) {
                acc = new long[]{0, 0};
                byFacility.put(key, acc);
            }
            acc[0] += 1;
            double hours = java.time.temporal.ChronoUnit.MINUTES.between(b.getStartTime(), b.getEndTime()) / 60.0;
            acc[1] += Math.round(hours * 100.0) / 100.0;
        }

        Map<String, Map<String, Object>> byFacilityFormatted = new LinkedHashMap<>();
        for (Map.Entry<String, long[]> entry : byFacility.entrySet()) {
            Map<String, Object> val = new LinkedHashMap<>();
            val.put("bookings", entry.getValue()[0]);
            val.put("usageHours", entry.getValue()[1]);
            byFacilityFormatted.put(entry.getKey(), val);
        }

        Map<String, Long> statusBreakdown = new LinkedHashMap<>();
        statusBreakdown.put("confirmed", bookings.stream().filter(b -> b.getStatus() == BookingStatus.CONFIRMED).count());
        statusBreakdown.put("cancelled", bookings.stream().filter(b -> b.getStatus() == BookingStatus.CANCELLED).count());
        statusBreakdown.put("completed", bookings.stream().filter(b -> b.getStatus() == BookingStatus.COMPLETED).count());

        Map<String, Object> quick = new LinkedHashMap<>();
        quick.put("totalBookings", bookings.size());
        quick.put("statusBreakdown", statusBreakdown);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("month", month);
        result.put("quick", quick);
        result.put("byFacility", byFacilityFormatted);

        return result;
    }

    @GetMapping("/custom")
    public Map<String, Object> custom(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) Long facilityId,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) Long sportId
    ) {
        List<Booking> allBookings = bookingRepository.findAll();

        if (startDate != null && endDate != null) {
            LocalDateTime start = LocalDate.parse(startDate).atStartOfDay();
            LocalDateTime end = LocalDate.parse(endDate).plusDays(1).atStartOfDay();
            LocalDateTime finalEnd = end;
            allBookings = allBookings.stream()
                    .filter(b -> !b.getStartTime().isBefore(start) && !b.getStartTime().isAfter(finalEnd))
                    .collect(Collectors.toList());
        }

        if (facilityId != null) {
            allBookings = allBookings.stream()
                    .filter(b -> b.getFacility().getId().equals(facilityId))
                    .collect(Collectors.toList());
        }

        if (userId != null) {
            allBookings = allBookings.stream()
                    .filter(b -> b.getUser().getId().equals(userId))
                    .collect(Collectors.toList());
        }

        if (sportId != null) {
            allBookings = allBookings.stream()
                    .filter(b -> b.getFacility().getId().equals(sportId))
                    .collect(Collectors.toList());
        }

        Map<String, Long> statusBreakdown = allBookings.stream()
                .collect(Collectors.groupingBy(
                        b -> b.getStatus().name(),
                        Collectors.counting()
                ));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", allBookings.size());
        result.put("statusBreakdown", statusBreakdown);
        result.put("data", allBookings);

        return result;
    }

    @PostMapping("/save-local")
    public Map<String, Object> saveLocalReport(@RequestBody Map<String, String> request) {
        String htmlContent = request.get("htmlContent");
        Map<String, Object> result = new LinkedHashMap<>();
        if (htmlContent == null || htmlContent.trim().isEmpty()) {
            result.put("success", false);
            result.put("message", "HTML content is required");
            return result;
        }

        List<String> savedPaths = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        // Path 1: User's Downloads folder
        String userHome = System.getProperty("user.home");
        if (userHome != null) {
            java.io.File downloadsFolder = new java.io.File(userHome, "Downloads");
            if (downloadsFolder.exists() && downloadsFolder.isDirectory()) {
                java.io.File reportFile = new java.io.File(downloadsFolder, "Badya_Athletics_Executive_AI_Audit.html");
                try (java.io.FileWriter writer = new java.io.FileWriter(reportFile)) {
                    writer.write(htmlContent);
                    savedPaths.add(reportFile.getAbsolutePath());
                } catch (Exception e) {
                    errors.add("Downloads folder error: " + e.getMessage());
                }
            } else {
                errors.add("Downloads folder not found at: " + downloadsFolder.getAbsolutePath());
            }
        }

        // Path 2: Project root directory
        String projectDir = System.getProperty("user.dir");
        if (projectDir != null) {
            java.io.File reportFile = new java.io.File(projectDir, "Badya_Athletics_Executive_AI_Audit.html");
            try (java.io.FileWriter writer = new java.io.FileWriter(reportFile)) {
                writer.write(htmlContent);
                savedPaths.add(reportFile.getAbsolutePath());
            } catch (Exception e) {
                errors.add("Project root folder error: " + e.getMessage());
            }
        }

        if (savedPaths.isEmpty()) {
            result.put("success", false);
            result.put("message", "Could not write to any folder: " + String.join(", ", errors));
            return result;
        }

        result.put("success", true);
        result.put("message", "Report saved successfully to your device!");
        result.put("paths", savedPaths);
        return result;
    }
}
