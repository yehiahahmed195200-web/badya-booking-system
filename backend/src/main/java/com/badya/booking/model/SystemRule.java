package com.badya.booking.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "system_rules")
public class SystemRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Integer maxBookingsPerUserPerDay = 3;

    @Column(nullable = false)
    private Integer autoBanWarningThreshold = 3;

    @Column(nullable = false)
    private Integer advanceBookingWindowDays = 7;

    @Column(nullable = false)
    private Integer minBookingDurationMins = 30;

    @Column(nullable = false)
    private Integer maxBookingDurationMins = 180;

    @Column(nullable = false)
    private Boolean priorityBookingEnabled = false;

    @Column(nullable = false)
    private Integer priorityScoreThreshold = 120;

    @Column(nullable = false)
    private Integer priorityEarlyAccessHours = 24;

    @Column(nullable = false)
    private Boolean allowBackToBackBookings = true;

    @Column(nullable = false)
    private Boolean globalEmailNotificationsEnabled = true;

    public Long getId() {
        return id;
    }

    public Integer getMaxBookingsPerUserPerDay() {
        return maxBookingsPerUserPerDay;
    }

    public void setMaxBookingsPerUserPerDay(Integer maxBookingsPerUserPerDay) {
        this.maxBookingsPerUserPerDay = maxBookingsPerUserPerDay;
    }

    public Integer getAutoBanWarningThreshold() {
        return autoBanWarningThreshold;
    }

    public void setAutoBanWarningThreshold(Integer autoBanWarningThreshold) {
        this.autoBanWarningThreshold = autoBanWarningThreshold;
    }

    public Integer getAdvanceBookingWindowDays() {
        return advanceBookingWindowDays;
    }

    public void setAdvanceBookingWindowDays(Integer advanceBookingWindowDays) {
        this.advanceBookingWindowDays = advanceBookingWindowDays;
    }

    public Integer getMinBookingDurationMins() {
        return minBookingDurationMins;
    }

    public void setMinBookingDurationMins(Integer minBookingDurationMins) {
        this.minBookingDurationMins = minBookingDurationMins;
    }

    public Integer getMaxBookingDurationMins() {
        return maxBookingDurationMins;
    }

    public void setMaxBookingDurationMins(Integer maxBookingDurationMins) {
        this.maxBookingDurationMins = maxBookingDurationMins;
    }

    public Boolean getPriorityBookingEnabled() {
        return priorityBookingEnabled;
    }

    public void setPriorityBookingEnabled(Boolean priorityBookingEnabled) {
        this.priorityBookingEnabled = priorityBookingEnabled;
    }

    public Integer getPriorityScoreThreshold() {
        return priorityScoreThreshold;
    }

    public void setPriorityScoreThreshold(Integer priorityScoreThreshold) {
        this.priorityScoreThreshold = priorityScoreThreshold;
    }

    public Integer getPriorityEarlyAccessHours() {
        return priorityEarlyAccessHours;
    }

    public void setPriorityEarlyAccessHours(Integer priorityEarlyAccessHours) {
        this.priorityEarlyAccessHours = priorityEarlyAccessHours;
    }

    public Boolean getAllowBackToBackBookings() {
        return allowBackToBackBookings;
    }

    public void setAllowBackToBackBookings(Boolean allowBackToBackBookings) {
        this.allowBackToBackBookings = allowBackToBackBookings;
    }

    public Boolean getGlobalEmailNotificationsEnabled() {
        return globalEmailNotificationsEnabled;
    }

    public void setGlobalEmailNotificationsEnabled(Boolean globalEmailNotificationsEnabled) {
        this.globalEmailNotificationsEnabled = globalEmailNotificationsEnabled;
    }
}
