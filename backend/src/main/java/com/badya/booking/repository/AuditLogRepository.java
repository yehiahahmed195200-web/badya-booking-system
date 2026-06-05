package com.badya.booking.repository;

import com.badya.booking.model.AuditLog;
import com.badya.booking.model.UserAccount;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    Page<AuditLog> findByAdminOrderByCreatedAtDesc(UserAccount admin, Pageable pageable);
    
    Page<AuditLog> findByActionOrderByCreatedAtDesc(String action, Pageable pageable);
    
    Page<AuditLog> findAllByOrderByCreatedAtDesc(Pageable pageable);
    
    List<AuditLog> findByCreatedAtBetween(LocalDateTime start, LocalDateTime end);
    
    List<AuditLog> findByAdminAndCreatedAtBetween(UserAccount admin, LocalDateTime start, LocalDateTime end);
    
    List<AuditLog> findByActionAndCreatedAtBetween(String action, LocalDateTime start, LocalDateTime end);
}
