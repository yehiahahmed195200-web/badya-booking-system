package com.badya.booking.repository;

import com.badya.booking.model.MedicalRecord;
import com.badya.booking.model.UserRole;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MedicalRecordRepository extends JpaRepository<MedicalRecord, Long> {
    List<MedicalRecord> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<MedicalRecord> findByUser_RoleOrderByCreatedAtDesc(UserRole role);
}
