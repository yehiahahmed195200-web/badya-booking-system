package com.badya.booking.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "bookings")
public class Booking {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @ManyToOne(optional = false)
    @JoinColumn(name = "facility_id", nullable = false)
    private Facility facility;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalDateTime endTime;

    @Column(name = "participants", nullable = false)
    private Integer participants;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private BookingStatus status;

    @Column(name = "conflict_id")
    private String conflictId;

    // Attendance Tracking Fields
    @Enumerated(EnumType.STRING)
    @Column(name = "attendance_status", nullable = false)
    private AttendanceStatus attendanceStatus = AttendanceStatus.NOT_CHECKED_IN;

    @Column(name = "checked_in_at", nullable = true)
    private LocalDateTime checkedInAt; // وقت تسجيل الحضور

    @Column(name = "checked_out_at", nullable = true)
    private LocalDateTime checkedOutAt; // وقت الانصراف

    @Column(name = "student_latitude", nullable = true)
    private Double studentLatitude; // موقع الطالب عند التحقق

    @Column(name = "student_longitude", nullable = true)
    private Double studentLongitude; // موقع الطالب عند التحقق

    @Column(name = "distance_from_facility", nullable = true)
    private Double distanceFromFacility; // المسافة بالكيلومترات من المنشأة

    @Column(name = "verified_by", nullable = true)
    private String verifiedBy; // من تحقق من الحضور (STUDENT, COACH, SYSTEM)

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_method", nullable = true)
    private VerificationMethod verificationMethod;

    @Column(name = "risk_score", nullable = true)
    private Integer riskScore;

    @Column(name = "scanned_id_data", nullable = true)
    private String scannedIdData;

    @Column(name = "reminder_sent", nullable = false)
    private boolean reminderSent = false;

    public Long getId() {
        return id;
    }

    public UserAccount getUser() {
        return user;
    }

    public void setUser(UserAccount user) {
        this.user = user;
    }

    public Facility getFacility() {
        return facility;
    }

    public void setFacility(Facility facility) {
        this.facility = facility;
    }

    public LocalDateTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalDateTime startTime) {
        this.startTime = startTime;
    }

    public LocalDateTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalDateTime endTime) {
        this.endTime = endTime;
    }

    public Integer getParticipants() {
        return participants;
    }

    public void setParticipants(Integer participants) {
        this.participants = participants;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public BookingStatus getStatus() {
        return status;
    }

    public void setStatus(BookingStatus status) {
        this.status = status;
    }

    public String getConflictId() {
        return conflictId;
    }

    public void setConflictId(String conflictId) {
        this.conflictId = conflictId;
    }

    public AttendanceStatus getAttendanceStatus() {
        return attendanceStatus;
    }

    public void setAttendanceStatus(AttendanceStatus attendanceStatus) {
        this.attendanceStatus = attendanceStatus;
    }

    public LocalDateTime getCheckedInAt() {
        return checkedInAt;
    }

    public void setCheckedInAt(LocalDateTime checkedInAt) {
        this.checkedInAt = checkedInAt;
    }

    public LocalDateTime getCheckedOutAt() {
        return checkedOutAt;
    }

    public void setCheckedOutAt(LocalDateTime checkedOutAt) {
        this.checkedOutAt = checkedOutAt;
    }

    public Double getStudentLatitude() {
        return studentLatitude;
    }

    public void setStudentLatitude(Double studentLatitude) {
        this.studentLatitude = studentLatitude;
    }

    public Double getStudentLongitude() {
        return studentLongitude;
    }

    public void setStudentLongitude(Double studentLongitude) {
        this.studentLongitude = studentLongitude;
    }

    public Double getDistanceFromFacility() {
        return distanceFromFacility;
    }

    public void setDistanceFromFacility(Double distanceFromFacility) {
        this.distanceFromFacility = distanceFromFacility;
    }

    public String getVerifiedBy() {
        return verifiedBy;
    }

    public void setVerifiedBy(String verifiedBy) {
        this.verifiedBy = verifiedBy;
    }

    public VerificationMethod getVerificationMethod() {
        return verificationMethod;
    }

    public void setVerificationMethod(VerificationMethod verificationMethod) {
        this.verificationMethod = verificationMethod;
    }

    public Integer getRiskScore() {
        return riskScore;
    }

    public void setRiskScore(Integer riskScore) {
        this.riskScore = riskScore;
    }


    public String getScannedIdData() {
        return scannedIdData;
    }

    public void setScannedIdData(String scannedIdData) {
        this.scannedIdData = scannedIdData;
    }

    public boolean isReminderSent() {
        return reminderSent;
    }

    public void setReminderSent(boolean reminderSent) {
        this.reminderSent = reminderSent;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
