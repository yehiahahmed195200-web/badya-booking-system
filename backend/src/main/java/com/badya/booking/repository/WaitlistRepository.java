package com.badya.booking.repository;

import com.badya.booking.model.WaitlistEntry;
import java.time.LocalDateTime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;
import java.util.Optional;
import java.util.List;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;

@Repository
public interface WaitlistRepository extends JpaRepository<WaitlistEntry, Long> {
    Optional<WaitlistEntry> findFirstByFacility_IdAndDesiredStartTimeOrderByCreatedAtAsc(Long facilityId, LocalDateTime desiredStartTime);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<WaitlistEntry> findByFacility_IdAndDesiredStartTimeOrderByCreatedAtAsc(Long facilityId, LocalDateTime desiredStartTime);

    @Modifying
    @Transactional
    void deleteByFacilityId(Long facilityId);
}
