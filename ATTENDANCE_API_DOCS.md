# 📍 Geofencing Attendance API Documentation

## Endpoints Overview

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/attendance/check-in` | تسجيل حضور الطالب | ✅ Bearer Token |
| POST | `/api/attendance/check-out` | تسجيل انصراف الطالب | ✅ Bearer Token |
| GET | `/api/attendance/booking/{bookingId}` | الحصول على معلومات الحضور | ✅ Bearer Token |

---

## 1️⃣ Check-in - تسجيل الحضور

### Request
```http
POST /api/attendance/check-in HTTP/1.1
Host: localhost:8080
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "bookingId": 1,
  "studentLatitude": 30.0544,
  "studentLongitude": 31.3572
}
```

### Response - Success (200 OK)
```json
{
  "success": true,
  "message": "تم تسجيل حضورك بنجاح!",
  "attendanceStatus": "CHECKED_IN",
  "distance": 0.025,
  "distanceMeters": 25,
  "checkedInAt": "2026-05-05T14:30:00"
}
```

### Response - Out of Geofence (400 Bad Request)
```json
{
  "success": false,
  "message": "أنت بعيد جداً عن المنشأة! المسافة: 7500 متر. يجب أن تكون ضمن 100 متر",
  "distance": 7.5,
  "allowedRadius": 0.1
}
```

### Response - Early Check-in (400 Bad Request)
```json
{
  "success": false,
  "message": "لم يحن موعد تسجيل الحضور بعد. يمكنك التسجيل من 15 دقيقة قبل الموعد"
}
```

### Response - Missed Deadline (400 Bad Request)
```json
{
  "success": false,
  "message": "لقد فاتك موعد الحجز. تم تسجيلك كـ لم يحضر"
}
```

### Error Cases

| Error | Status | Message | Reason |
|-------|--------|---------|--------|
| Booking Not Found | 400 | الحجز غير موجود | Invalid bookingId |
| Invalid Status | 400 | الحجز غير مؤكد أو تم إلغاؤه | Booking not CONFIRMED/APPROVED |
| Early | 400 | لم يحن موعد تسجيل الحضور بعد | Before 15-min window |
| Late | 400 | لقد فاتك موعد الحجز | >1 hour after start |
| Out of Range | 400 | أنت بعيد جداً عن المنشأة | Outside geofence radius |
| Server Error | 500 | خطأ: [message] | Internal error |

---

## 2️⃣ Check-out - تسجيل الانصراف

### Request
```http
POST /api/attendance/check-out HTTP/1.1
Host: localhost:8080
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "bookingId": 1
}
```

### Response - Success (200 OK)
```json
{
  "success": true,
  "message": "تم تسجيل انصرافك بنجاح!",
  "attendanceStatus": "CHECKED_OUT",
  "checkedOutAt": "2026-05-05T15:45:00",
  "duration": "75 دقيقة",
  "earnedPoints": 25
}
```

### Response - Not Checked In (400 Bad Request)
```json
{
  "success": false,
  "message": "يجب تسجيل حضورك أولاً قبل الانصراف"
}
```

### Error Cases

| Error | Status | Message | Reason |
|-------|--------|---------|--------|
| Booking Not Found | 400 | الحجز غير موجود | Invalid bookingId |
| Not Checked In | 400 | يجب تسجيل حضورك أولاً | attendanceStatus ≠ CHECKED_IN |
| Server Error | 500 | خطأ: [message] | Internal error |

---

## 3️⃣ Get Attendance Info - الحصول على معلومات الحضور

### Request
```http
GET /api/attendance/booking/1 HTTP/1.1
Host: localhost:8080
Authorization: Bearer YOUR_TOKEN
```

### Response - Success (200 OK)
```json
{
  "bookingId": 1,
  "attendanceStatus": "CHECKED_OUT",
  "checkedInAt": "2026-05-05T14:30:00",
  "checkedOutAt": "2026-05-05T15:45:00",
  "distanceFromFacility": 0.025,
  "facilityLocation": {
    "latitude": 30.0544,
    "longitude": 31.3572,
    "radius": 100
  },
  "studentLocation": {
    "latitude": 30.0544,
    "longitude": 31.3572
  },
  "verifiedBy": "STUDENT"
}
```

### Response - Not Checked In (200 OK)
```json
{
  "bookingId": 1,
  "attendanceStatus": "NOT_CHECKED_IN",
  "checkedInAt": null,
  "checkedOutAt": null,
  "distanceFromFacility": null,
  "facilityLocation": {
    "latitude": 30.0544,
    "longitude": 31.3572,
    "radius": 100
  },
  "studentLocation": null,
  "verifiedBy": null
}
```

### Error Cases

| Error | Status | Message | Reason |
|-------|--------|---------|--------|
| Booking Not Found | 400 | الحجز غير موجود | Invalid bookingId |
| Server Error | 500 | خطأ: [message] | Internal error |

---

## 📊 Data Models

### AttendanceStatus Enum
```
NOT_CHECKED_IN       → لم يتم تسجيل الحضور
CHECKED_IN          → تم تسجيل الحضور
CHECKED_OUT         → تم الانصراف
NO_SHOW             → لم يحضر
CANCELLED_BEFORE_START → تم الإلغاء قبل البداية
```

### Booking Response Fields
```typescript
{
  id: number,
  bookingId: string,
  userId: string,
  facilityId: string,
  startTime: DateTime,
  endTime: DateTime,
  participants: number,
  status: BookingStatus,
  
  // Attendance Fields
  attendanceStatus: AttendanceStatus,
  checkedInAt: DateTime | null,
  checkedOutAt: DateTime | null,
  studentLatitude: number | null,
  studentLongitude: number | null,
  distanceFromFacility: number | null,  // in kilometers
  verifiedBy: string | null,  // "STUDENT", "COACH", "SYSTEM"
  
  createdAt: DateTime
}
```

### Facility Response Fields (Geofencing Related)
```typescript
{
  id: string,
  name: string,
  category: string,
  
  // Location Fields
  latitude: number,
  longitude: number,
  geofencingRadius: number,  // in kilometers (default: 0.1 = 100m)
  
  // ... other fields
}
```

---

## 🔐 Authentication

All endpoints require Bearer token authentication:

```http
Authorization: Bearer {token}
```

Obtain token via login:
```bash
POST /auth/login
Content-Type: application/json

{
  "email": "student1@badya.edu",
  "password": "password"
}
```

---

## 🧮 Distance Calculation

Distance is calculated using **Haversine Formula**:
- Input: Two GPS coordinates (lat1, lon1, lat2, lon2)
- Output: Distance in kilometers
- Accuracy: ±5-10 meters (typical GPS accuracy)

Formula:
```
a = sin²(Δφ/2) + cos(φ1) × cos(φ2) × sin²(Δλ/2)
c = 2 × atan2(√a, √(1−a))
d = R × c

where:
- φ = latitude
- λ = longitude
- R = 6,371 km (Earth's radius)
```

---

## ⏱️ Timing Rules

### Check-in Window
- **Earliest**: 15 minutes before booking start time
- **Latest**: 60 minutes after booking start time (or marked as NO_SHOW)
- **Grace Period**: None (strict validation)

### No-Show Auto-Detection
- If 15 minutes pass after booking start without check-in
- Status automatically set to `NO_SHOW`
- Warning added to user account

### Points Calculation
- **Checked Out Successfully**: 25 points
- **Not Checked In**: 0 points
- **No-Show**: 0 points + 1 warning

---

## 🗺️ Geofence Configuration

### Default Radius
- **Default**: 0.1 km (100 meters)
- **Configurable per facility**
- **Range**: 0.01 km (10m) to 1 km (1000m)

### Typical Radii
```
University Sports Center: 0.5 km (500m)
Specific Court/Field:     0.1 km (100m)
Indoor Gym:              0.15 km (150m)
```

---

## 🧪 cURL Examples

### Check-in Success
```bash
curl -X POST http://localhost:8080/api/attendance/check-in \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "bookingId": 1,
    "studentLatitude": 30.0544,
    "studentLongitude": 31.3572
  }'
```

### Check-out
```bash
curl -X POST http://localhost:8080/api/attendance/check-out \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "bookingId": 1
  }'
```

### Get Attendance Info
```bash
curl -X GET http://localhost:8080/api/attendance/booking/1 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 📱 Frontend Integration

### JavaScript/React Example

```javascript
// Check-in
async function handleCheckIn(bookingId, latitude, longitude) {
  const response = await fetch('/api/attendance/check-in', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      bookingId,
      studentLatitude: latitude,
      studentLongitude: longitude
    })
  });
  
  const data = await response.json();
  if (data.success) {
    console.log('Check-in successful!', data.message);
    console.log('Distance:', data.distanceMeters, 'meters');
  } else {
    console.error('Check-in failed:', data.message);
  }
}

// Get Location
navigator.geolocation.getCurrentPosition(
  (position) => {
    const { latitude, longitude } = position.coords;
    handleCheckIn(bookingId, latitude, longitude);
  },
  (error) => console.error('Location error:', error)
);
```

---

## 🚨 Rate Limiting

Currently: **No rate limiting**

Recommended for production:
- 10 requests per minute per user
- 100 requests per minute per IP

---

## 📝 Logging

All attendance events are logged:
- Check-in success/failure with reason
- Check-out success
- Distance validation
- Geofence violations

Access logs via:
- Application logs (server console)
- Database audit tables (if implemented)
- Admin dashboard reports

---

## ✅ Testing Checklist

- [ ] Valid check-in within geofence
- [ ] Rejected check-in outside geofence
- [ ] Early check-in rejection
- [ ] Late check-in rejection (>1 hour)
- [ ] Successful check-out
- [ ] Check-out without prior check-in
- [ ] Get attendance info for various statuses
- [ ] Invalid booking ID handling
- [ ] Missing authentication token
- [ ] Database persistence

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-05-05 | Initial release with check-in/check-out |
| - | - | - |

---

Last Updated: May 5, 2026
