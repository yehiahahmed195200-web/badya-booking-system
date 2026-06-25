package com.badya.booking.model;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class UserAccount {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(name = "email", nullable = false, unique = true)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    private UserRole role;

    @Column(name = "banned", nullable = false)
    private boolean banned = false;

    @Column(name = "warnings", nullable = false)
    private Integer warnings = 0;

    @Column(name = "earned_points", nullable = false)
    private Integer earnedPoints = 0;

    @Column(name = "active_bookings", nullable = false)
    private Integer activeBookings = 0;

    @Column(name = "email_notifications", nullable = false)
    private boolean emailNotifications = true;

    @Column(name = "push_notifications", nullable = false)
    private boolean pushNotifications = true;

    @Column(name = "credits", nullable = false)
    private Integer credits = 10;

    @Column(name = "reserved_credits", nullable = false)
    private Integer reservedCredits = 0;

    @Column(name = "student_id", nullable = true, unique = true)
    private String studentId;

    @Column(name = "barcode", nullable = true, unique = true)
    private String barcode;

    @Column(name = "device_id", nullable = true)
    private String deviceId;

    @Column(name = "otp_code", nullable = true)
    private String otpCode;

    @Column(name = "otp_expiry", nullable = true)
    private java.time.LocalDateTime otpExpiry;

    @Column(name = "pending_device_id", nullable = true)
    private String pendingDeviceId;

    @Column(name = "device_change_status", nullable = true)
    private String deviceChangeStatus;

    @Column(name = "device_change_requested_at", nullable = true)
    private java.time.LocalDateTime deviceChangeRequestedAt;

    @Column(name = "skilllevel", nullable = true)
    private String skillLevel = "Intermediate";

    @Column(name = "terms_accepted", nullable = false)
    private boolean termsAccepted = false;

    @Column(name = "terms_accepted_at", nullable = true)
    private java.time.LocalDateTime termsAcceptedAt;

    @Column(name = "terms_accepted_version", nullable = true)
    private String termsAcceptedVersion;


    public Long getId() {
        return id;
    }

    public Integer getCredits() {
        return credits;
    }

    public void setCredits(Integer credits) {
        this.credits = credits;
    }

    public Integer getReservedCredits() {
        return reservedCredits;
    }

    public void setReservedCredits(Integer reservedCredits) {
        this.reservedCredits = reservedCredits;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public UserRole getRole() {
        return role;
    }

    public void setRole(UserRole role) {
        this.role = role;
    }

    public boolean isBanned() {
        return banned;
    }

    public void setBanned(boolean banned) {
        this.banned = banned;
    }

    public Integer getWarnings() {
        return warnings;
    }

    public void setWarnings(Integer warnings) {
        this.warnings = warnings;
    }

    public Integer getEarnedPoints() {
        return earnedPoints;
    }

    public void setEarnedPoints(Integer earnedPoints) {
        this.earnedPoints = earnedPoints;
    }

    public Integer getActiveBookings() {
        return activeBookings;
    }

    public void setActiveBookings(Integer activeBookings) {
        this.activeBookings = activeBookings;
    }

    public boolean isEmailNotificationsEnabled() {
        return emailNotifications;
    }

    public void setEmailNotifications(boolean emailNotifications) {
        this.emailNotifications = emailNotifications;
    }

    public boolean isPushNotificationsEnabled() {
        return pushNotifications;
    }

    public void setPushNotifications(boolean pushNotifications) {
        this.pushNotifications = pushNotifications;
    }

    public String getStudentId() {
        return studentId;
    }

    public void setStudentId(String studentId) {
        this.studentId = studentId;
    }

    public String getBarcode() {
        return barcode;
    }

    public void setBarcode(String barcode) {
        this.barcode = barcode;
    }

    public String getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(String deviceId) {
        this.deviceId = deviceId;
    }

    public String getOtpCode() {
        return otpCode;
    }

    public void setOtpCode(String otpCode) {
        this.otpCode = otpCode;
    }

    public java.time.LocalDateTime getOtpExpiry() {
        return otpExpiry;
    }

    public void setOtpExpiry(java.time.LocalDateTime otpExpiry) {
        this.otpExpiry = otpExpiry;
    }

    public String getPendingDeviceId() {
        return pendingDeviceId;
    }

    public void setPendingDeviceId(String pendingDeviceId) {
        this.pendingDeviceId = pendingDeviceId;
    }

    public String getDeviceChangeStatus() {
        return deviceChangeStatus;
    }

    public void setDeviceChangeStatus(String deviceChangeStatus) {
        this.deviceChangeStatus = deviceChangeStatus;
    }

    public java.time.LocalDateTime getDeviceChangeRequestedAt() {
        return deviceChangeRequestedAt;
    }

    public void setDeviceChangeRequestedAt(java.time.LocalDateTime deviceChangeRequestedAt) {
        this.deviceChangeRequestedAt = deviceChangeRequestedAt;
    }

    public String getSkillLevel() {
        return skillLevel;
    }

    public void setSkillLevel(String skillLevel) {
        this.skillLevel = skillLevel;
    }

    public boolean isTermsAccepted() {
        return termsAccepted;
    }

    public void setTermsAccepted(boolean termsAccepted) {
        this.termsAccepted = termsAccepted;
    }

    public java.time.LocalDateTime getTermsAcceptedAt() {
        return termsAcceptedAt;
    }

    public void setTermsAcceptedAt(java.time.LocalDateTime termsAcceptedAt) {
        this.termsAcceptedAt = termsAcceptedAt;
    }

    public String getTermsAcceptedVersion() {
        return termsAcceptedVersion;
    }

    public void setTermsAcceptedVersion(String termsAcceptedVersion) {
        this.termsAcceptedVersion = termsAcceptedVersion;
    }
}
