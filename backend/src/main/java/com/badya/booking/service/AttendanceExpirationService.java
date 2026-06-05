package com.badya.booking.service;

import com.badya.booking.model.AttendanceStatus;
import com.badya.booking.model.Booking;
import com.badya.booking.model.BookingStatus;
import com.badya.booking.repository.BookingRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class AttendanceExpirationService {

    private final BookingRepository bookingRepository;

    public AttendanceExpirationService(BookingRepository bookingRepository) {
        this.bookingRepository = bookingRepository;
    }

    @Scheduled(fixedRate = 60_000)
    @Transactional
    public void expireAttendance() {
        LocalDateTime now = LocalDateTime.now();

        List<Booking> expiredBookings = bookingRepository.findByStartTimeBetween(
                LocalDateTime.of(1900, 1, 1, 0, 0),
                now.minusHours(1)
        );

        for (Booking b : expiredBookings) {
            if (b.getStatus() != BookingStatus.CONFIRMED) continue;

            if (b.getEndTime().isBefore(now)) {
                b.setStatus(BookingStatus.COMPLETED);
            }

            if (b.getAttendanceStatus() == AttendanceStatus.NOT_CHECKED_IN) {
                b.setAttendanceStatus(AttendanceStatus.NO_SHOW);
            }

            bookingRepository.save(b);
        }
    }
}
