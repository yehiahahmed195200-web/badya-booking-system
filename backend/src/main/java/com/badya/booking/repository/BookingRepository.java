package com.badya.booking.repository;

import com.badya.booking.model.Booking;
import com.badya.booking.model.BookingStatus;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookingRepository extends JpaRepository<Booking, Long> {
    List<Booking> findByFacilityIdAndStatusAndStartTimeLessThanAndEndTimeGreaterThan(
            Long facilityId,
            BookingStatus status,
            LocalDateTime endTime,
            LocalDateTime startTime);

        List<Booking> findByFacilityIdAndStatusInAndStartTimeLessThanAndEndTimeGreaterThan(
            Long facilityId,
            List<BookingStatus> statuses,
            LocalDateTime endTime,
            LocalDateTime startTime);

        List<Booking> findByConflictIdOrderByCreatedAtAsc(String conflictId);

        List<Booking> findByConflictIdAndStatusOrderByCreatedAtAsc(String conflictId, BookingStatus status);

    List<Booking> findByStartTimeBetween(LocalDateTime start, LocalDateTime end);

    List<Booking> findByFacilityIdAndStartTimeBetween(Long facilityId, LocalDateTime start, LocalDateTime end);

    long countByUserIdAndStatusInAndStartTimeBetween(Long userId, List<BookingStatus> statuses, LocalDateTime start, LocalDateTime end);

    List<Booking> findByUserIdAndStatusInAndStartTimeBetween(Long userId, List<BookingStatus> statuses, LocalDateTime start, LocalDateTime end);

    List<Booking> findByUserId(Long userId);
}
