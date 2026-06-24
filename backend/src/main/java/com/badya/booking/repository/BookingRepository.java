package com.badya.booking.repository;

import com.badya.booking.model.Booking;
import com.badya.booking.model.BookingStatus;
import com.badya.booking.model.AttendanceStatus;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

public interface BookingRepository extends JpaRepository<Booking, Long> {
    Booking findFirstByUserIdAndAttendanceStatusInAndStudentLatitudeIsNotNullOrderByCheckedInAtDesc(
            Long userId,
            List<AttendanceStatus> statuses);

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

    List<Booking> findByStatusAndReminderSentFalseAndStartTimeBetween(BookingStatus status, LocalDateTime start, LocalDateTime end);

    List<Booking> findByFacilityIdAndStartTimeBetween(Long facilityId, LocalDateTime start, LocalDateTime end);

    long countByUserIdAndStatusInAndStartTimeBetween(Long userId, List<BookingStatus> statuses, LocalDateTime start, LocalDateTime end);

    List<Booking> findByUserIdAndStatusInAndStartTimeBetween(Long userId, List<BookingStatus> statuses, LocalDateTime start, LocalDateTime end);

    List<Booking> findByUserId(Long userId);

    List<Booking> findByUserIdAndStatusInAndStartTimeLessThanAndEndTimeGreaterThan(
            Long userId,
            List<BookingStatus> statuses,
            LocalDateTime endTime,
            LocalDateTime startTime);

    long countByUserIdAndStatus(Long userId, BookingStatus status);

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT b FROM Booking b LEFT JOIN b.bookingParticipants bp WHERE b.user.id = :userId OR bp.user.id = :userId")
    List<Booking> findAllForUser(@org.springframework.data.repository.query.Param("userId") Long userId);

    List<Booking> findByStatusAndExpiryTimeBefore(BookingStatus status, LocalDateTime expiryTime);

    @Modifying
    @Transactional
    void deleteByFacilityId(Long facilityId);
}
