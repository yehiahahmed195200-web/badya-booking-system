package com.badya.booking.repository;

import com.badya.booking.model.Facility;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FacilityRepository extends JpaRepository<Facility, Long> {
    List<Facility> findByActiveTrue();
}
