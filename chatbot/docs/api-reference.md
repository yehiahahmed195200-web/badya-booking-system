# Badya API Reference for Technical Users

## Authentication
- POST /api/auth/login — Login with email, returns JWT token and user info
- POST /api/users — Register new user
- GET /api/users/me — Get current user profile (requires auth)
- GET /api/users/barcode/:barcode — Lookup user by student ID barcode

## Facilities
- GET /api/facilities — List all facilities (use ?activeOnly=true)
- POST /api/facilities — Create facility (ADMIN only)
- PATCH /api/facilities/:id/status — Change facility status (ADMIN only)
- PATCH /api/facilities/:id/settings — Update facility settings (ADMIN only)
- GET /api/facilities/:id/availability — Get time slot availability for a date
- GET /api/facilities/:id/repeat-check — Check if user has booked this facility before

## Bookings
- POST /api/bookings — Create booking { facilityId, startTime, participants, durationMins, termsAccepted, buddyIds }
- GET /api/bookings — List bookings (role-scoped)
- PATCH /api/bookings/:id/cancel — Cancel a booking
- POST /api/bookings/:id/reschedule — Reschedule a booking

## Attendance
- POST /api/attendance/check-in — Check in { bookingId, studentLatitude, studentLongitude }
- POST /api/attendance/check-out — Check out { bookingId }
- POST /api/attendance/heartbeat — Update GPS location during session
- GET /api/attendance/booking/:bookingId — Get attendance info

## Notifications
- GET /api/notifications — List user notifications (paginated)
- GET /api/notifications/unread-count — Get unread count
- PATCH /api/notifications/read-all — Mark all as read
- GET /api/notifications/preferences — Get user notification preferences
- PUT /api/notifications/preferences — Update notification preferences
- POST /api/notifications/broadcast — Broadcast to roles/users (ADMIN/MANAGER)

## Admin
- GET /api/admin/rules — Get system rules
- PUT /api/admin/rules — Update system rules
- POST /api/admin/users/:id/warn — Warn a user
- POST /api/admin/users/:id/ban — Ban a user
- POST /api/admin/users/:id/unban — Unban a user
- GET /api/admin/conflicts — List unresolved conflicts
- POST /api/admin/conflicts/:id/resolve — Resolve a conflict
- GET /api/admin/audit-logs — View audit log (paginated)
- CRUD /api/admin/sports — Manage sports

## Analytics
- GET /api/analytics/summary — Dashboard summary metrics
- GET /api/analytics/trends — 30-day booking trends
- GET /api/analytics/popularity — Sport popularity ranking
- GET /api/analytics/density — Booking density heatmap (7x24)
- GET /api/analytics/leaderboard — Top 10 most active users

## Reports
- GET /api/reports/monthly?month=YYYY-MM — Monthly booking report
- GET /api/reports/custom — Custom report with filters
