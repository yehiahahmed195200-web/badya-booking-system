# Badya Sports Booking Portal - Presentation Slides
**Presenters**: Yehia Ahmed & Omar Abdelaziz  
**Supervisor**: Dr. Amira  
**Date**: June 16, 2026  

---

## Slide 1: Cover Page
* **Title**: Badya University Sports Booking Portal
* **Subtitle**: An Intelligent scheduling, algorithmic fairness-rotation, geofenced verification, and bilingual sports facility management portal.
* **Credits**:
  - Prepared by: Yehia Ahmed
  - Prepared by: Omar Abdelaziz
  - Supervised by: Dr. Amira

---

## Slide 2: The Core Pain Points
* **Main Concept**: Traditional campus sports portals suffer from scheduling abuse and underutilization.
* **Monopoly & Court Hogging**: Certain groups reserve courts back-to-back, locking others out of prime slots.
* **No-Show Waste**: Courts remain reserved but empty when students fail to show up, preventing others from playing.
* **Check-In Fraud**: Students checking in remotely (from dorms or classrooms) instead of being at the facility.
* **Team Discovery Friction**: Solo players struggle to find teams or organize student IDs to meet booking thresholds.

---

## Slide 3: Student Dashboard UI (Screenshot: dashboard_mockup.png)
* **Goal**: Provide a clean, premium landing page for student athletes.
* **Credits & Statistics**:
  - Remaining Credits: Resets weekly (Mondays at 08:00 AM) to limit overuse.
  - Earned Points: Rewards student engagement and peak check-ins.
  - Integrity Warnings: Tracks warning status (3 warnings lead to a temporary ban).
* **Booking Timeline**: Shows confirmed bookings, completed sessions, and pending conflicts in one central tab.

---

## Slide 4: Global Bilingual Engine (Arabic/English Switcher)
* **Language Switcher Toggle**: A floating button flips the entire portal layout instantly.
* **Dynamic LTR / RTL Mode**: Toggles the HTML document direction (`dir="rtl"` / `dir="ltr"`) and adapts alignments.
* **Backend Error Translation**: Raw Spring Boot database errors are translated dynamically into clear Arabic warnings:
  - *Standard*: `"Booking rejected: This court is already booked."`
  - *Arabic*: `"تم رفض الحجز: هذا الملعب محجوز بالفعل."`

---

## Slide 5: Facility Booking & Slot Availability Grid (Screenshot: booking_mockup.png)
* **Goal**: Make scheduling easy and transparent.
* **Availability Grid**:
  - Green slots: Available times.
  - Red slots: Occupied/booked times.
  - Pick and Book: Direct click on slot auto-fills the time field in the booking form.
* **Buddy Booking ID Verification**: Automatically validates teammate Student IDs in real-time before booking is finalized.

---

## Slide 6: Algorithmic Fairness Engine
* **Quota Limits**: Users are limited to a maximum of 3 bookings per week.
* **Cooldown Buffer**: A 24-hour cooldown period is enforced before booking another slot.
* **Consecutive Hour block**: Prevents groups sharing 50%+ player overlap from holding the court for more than 2 hours consecutively.
* **Priority Scores**: Overlaps are resolved automatically based on calculated scores (player density and weekly quota debt).

---

## Slide 7: Geofenced Verification (Screenshot: chatbot_map_mockup.png)
* **Real-time Map tracking**: Employs Leaflet maps to track distance from coordinates to facility center.
* **50-Meter Bounds**: Check-in button is locked unless the device is physically within 50m of the court center.
* **No-Show ban policy**: Attendance checked 15 minutes after start. Missing a booking cancels the reservation. 3 warnings result in an automatic 1-week account suspension.

---

## Slide 8: Anonymous Matchmaking Queue (LFG)
* **Privacy & Matching**: Student details are masked in queues to eliminate social anxiety.
* **Automated Booking & Team allocation**: Once the lobby fills up, the engine creates the booking and splits players into balanced Team A and Team B rosters.
* **Matchmaking Promotion**: Attempts to book with participants > 1 without entering classmate IDs display a recommendation prompting users to join the Matchmaking queue.

---

## Slide 9: AI Concierge (Badya AI)
* **Gemini LLM Integration**: Natural language interface for booking facilities, asking about rules, or checking warnings.
* **Automated Redirect Actions**: Conversational commands direct users straight to dashboard pages or booking forms.
* **Offline Fallback Database**: pre-embedded rules and office contacts local database acts as a backup if the Gemini API key or internet is unavailable.

---

## Slide 10: Technical Stack Summary
* **Frontend**: React, Vite, Custom LTR/RTL CSS, Leaflet Maps API.
* **Backend**: Spring Boot (Java 17, JPA, Hibernate).
* **Database**: MySQL (Production) / H2 (Development database).
* **AI Engine**: Gemini API.

---

## Slide 11: Demo Sequence Checklist
1. Log in to show the device-binding notice.
2. Toggle the bilingual button to switch the layout to RTL Arabic.
3. Attempt to book a conflict slot to see localized available slot recommendations.
4. Try booking without teammate IDs to trigger the Matchmaking prompt.
5. Demonstrate Leaflet geofencing coordinates unlocking the check-in scanner.
