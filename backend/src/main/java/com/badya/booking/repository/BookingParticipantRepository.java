package com.badya.booking.repository;

import com.badya.booking.model.BookingParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Repository
public interface BookingParticipantRepository extends JpaRepository<BookingParticipant, Long> {
    List<BookingParticipant> findByBookingId(Long bookingId);
    List<BookingParticipant> findByUserId(Long userId);
    long countByBookingId(Long bookingId);
    java.util.Optional<BookingParticipant> findByBookingIdAndUserId(Long bookingId, Long userId);

    @Modifying
    @Transactional
    @Query("DELETE FROM BookingParticipant bp WHERE bp.booking.facility.id = :facilityId")
    void deleteByFacilityId(@Param("facilityId") Long facilityId);
}
