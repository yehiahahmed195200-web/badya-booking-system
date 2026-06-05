package com.badya.booking.repository;

import com.badya.booking.model.SystemRule;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SystemRuleRepository extends JpaRepository<SystemRule, Long> {
    Optional<SystemRule> findTopByOrderByIdAsc();
}
