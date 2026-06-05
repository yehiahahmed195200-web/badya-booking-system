package com.badya.booking.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs", indexes = {
        @Index(name = "idx_action", columnList = "action"),
        @Index(name = "idx_admin_id", columnList = "admin_id"),
        @Index(name = "idx_created_at", columnList = "created_at")
})
public class AuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "admin_id")
    private UserAccount admin;

    @Column(nullable = false)
    private String action; // BOOKING_APPROVED, BOOKING_REJECTED, CONFLICT_RESOLVED, USER_WARNED, USER_BANNED, etc.

    @Column(columnDefinition = "TEXT")
    private String details; // JSON format: {targetUserId, targetBookingId, reason, etc.}

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private String ipAddress;

    @Column
    private String userAgent;

    // Constructors
    public AuditLog() {
    }

    public AuditLog(UserAccount admin, String action, String details, String ipAddress) {
        this.admin = admin;
        this.action = action;
        this.details = details;
        this.createdAt = LocalDateTime.now();
        this.ipAddress = ipAddress;
    }

    // Getters & Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public UserAccount getAdmin() {
        return admin;
    }

    public void setAdmin(UserAccount admin) {
        this.admin = admin;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent;
    }
}
