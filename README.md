# Badya Sport Booking System

Implementation now uses **React (frontend)** and **Java Spring Boot (backend)**.

## Architecture

- `frontend`: React + Vite UI (port `5173`)
- `backend`: Spring Boot REST API + H2 database (port `8080`)

## What Is Implemented

- Login endpoint (`/api/auth/login`) returning user role info for UI
- Facilities APIs:
  - list facilities
  - create facility
  - activate/deactivate facility
- Booking APIs:
  - create booking with conflict check
  - list bookings
  - cancel booking
- Monthly report API (`/api/reports/monthly`)
- Seeded demo users and facilities at startup

## Run Backend (Spring Boot)

```bash
cd backend
mvn spring-boot:run
```

Backend URL: `http://localhost:8080`

## Run Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

## Demo Login Emails

Use any password in this demo implementation:

- `admin@badya.edu` (ADMIN)
- `coach.kareem@badya.edu` (COACH)
- `student1@badya.edu` (STUDENT)

## Important Note

The previous Node.js/Express implementation is still present in the repository root, but the active stack requested is now under `frontend` and `backend`.
