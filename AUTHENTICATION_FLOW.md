# Badya Sport Booking - Authentication Flow

This document describes the authentication flow implemented as per the diagram requirements.

## Flow Steps

### 1. **User opens app**
   - Frontend loads at `http://localhost:5173`
   - Login form is displayed

### 2. **Enter credentials**
   - User enters username (email) + password
   - Supported demo accounts:
     - `admin@badya.edu` → ADMIN role
     - `coach.kareem@badya.edu` → COACH role
     - `student1@badya.edu` → STUDENT role
     - `banned@badya.edu` → STUDENT role (BANNED - for testing "Access denied")

### 3. **Validate with registrar**
   - Backend checks if email exists in database
   - If not found → Error: "Invalid credentials"

### 4. **Show error** (if validation fails)
   - Error message displayed in red box: "Invalid credentials"
   - User can retry by entering different credentials

### 5. **Check ban status** (if credentials valid)
   - Backend checks if `user.banned == true`
   - If banned → Error: "Access denied - Your account has been banned"
   - If not banned → Continue to step 6

### 6. **Redirect by role**
   - Backend returns user info with role (ADMIN, COACH, or STUDENT)
   - Frontend displays role-specific dashboard:
     - **ADMIN Dashboard**: "Manage facilities, monitor bookings, and maintain operational control."
     - **COACH Dashboard**: "Track student activity, review usage, and support academic advising sessions."
     - **STUDENT Dashboard**: "View your booking progress and continue scheduling your advising sessions."

## Testing the Flow

### Successful Login (Admin)
1. Email: `admin@badya.edu`
2. Password: any value
3. Expected: Admin Dashboard displays

### Successful Login (Coach)
1. Email: `coach.kareem@badya.edu`
2. Password: any value
3. Expected: Coach Dashboard displays

### Successful Login (Student)
1. Email: `student1@badya.edu`
2. Password: any value
3. Expected: Student Dashboard displays

### Failed Login - Invalid Credentials
1. Email: `nonexistent@badya.edu`
2. Password: any value
3. Expected: Error message "Invalid credentials"

### Failed Login - Account Banned
1. Email: `banned@badya.edu`
2. Password: any value
3. Expected: Error message "Access denied - Your account has been banned"

## Implementation Details

### Backend (Java Spring Boot)

**Modified Files:**
- `UserAccount.java`: Added `banned` boolean field (default: false)
- `AuthController.java`: Implements full validation flow with ban status check
- `DataSeeder.java`: Seeds demo users including one banned account

**Authentication Endpoint:**
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@badya.edu",
  "password": "123456"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "token": "demo-token-1",
  "user": {
    "id": 1,
    "fullName": "System Admin",
    "email": "admin@badya.edu",
    "role": "ADMIN"
  }
}
```

**Error Response (403 - Banned):**
```json
{
  "success": false,
  "message": "Access denied - Your account has been banned"
}
```

**Error Response (400 - Invalid Credentials):**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

### Frontend (React)

**Modified Files:**
- `App.jsx`: Added error handling, separated error and success messages
- `App.css`: Added `.login-error` styling for error messages

**Flow Logic:**
1. User submits form → `onLoginSubmit()`
2. POST to `/api/auth/login`
3. If response not OK → Display error in red box
4. If response OK → Save session and redirect to dashboard
5. Dashboard shows different content based on `session.role`

## Run Instructions

```bash
# Run from project root
run all.bat

# Or manually:
# Terminal 1 - Backend
cd backend
mvn spring-boot:run

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

Backend: `http://localhost:8080`
Frontend: `http://localhost:5173`
