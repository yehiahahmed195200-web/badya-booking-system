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
            FairnessConfigRepository fairnessConfigRepository) {
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

            if (facilityRepository.count() == 0) {
                Facility tennis = new Facility();
                tennis.setName("Tennis Court A");
                tennis.setCategory("Sport");
                tennis.setOpenTime("08:00");
                tennis.setCloseTime("15:00");
                tennis.setDefaultSlotMins(60);
                tennis.setMinParticipants(2);
                tennis.setMaxParticipants(4);
                tennis.setActive(true);
                tennis.setLatitude(30.0544); // القاهرة
                tennis.setLongitude(31.3572);
                tennis.setGeofencingRadius(0.004); // 4 متر
                tennis.setStatus("OPEN");
                tennis.setStatusReason(null);
                tennis.setSports("Tennis,Squash");
                facilityRepository.save(tennis);

                Facility basketball = new Facility();
                basketball.setName("Basketball Court");
                basketball.setCategory("Sport");
                basketball.setOpenTime("08:00");
                basketball.setCloseTime("15:00");
                basketball.setDefaultSlotMins(60);
                basketball.setMinParticipants(6);
                basketball.setMaxParticipants(12);
                basketball.setActive(true);
                basketball.setLatitude(30.0550); // بالقرب من Tennis Court
                basketball.setLongitude(31.3580);
                basketball.setGeofencingRadius(0.004); // 4 متر
                basketball.setStatus("OPEN");
                basketball.setStatusReason(null);
                basketball.setSports("Basketball,Volleyball");
                facilityRepository.save(basketball);

                Facility gym = new Facility();
                gym.setName("Gym Main Hall");
                gym.setCategory("Fitness");
                gym.setOpenTime("08:00");
                gym.setCloseTime("15:00");
                gym.setDefaultSlotMins(60);
                gym.setMinParticipants(1);
                gym.setMaxParticipants(30);
                gym.setActive(true);
                gym.setLatitude(30.0540); // بالقرب من بقية المنشآت
                gym.setLongitude(31.3560);
                gym.setGeofencingRadius(0.004); // 4 متر
                gym.setStatus("OPEN");
                gym.setStatusReason(null);
                gym.setSports("Fitness,Yoga,Cardio");
                facilityRepository.save(gym);
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
}
