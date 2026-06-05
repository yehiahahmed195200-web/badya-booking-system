package com.badya.booking.repository;

import com.badya.booking.model.WaitlistEntry;
import java.time.LocalDateTime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WaitlistRepository extends JpaRepository<WaitlistEntry, Long> {
    Optional<WaitlistEntry> findFirstByFacility_IdAndDesiredStartTimeOrderByCreatedAtAsc(Long facilityId, LocalDateTime desiredStartTime);
}
