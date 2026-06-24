package com.badya.booking.model;

import jakarta.persistence.*;

@Entity
@Table(name = "facilities")
public class Facility {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, unique = true)
    private String name;

    @Column(name = "category", nullable = false)
    private String category;

    @Column(name = "open_time", nullable = false)
    private String openTime;

    @Column(name = "close_time", nullable = false)
    private String closeTime;

    @Column(name = "default_slot_mins", nullable = false)
    private Integer defaultSlotMins;

    @Column(name = "min_participants", nullable = false)
    private Integer minParticipants;

    @Column(name = "max_participants", nullable = false)
    private Integer maxParticipants;

    @Column(name = "active", nullable = false)
    private Boolean active;

    @Column(name = "status", nullable = true)
    private String status; // OPEN, MAINTENANCE, TOURNAMENT

    @Column(name = "status_reason", nullable = true, columnDefinition = "TEXT")
    private String statusReason; // Optional reason for status change

    @Column(name = "sports", nullable = true, columnDefinition = "TEXT")
    private String sports; // Comma-separated list of sports/activities (Tennis, Basketball, etc.)

    @Column(name = "latitude", nullable = true)
    private Double latitude; // موقع المنشأة - خط العرض

    @Column(name = "longitude", nullable = true)
    private Double longitude; // موقع المنشأة - خط الطول

    @Column(name = "geofencing_radius", nullable = true)
    private Double geofencingRadius; // نطاق الـ geofencing بالكيلومترات (قيمة افتراضية: 0.004 كم = 4 متر)

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getOpenTime() {
        return openTime;
    }

    public void setOpenTime(String openTime) {
        this.openTime = openTime;
    }

    public String getCloseTime() {
        return closeTime;
    }

    public void setCloseTime(String closeTime) {
        this.closeTime = closeTime;
    }

    public Integer getDefaultSlotMins() {
        return defaultSlotMins;
    }

    public void setDefaultSlotMins(Integer defaultSlotMins) {
        this.defaultSlotMins = defaultSlotMins;
    }

    public Integer getMinParticipants() {
        return minParticipants;
    }

    public void setMinParticipants(Integer minParticipants) {
        this.minParticipants = minParticipants;
    }

    public Integer getMaxParticipants() {
        return maxParticipants;
    }

    public void setMaxParticipants(Integer maxParticipants) {
        this.maxParticipants = maxParticipants;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public void setIsActive(Boolean active) {
        this.active = active;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getStatusReason() {
        return statusReason;
    }

    public void setStatusReason(String statusReason) {
        this.statusReason = statusReason;
    }

    public String getSports() {
        return sports;
    }

    public void setSports(String sports) {
        this.sports = sports;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public Double getGeofencingRadius() {
        return geofencingRadius;
    }

    public void setGeofencingRadius(Double geofencingRadius) {
        this.geofencingRadius = geofencingRadius;
    }
}
