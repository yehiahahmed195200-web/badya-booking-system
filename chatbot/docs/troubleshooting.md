# Badya System — Troubleshooting Guide

## Booking Issues

### "You already have a booking at this time"
You have an overlapping active booking. Check your existing bookings and cancel the conflicting one before creating a new one.

### "Facility is currently MAINTENANCE/TOURNAMENT/CLOSED"
The facility is temporarily unavailable. Check the status reason for details or browse other facilities.

### "Selected slot is outside facility operating hours"
The facility opens and closes at specific times. Check the facility's openTime/closeTime and select a slot within that range.

### "Reservations must be made at least 1 hour in advance"
On-the-spot booking is not allowed. Book at least 1 hour before your desired start time.

### "Participants must be between X and Y"
Each facility has minimum and maximum participant limits. Adjust the number of participants.

### "Daily booking limit of X reached"
You have reached the maximum number of bookings per day. Wait until tomorrow or ask an admin to increase the limit.

### "Cannot book more than X days in advance"
The advance booking window is limited. Book within the allowed window.

### "User is banned from booking"
Your account has been banned due to exceeding the warning threshold. Contact an administrator.

## Attendance Issues

### "لم يحن موعد تسجيل الحضور بعد"
(It's not time to check in yet.) Check-in opens 15 minutes before your booking start time. Wait until the window opens.

### "لقد فاتك موعد الحجز"
(You missed the booking.) You have 1 hour after start time to check in. After that, you're marked NO_SHOW.

### "أنت بعيد جداً عن المنشأة"
(You are too far from the facility.) You must be within the geofencing radius (default 100 meters) to check in. Move closer to the facility.

### "يجب تسجيل حضورك أولاً قبل الانصراف"
(You must check in first before checking out.) Check in first using the check-in endpoint.

## Login Issues

### "Invalid credentials"
The email or password is incorrect. Check your credentials or create a new account.

### "Access denied — Your account has been banned"
Your account is banned. Contact an administrator for assistance.

## Conflict & Approval

### "My booking is stuck on PENDING"
Your booking may require admin approval (PREMIUM facility or >10 participants) or may be part of a conflict. Wait for admin action or contact them.

### "My booking was rejected due to conflict resolution"
An admin resolved a scheduling conflict and chose another booking over yours. Check your notifications for details.
