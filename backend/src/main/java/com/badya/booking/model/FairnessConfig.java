package com.badya.booking.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "fairness_config")
public class FairnessConfig {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "prime_time_start_hour", nullable = false)
    private Integer primeTimeStartHour = 17;

    @Column(name = "prime_time_end_hour", nullable = false)
    private Integer primeTimeEndHour = 21;

    @Column(name = "basketball_quota_percent", nullable = false)
    private Double basketballQuotaPercent = 60.0;

    @Column(name = "volleyball_quota_percent", nullable = false)
    private Double volleyballQuotaPercent = 40.0;

    @Column(name = "cooldown_period_hours", nullable = false)
    private Integer cooldownPeriodHours = 24;

    @Column(name = "max_weekly_reservations_per_user", nullable = false)
    private Integer maxWeeklyReservationsPerUser = 3;

    @Column(name = "consecutive_slot_limit", nullable = false)
    private Integer consecutiveSlotLimit = 2;

    @Column(name = "team_overlap_threshold_percent", nullable = false)
    private Double teamOverlapThresholdPercent = 50.0;

    @Column(name = "player_weight_coeff", nullable = false)
    private Double playerWeightCoeff = 0.4;

    @Column(name = "unused_hours_weight_coeff", nullable = false)
    private Double unusedHoursWeightCoeff = 0.3;

    @Column(name = "prime_time_disadvantage_coeff", nullable = false)
    private Double primeTimeDisadvantageCoeff = 0.3;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Integer getPrimeTimeStartHour() {
        return primeTimeStartHour;
    }

    public void setPrimeTimeStartHour(Integer primeTimeStartHour) {
        this.primeTimeStartHour = primeTimeStartHour;
    }

    public Integer getPrimeTimeEndHour() {
        return primeTimeEndHour;
    }

    public void setPrimeTimeEndHour(Integer primeTimeEndHour) {
        this.primeTimeEndHour = primeTimeEndHour;
    }

    public Double getBasketballQuotaPercent() {
        return basketballQuotaPercent;
    }

    public void setBasketballQuotaPercent(Double basketballQuotaPercent) {
        this.basketballQuotaPercent = basketballQuotaPercent;
    }

    public Double getVolleyballQuotaPercent() {
        return volleyballQuotaPercent;
    }

    public void setVolleyballQuotaPercent(Double volleyballQuotaPercent) {
        this.volleyballQuotaPercent = volleyballQuotaPercent;
    }

    public Integer getCooldownPeriodHours() {
        return cooldownPeriodHours;
    }

    public void setCooldownPeriodHours(Integer cooldownPeriodHours) {
        this.cooldownPeriodHours = cooldownPeriodHours;
    }

    public Integer getMaxWeeklyReservationsPerUser() {
        return maxWeeklyReservationsPerUser;
    }

    public void setMaxWeeklyReservationsPerUser(Integer maxWeeklyReservationsPerUser) {
        this.maxWeeklyReservationsPerUser = maxWeeklyReservationsPerUser;
    }

    public Integer getConsecutiveSlotLimit() {
        return consecutiveSlotLimit;
    }

    public void setConsecutiveSlotLimit(Integer consecutiveSlotLimit) {
        this.consecutiveSlotLimit = consecutiveSlotLimit;
    }

    public Double getTeamOverlapThresholdPercent() {
        return teamOverlapThresholdPercent;
    }

    public void setTeamOverlapThresholdPercent(Double teamOverlapThresholdPercent) {
        this.teamOverlapThresholdPercent = teamOverlapThresholdPercent;
    }

    public Double getPlayerWeightCoeff() {
        return playerWeightCoeff;
    }

    public void setPlayerWeightCoeff(Double playerWeightCoeff) {
        this.playerWeightCoeff = playerWeightCoeff;
    }

    public Double getUnusedHoursWeightCoeff() {
        return unusedHoursWeightCoeff;
    }

    public void setUnusedHoursWeightCoeff(Double unusedHoursWeightCoeff) {
        this.unusedHoursWeightCoeff = unusedHoursWeightCoeff;
    }

    public Double getPrimeTimeDisadvantageCoeff() {
        return primeTimeDisadvantageCoeff;
    }

    public void setPrimeTimeDisadvantageCoeff(Double primeTimeDisadvantageCoeff) {
        this.primeTimeDisadvantageCoeff = primeTimeDisadvantageCoeff;
    }
}
