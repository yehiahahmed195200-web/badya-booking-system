package com.badya.booking.repository;

import com.badya.booking.model.MatchmakingQueue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface MatchmakingQueueRepository extends JpaRepository<MatchmakingQueue, Long> {
    Optional<MatchmakingQueue> findByUserIdAndSportIdAndDateAndTimeSlot(Long userId, String sportId, String date, String timeSlot);
    List<MatchmakingQueue> findBySportIdAndFacilityIdAndDateAndTimeSlotOrderByCreatedAtAsc(String sportId, Long facilityId, String date, String timeSlot);
    List<MatchmakingQueue> findByUserId(Long userId);
    long countBySportIdAndFacilityIdAndDateAndTimeSlot(String sportId, Long facilityId, String date, String timeSlot);
    void deleteBySportIdAndFacilityIdAndDateAndTimeSlot(String sportId, Long facilityId, String date, String timeSlot);
}
