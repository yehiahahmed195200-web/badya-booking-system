package com.badya.booking.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "waitlist_entries")
public class WaitlistEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private UserAccount user;

    @ManyToOne(optional = false)
    private Facility facility;

    @Column(nullable = false)
    private LocalDateTime desiredStartTime;

    @Column(nullable = false)
    private Integer participants;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public UserAccount getUser() { return user; }
    public void setUser(UserAccount user) { this.user = user; }
    public Facility getFacility() { return facility; }
    public void setFacility(Facility facility) { this.facility = facility; }
    public LocalDateTime getDesiredStartTime() { return desiredStartTime; }
    public void setDesiredStartTime(LocalDateTime desiredStartTime) { this.desiredStartTime = desiredStartTime; }
    public Integer getParticipants() { return participants; }
    public void setParticipants(Integer participants) { this.participants = participants; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
