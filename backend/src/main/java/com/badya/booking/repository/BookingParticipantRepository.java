package com.badya.booking.repository;

import com.badya.booking.model.BookingParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface BookingParticipantRepository extends JpaRepository<BookingParticipant, Long> {
    List<BookingParticipant> findByBookingId(Long bookingId);
    List<BookingParticipant> findByUserId(Long userId);
    long countByBookingId(Long bookingId);
}
