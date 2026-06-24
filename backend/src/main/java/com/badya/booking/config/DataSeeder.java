package com.badya.booking.config;

import com.badya.booking.model.Facility;
import com.badya.booking.model.Booking;
import com.badya.booking.model.BookingStatus;
import com.badya.booking.model.UserAccount;
import com.badya.booking.model.UserRole;
import com.badya.booking.repository.BookingRepository;
import com.badya.booking.repository.FacilityRepository;
import com.badya.booking.repository.NotificationRepository;
import com.badya.booking.repository.UserRepository;
import com.badya.booking.model.Notification;
import com.badya.booking.model.NotificationType;
import com.badya.booking.model.MedicalRecord;
import com.badya.booking.model.FairnessConfig;
import com.badya.booking.repository.MedicalRecordRepository;
import com.badya.booking.repository.FairnessConfigRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import com.badya.booking.service.FacilityService;
import java.time.LocalDateTime;

@Configuration
public class DataSeeder {

    @Bean
    CommandLineRunner seedData(
            UserRepository userRepository,
            FacilityRepository facilityRepository,
            NotificationRepository notificationRepository,
            BookingRepository bookingRepository,
            MedicalRecordRepository medicalRecordRepository,
            FairnessConfigRepository fairnessConfigRepository,
            FacilityService facilityService) {
        return args -> {
            if (fairnessConfigRepository.count() == 0) {
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
                fairnessConfigRepository.save(config);
            }

            if (userRepository.findByEmail("admin@badya.edu").isEmpty()) {
                UserAccount admin = new UserAccount();
                admin.setFullName("System Admin");
                admin.setEmail("admin@badya.edu");
                admin.setRole(UserRole.ADMIN);
                admin.setBanned(false);
                admin.setEarnedPoints(150);
                admin.setActiveBookings(0);
                admin.setEmailNotifications(true);
                admin.setPushNotifications(true);
                admin.setStudentId("ADM001");
                admin.setBarcode("ADM001");
                userRepository.save(admin);
            }

            if (userRepository.findByEmail("coach.kareem@badya.edu").isEmpty()) {
                UserAccount coach = new UserAccount();
                coach.setFullName("Coach Kareem");
                coach.setEmail("coach.kareem@badya.edu");
                coach.setRole(UserRole.COACH);
                coach.setBanned(false);
                coach.setEarnedPoints(200);
                coach.setActiveBookings(1);
                coach.setEmailNotifications(true);
                coach.setPushNotifications(true);
                coach.setStudentId("COA001");
                coach.setBarcode("COA001");
                userRepository.save(coach);
            }

            if (userRepository.findByEmail("student1@badya.edu").isEmpty()) {
                UserAccount student = new UserAccount();
                student.setFullName("Student One");
                student.setEmail("student1@badya.edu");
                student.setRole(UserRole.STUDENT);
                student.setBanned(false);
                student.setEarnedPoints(75);
                student.setActiveBookings(0);
                student.setEmailNotifications(true);
                student.setPushNotifications(true);
                student.setStudentId("STD001");
                student.setBarcode("STD001");
                userRepository.save(student);
            }

            if (userRepository.findByEmail("banned@badya.edu").isEmpty()) {
                UserAccount bannedStudent = new UserAccount();
                bannedStudent.setFullName("Banned Student");
                bannedStudent.setEmail("banned@badya.edu");
                bannedStudent.setRole(UserRole.STUDENT);
                bannedStudent.setBanned(true);
                bannedStudent.setEarnedPoints(0);
                bannedStudent.setActiveBookings(0);
                bannedStudent.setStudentId("STD002");
                bannedStudent.setBarcode("STD002");
                userRepository.save(bannedStudent);
            }

            UserAccount student = userRepository.findByEmail("student1@badya.edu").orElse(null);
            UserAccount coach = userRepository.findByEmail("coach.kareem@badya.edu").orElse(null);

            if (student != null && coach != null) {
                if (notificationRepository.count() == 0) {
                    // Seed notifications for student
                    Notification notif1 = new Notification();
                    notif1.setUser(student);
                    notif1.setTitle("Booking Confirmed");
                    notif1.setMessage("Your booking for Tennis Court A has been confirmed for tomorrow at 2 PM");
                    notif1.setType(NotificationType.BOOKING_CONFIRMED);
                    notif1.setCreatedAt(LocalDateTime.now().minusHours(2));
                    notif1.setRead(false);
                    notificationRepository.save(notif1);

                    Notification notif2 = new Notification();
                    notif2.setUser(student);
                    notif2.setTitle("Points Earned");
                    notif2.setMessage("You earned 25 points for your reservation at Gym Hall!");
                    notif2.setType(NotificationType.POINTS_EARNED);
                    notif2.setCreatedAt(LocalDateTime.now().minusDays(1));
                    notif2.setRead(true);
                    notificationRepository.save(notif2);

                    Notification notif3 = new Notification();
                    notif3.setUser(coach);
                    notif3.setTitle("Booking Reminder");
                    notif3.setMessage("Reminder: Your booking for Basketball Court starts in 30 minutes");
                    notif3.setType(NotificationType.BOOKING_REMINDER);
                    notif3.setCreatedAt(LocalDateTime.now().minusMinutes(30));
                    notif3.setRead(false);
                    notificationRepository.save(notif3);
                }

                if (medicalRecordRepository.count() == 0) {
                    // Seed medical records for student
                    MedicalRecord med1 = new MedicalRecord();
                    med1.setUser(student);
                    med1.setDocumentName("Annual_Medical_Clearance_2025.pdf");
                    med1.setDocumentUrl("/mock-uploads/Annual_Medical_Clearance_2025.pdf");
                    med1.setDescription("Student is medically fit and cleared for all high-intensity athletic activities and sports (Football, Basketball).");
                    med1.setStatus("APPROVED");
                    med1.setSubmittedBy("COACH");
                    med1.setCreatedAt(LocalDateTime.now().minusMonths(6));
                    medicalRecordRepository.save(med1);

                    MedicalRecord med2 = new MedicalRecord();
                    med2.setUser(student);
                    med2.setDocumentName("Cardio_Assessment_Report_May_2026.pdf");
                    med2.setDocumentUrl("/mock-uploads/Cardio_Assessment_Report_May_2026.pdf");
                    med2.setDescription("Routine post-injury stress test and cardiovascular endurance assessment. Pending final approval by advising board.");
                    med2.setStatus("PENDING");
                    med2.setSubmittedBy("STUDENT");
                    med2.setCreatedAt(LocalDateTime.now().minusDays(1));
                    medicalRecordRepository.save(med2);
                }
            }

            // Seed or update facilities
            upsertFacility(facilityRepository, "Tennis Court", "Sport", "09:00", "15:00", 60, 2, 4, "Tennis", 29.857926, 30.906440, 0.004);
            upsertFacility(facilityRepository, "Football Court", "Sport", "09:00", "15:00", 60, 10, 22, "Football", 29.858541, 30.906423, 0.004);
            upsertFacility(facilityRepository, "Padel 1", "Sport", "09:00", "15:00", 60, 2, 4, "Padel", 30.0546, 31.3574, 0.004);
            upsertFacility(facilityRepository, "Padel 2", "Sport", "09:00", "15:00", 60, 2, 4, "Padel", 29.858683, 30.906268, 0.004);
            upsertFacility(facilityRepository, "UFC Gym", "Fitness", "09:00", "15:00", 60, 1, 30, "Fitness", 30.0540, 31.3560, 0.004);
            upsertFacility(facilityRepository, "Table Tennis 1", "Activity Center", "09:00", "15:00", 60, 2, 4, "Table Tennis", 30.0548, 31.3576, 0.004);
            upsertFacility(facilityRepository, "Table Tennis 2", "Activity Center", "09:00", "15:00", 60, 2, 4, "Table Tennis", 30.0549, 31.3577, 0.004);
            upsertFacility(facilityRepository, "Billiards", "Activity Center", "09:00", "15:00", 60, 2, 4, "Billiards", 30.0550, 31.3578, 0.004);
            upsertFacility(facilityRepository, "Air Hockey 1", "Activity Center", "09:00", "15:00", 60, 2, 4, "Air Hockey", 30.0551, 31.3579, 0.004);
            upsertFacility(facilityRepository, "Air Hockey 2", "Activity Center", "09:00", "15:00", 60, 2, 4, "Air Hockey", 30.0552, 31.3580, 0.004);

            // Clean up any old facilities not matching the seed list
            java.util.List<String> allowedNames = java.util.List.of(
                "Tennis Court", "Football Court", "Padel 1", "Padel 2", "UFC Gym",
                "Table Tennis 1", "Table Tennis 2", "Billiards", "Air Hockey 1", "Air Hockey 2"
            );
            java.util.List<Facility> allFacilities = facilityRepository.findAll();
            for (Facility f : allFacilities) {
                if (!allowedNames.contains(f.getName())) {
                    facilityService.delete(f.getId());
                }
            }

            if (bookingRepository.count() == 0) {
                UserAccount admin = userRepository.findAll().stream()
                        .filter(u -> u.getRole() == UserRole.ADMIN)
                        .findFirst()
                        .orElse(null);

                UserAccount studentOne = userRepository.findAll().stream()
                    .filter(u -> u.getRole() == UserRole.STUDENT && !u.isBanned())
                        .findFirst()
                        .orElse(null);

                UserAccount studentTwo = userRepository.findAll().stream()
                        .filter(u -> u.getRole() == UserRole.COACH)
                        .findFirst()
                        .orElse(null);

                Facility primaryFacility = facilityRepository.findAll().stream().findFirst().orElse(null);

                if (admin != null && studentOne != null && studentTwo != null && primaryFacility != null) {
                    LocalDateTime base = LocalDateTime.now().plusDays(1).withHour(10).withMinute(0).withSecond(0).withNano(0);
                    String seedConflictId = "conflict-seeded-demo";

                    Booking conflictA = new Booking();
                    conflictA.setUser(studentOne);
                    conflictA.setFacility(primaryFacility);
                    conflictA.setStartTime(base);
                    conflictA.setEndTime(base.plusMinutes(60));
                    conflictA.setParticipants(Math.max(2, primaryFacility.getMinParticipants()));
                    conflictA.setStatus(BookingStatus.CONFIRMED);
                    conflictA.setConflictId(seedConflictId);
                    conflictA.setCreatedAt(LocalDateTime.now().minusHours(3));
                    bookingRepository.save(conflictA);

                    Booking conflictB = new Booking();
                    conflictB.setUser(studentTwo);
                    conflictB.setFacility(primaryFacility);
                    conflictB.setStartTime(base.plusMinutes(30));
                    conflictB.setEndTime(base.plusMinutes(90));
                    conflictB.setParticipants(Math.max(2, primaryFacility.getMinParticipants()));
                    conflictB.setStatus(BookingStatus.CONFIRMED);
                    conflictB.setConflictId(seedConflictId);
                    conflictB.setCreatedAt(LocalDateTime.now().minusHours(2));
                    bookingRepository.save(conflictB);

                    Booking normalBooking = new Booking();
                    normalBooking.setUser(admin);
                    normalBooking.setFacility(primaryFacility);
                    normalBooking.setStartTime(base.plusMinutes(120));
                    normalBooking.setEndTime(base.plusMinutes(180));
                    normalBooking.setParticipants(Math.max(2, primaryFacility.getMinParticipants()));
                    normalBooking.setStatus(BookingStatus.CONFIRMED);
                    normalBooking.setCreatedAt(LocalDateTime.now().minusHours(1));
                    bookingRepository.save(normalBooking);
                }
            }
        };
    }

    private void upsertFacility(
            FacilityRepository facilityRepository,
            String name,
            String category,
            String openTime,
            String closeTime,
            int defaultSlotMins,
            int minParticipants,
            int maxParticipants,
            String sports,
            double latitude,
            double longitude,
            double geofencingRadius) {
        
        Facility facility = facilityRepository.findAll().stream()
                .filter(f -> f.getName().equalsIgnoreCase(name))
                .findFirst()
                .orElse(null);
        
        if (facility == null) {
            facility = new Facility();
            facility.setName(name);
            facility.setStatus("OPEN");
        }
        
        facility.setCategory(category);
        facility.setOpenTime(openTime);
        facility.setCloseTime(closeTime);
        facility.setDefaultSlotMins(defaultSlotMins);
        facility.setMinParticipants(minParticipants);
        facility.setMaxParticipants(maxParticipants);
        facility.setActive(true);
        facility.setLatitude(latitude);
        facility.setLongitude(longitude);
        facility.setGeofencingRadius(geofencingRadius);
        facility.setSports(sports);
        
        facilityRepository.save(facility);
    }
}
