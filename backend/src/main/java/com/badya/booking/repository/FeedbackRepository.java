package com.badya.booking.repository;

import com.badya.booking.model.Feedback;
import com.badya.booking.model.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Repository
public interface FeedbackRepository extends JpaRepository<Feedback, Long> {
    List<Feedback> findByUser(UserAccount user);

    @Modifying
    @Transactional
    void deleteByFacilityId(Long facilityId);
}
