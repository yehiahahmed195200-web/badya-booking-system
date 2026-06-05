package com.badya.booking.repository;

import com.badya.booking.model.FairnessConfig;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FairnessConfigRepository extends JpaRepository<FairnessConfig, Long> {
    Optional<FairnessConfig> findTopByOrderByIdAsc();
}
