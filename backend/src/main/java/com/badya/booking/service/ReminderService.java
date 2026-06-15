package com.badya.booking.service;

import com.badya.booking.model.Booking;
import com.badya.booking.model.BookingStatus;
import com.badya.booking.repository.BookingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ReminderService {
    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private NotificationService notificationService;

    // default reminder minutes before start; can be overridden by env or properties
    private final int reminderMinutes = Integer.parseInt(System.getenv().getOrDefault("BOOKING_REMINDER_MINUTES", "30"));

    // Run every minute and send reminders for bookings starting in `reminderMinutes`
    @Scheduled(fixedRate = 60000)
    public void sendReminders() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime windowStart = now;
        LocalDateTime windowEnd = now.plusMinutes(reminderMinutes);

        List<Booking> upcoming = bookingRepository.findByStatusAndReminderSentFalseAndStartTimeBetween(
                BookingStatus.CONFIRMED, windowStart, windowEnd);
        for (Booking b : upcoming) {
            try {
                notificationService.sendBookingReminder(b, true);
                b.setReminderSent(true);
                bookingRepository.save(b);
            } catch (Exception ex) {
                System.err.println("Reminder send failed for booking " + b.getId() + ": " + ex.getMessage());
            }
        }
    }
}
