# Badya Sport Booking System — Complete Platform Guide

## Platform Overview
Badya Sport Booking System is a university sports facility management platform. It allows students to book courts and facilities, tracks attendance via GPS, manages conflicts, and provides gamification rewards.

## User Roles
- **STUDENT**: Can book facilities, earn points, spin lucky wheel, provide feedback
- **COACH**: Can monitor bookings at managed facilities, review usage, view reports
- **ADMIN**: Full system control — manage facilities, users, conflicts, rules, audit logs
- **MANAGER**: Can approve premium bookings, view analytics and reports
- **DEAN**: High-level view of system analytics

## Core Features
1. Facility Management — CRUD, status (OPEN/MAINTENANCE/TOURNAMENT/CLOSED), operating hours
2. Booking System — 8 validation checks, conflict detection, approval workflow
3. Attendance Tracking — GPS geofencing check-in/out, heartbeat monitoring, auto-NO_SHOW
4. Notification Engine — Multi-channel (APP/EMAIL/SMS/PUSH/WEBHOOK), queue-based async delivery
5. Gamification — Points, lucky wheel, rewards, off-peak booking bonuses
6. Waitlist — Join waitlist, auto-promotion when slot becomes available
7. Reports & Analytics — Monthly reports, trends, popularity, heatmap, leaderboard
8. Audit Logging — Every admin action logged with IP address and timestamp
9. System Rules — Configurable limits (daily max, advance window, duration range)

## Booking Flow
1. User selects facility, date, time slot, and participants
2. System validates: ban status → facility OPEN → participants range → operating hours → 1-hour advance notice → no double-booking → daily limit → advance window
3. Conflict detection checks for overlapping bookings
4. If conflict → booking marked PENDING, conflict created, admins notified
5. If PREMIUM category or >10 participants → requires MANAGER approval
6. Otherwise → auto-CONFIRMED
7. Points awarded: 25 for off-peak (before 10AM/after 7PM), 10 for peak

## Attendance & Geofencing
- Uses Haversine formula to calculate GPS distance between student and facility
- Default geofencing radius: 100 meters (configurable per facility)
- Check-in window: 15 minutes before to 1 hour after start time
- Heartbeat endpoint updates student location during session
- NO_SHOW automatically applied if student doesn't check in within 1 hour
- Full attendance: 25 points earned

## Conflict Resolution
1. System detects overlapping bookings automatically
2. Creates UUID-based conflictId for all overlapping bookings
3. Admin views conflicts in dedicated dashboard tab
4. Admin selects which booking to approve; others auto-rejected
5. Notifications sent to all affected users
6. Full audit trail logged with admin identity and timestamp

## Points & Rewards
- Off-peak booking: 25 points
- Peak booking: 10 points
- Full attendance check-in: 25 points
- Lucky wheel: random reward spin (available rewards configured in system)
- Rewards: Extra time, free water bottle, etc.
- Auto-ban at 3 warnings (configurable threshold)

## Notification System
- Channels: APP (in-app), EMAIL, SMS, PUSH, WEBHOOK
- Queue-based async processing with exponential backoff retry
- Deduplication via userId + dedupeKey unique constraint
- User preferences per channel and type
- Quiet hours support
- Broadcast to roles or specific user lists
