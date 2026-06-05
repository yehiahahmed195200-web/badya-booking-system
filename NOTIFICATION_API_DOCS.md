# Notification System API Documentation

## Base URL
```
http://localhost:4000/api/notifications
```

## Authentication
All endpoints require `Authorization: Bearer {token}` header.

---

## Endpoints

### 1. Get Notifications
**GET** `/api/notifications`

**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `pageSize` (optional, default: 20, max: 100) - Items per page
- `unreadOnly` (optional) - Filter unread only
- `status` (optional) - Filter by status: QUEUED, PROCESSING, SENT, FAILED, ARCHIVED
- `channel` (optional) - Filter by channel: APP, EMAIL, SMS, PUSH, WEBHOOK

**Response:**
```json
{
  "total": 25,
  "page": 1,
  "pageSize": 20,
  "totalPages": 2,
  "items": [
    {
      "id": "ntf_abc123",
      "userId": "user_xyz",
      "title": "Booking Confirmed",
      "message": "Your booking at Court A has been confirmed",
      "channel": "APP",
      "type": "BOOKING",
      "priority": "NORMAL",
      "status": "SENT",
      "read": false,
      "readAt": null,
      "sentAt": "2026-05-15T10:30:00.000Z",
      "createdAt": "2026-05-15T10:30:00.000Z"
    }
  ]
}
```

---

### 2. Get Unread Count
**GET** `/api/notifications/unread-count`

**Response:**
```json
{
  "unreadCount": 3
}
```

---

### 3. Mark Notification as Read
**PATCH** `/api/notifications/{id}/read`

**Response:**
```json
{
  "id": "ntf_abc123",
  "read": true,
  "readAt": "2026-05-15T10:35:00.000Z"
}
```

---

### 4. Mark All as Read
**PATCH** `/api/notifications/read-all`

**Response:**
```json
{
  "updated": 5
}
```

---

### 5. Archive Notification
**PATCH** `/api/notifications/{id}/archive`

**Response:**
```json
{
  "id": "ntf_abc123",
  "status": "ARCHIVED",
  "failureReason": "ARCHIVED_BY_USER"
}
```

---

### 6. Get Preferences
**GET** `/api/notifications/preferences`

**Response:**
```json
{
  "id": "pref_xyz",
  "userId": "user_abc",
  "appEnabled": true,
  "emailEnabled": true,
  "smsEnabled": false,
  "pushEnabled": true,
  "bookingEnabled": true,
  "attendanceEnabled": true,
  "securityEnabled": true,
  "accountEnabled": true,
  "rewardEnabled": true,
  "quietHoursStart": null,
  "quietHoursEnd": null,
  "timezone": null
}
```

---

### 7. Update Preferences
**PUT** `/api/notifications/preferences`

**Request Body:**
```json
{
  "emailEnabled": false,
  "smsEnabled": true,
  "pushEnabled": true,
  "quietHoursStart": 22,
  "quietHoursEnd": 8,
  "timezone": "Africa/Cairo"
}
```

**Response:** Same as Get Preferences

---

### 8. Send Test Notification
**POST** `/api/notifications/test`

**Request Body:**
```json
{
  "title": "Test Notification",
  "message": "This is a test notification",
  "channel": "APP",
  "type": "SYSTEM",
  "priority": "NORMAL"
}
```

**Response:**
```json
{
  "id": "ntf_test123",
  "userId": "user_abc",
  "title": "Test Notification",
  "message": "This is a test notification",
  "status": "QUEUED"
}
```

---

### 9. Broadcast Notification (Admin/Manager Only)
**POST** `/api/notifications/broadcast`

**Request Body:**
```json
{
  "title": "Maintenance Notice",
  "message": "All courts will be closed for maintenance tomorrow",
  "channel": "EMAIL",
  "type": "SYSTEM",
  "priority": "HIGH",
  "roles": ["STUDENT", "COACH"],
  "dedupeKeyPrefix": "maintenance-may-16",
  "expiresAt": "2026-05-16T23:59:59Z"
}
```

**Response:**
```json
{
  "targetedUsers": 250,
  "total": 250,
  "queued": 250,
  "archived": 0
}
```

---

### 10. Process Queue Manually (Admin/Manager Only)
**POST** `/api/notifications/process-queue`

**Response:**
```json
{
  "processed": 45,
  "sent": 42,
  "failed": 2,
  "skipped": 1
}
```

---

## Notification Types
- `SYSTEM` - System-wide notifications
- `BOOKING` - Booking-related notifications
- `ATTENDANCE` - Attendance/check-in notifications
- `ACCOUNT` - Account-related notifications
- `SECURITY` - Security alerts
- `REWARD` - Reward/gamification notifications
- `ADMIN` - Admin notifications

## Priorities
- `CRITICAL` - Highest priority
- `HIGH` - High priority
- `NORMAL` - Default priority
- `LOW` - Low priority

## Channels
- `APP` - In-app notifications (internal, always available)
- `EMAIL` - Email notifications
- `SMS` - SMS notifications
- `PUSH` - Push notifications
- `WEBHOOK` - Webhook callbacks

---

## Status Lifecycle
1. `QUEUED` - Waiting to be processed
2. `PROCESSING` - Currently being sent
3. `SENT` - Successfully delivered
4. `FAILED` - Delivery failed (will retry)
5. `ARCHIVED` - User archived or system archived

---

## Retry Policy
- Maximum attempts: 3 (configurable per notification)
- Exponential backoff: 1 min → 2 min → 4 min → ...
- Auto-retry on failure

---

## Testing with cURL

### Get notifications
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:4000/api/notifications
```

### Send test notification
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test",
    "message": "This is a test",
    "channel": "APP",
    "type": "SYSTEM"
  }' \
  http://localhost:4000/api/notifications/test
```

### Mark all as read
```bash
curl -X PATCH \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:4000/api/notifications/read-all
```

### Update preferences
```bash
curl -X PUT \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "emailEnabled": false,
    "smsEnabled": true
  }' \
  http://localhost:4000/api/notifications/preferences
```
