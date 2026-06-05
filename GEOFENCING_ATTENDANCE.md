# نظام التحقق من الحضور باستخدام Geofencing

## 📍 نظرة عامة

يوفر النظام حلاً متكاملاً للتحقق من حضور الطالب في الحجز من خلال:
- ✅ تحديد الموقع الجغرافي للطالب (GPS)
- ✅ التحقق من أن الطالب ضمن نطاق المنشأة المسموح
- ✅ تسجيل وقت الحضور والانصراف
- ✅ حساب النقاط فقط عند الحضور الفعلي
- ✅ منع حالات "No-Show" التلقائية

---

## 🏗️ المعمارية

### Backend - Spring Boot (Java)

#### Models
1. **Facility** - إضافة حقول جغرافية:
   ```java
   private Double latitude;      // خط عرض المنشأة
   private Double longitude;     // خط طول المنشأة
   private Double geofencingRadius; // نطاق الـ geofencing (بالكيلومترات)
   ```

2. **Booking** - إضافة حقول التتبع:
   ```java
   private AttendanceStatus attendanceStatus;  // حالة الحضور
   private LocalDateTime checkedInAt;          // وقت التسجيل
   private LocalDateTime checkedOutAt;         // وقت الانصراف
   private Double studentLatitude;             // موقع الطالب عند التسجيل
   private Double studentLongitude;
   private Double distanceFromFacility;        // المسافة من المنشأة
   private String verifiedBy;                  // من تحقق (STUDENT/COACH/SYSTEM)
   ```

3. **AttendanceStatus** Enum:
   ```java
   NOT_CHECKED_IN       // لم يتم تسجيل الحضور
   CHECKED_IN          // تم تسجيل الحضور
   CHECKED_OUT         // تم الانصراف
   NO_SHOW             // لم يحضر (تم ضبطها تلقائياً)
   CANCELLED_BEFORE_START
   ```

#### Services
- **GeofencingService**: حساب المسافات باستخدام Haversine Formula
  ```java
  calculateDistance(lat1, lon1, lat2, lon2) → distance in km
  isWithinGeofence(...) → boolean
  ```

#### Controllers
- **AttendanceController**: API Endpoints
  - `POST /api/attendance/check-in`
  - `POST /api/attendance/check-out`
  - `GET /api/attendance/booking/{bookingId}`

---

### Backend - Node.js/TypeScript (Prisma)

#### Schema Updates
```prisma
enum AttendanceStatus {
  NOT_CHECKED_IN
  CHECKED_IN
  CHECKED_OUT
  NO_SHOW
  CANCELLED_BEFORE_START
}

model Facility {
  // ... existing fields
  latitude          Float?
  longitude         Float?
  geofencingRadius  Float?
}

model Booking {
  // ... existing fields
  attendanceStatus AttendanceStatus
  checkedInAt      DateTime?
  checkedOutAt     DateTime?
  studentLatitude  Float?
  studentLongitude Float?
  distanceFromFacility Float?
  verifiedBy       String?
}
```

#### Services
- **attendanceService.ts**:
  ```typescript
  checkInStudent(bookingId, latitude, longitude)
  checkOutStudent(bookingId)
  getAttendanceInfo(bookingId)
  calculateDistance(lat1, lon1, lat2, lon2)
  isWithinGeofence(...)
  ```

#### Routes
- `POST /api/attendance/check-in`
- `POST /api/attendance/check-out`
- `GET /api/attendance/booking/:bookingId`

---

### Frontend - React

#### Components
1. **AttendanceCard.jsx**:
   - عرض خريطة بسيطة للمنشأة وموقع الطالب
   - أزرار Check-in/Check-out
   - عرض المسافة والتنبيهات
   - استخدام Geolocation API للحصول على الموقع الحالي

```jsx
<AttendanceCard 
  booking={booking}
  onCheckIn={(success, message) => {...}}
  onCheckOut={(success, message) => {...}}
  API={API_URL}
/>
```

#### Integration in StudentDashboard
- إضافة tab "📍 Attendance" مع قائمة الحجوزات القادمة
- عرض AttendanceCard لكل حجز قادم
- تحديث الحجز بعد التسجيل

---

## 🔄 سير العمل (Workflow)

### 1. Check-in Process
```
الطالب يفتح التطبيق
  ↓
يظهر قسم "Attendance" مع الحجوزات القادمة
  ↓
يضغط "تسجيل الحضور" 
  ↓
التطبيق يطلب إذن الموقع الجغرافي
  ↓
يتم حساب المسافة من المنشأة (Haversine Formula)
  ↓
✓ إذا كان ضمن النطاق (100م افتراضياً):
  - تحديث حالة الحضور إلى CHECKED_IN
  - حفظ موقع الطالب ووقت التسجيل
  - عرض رسالة نجاح
  
✗ إذا كان خارج النطاق:
  - عرض رسالة خطأ مع المسافة الفعلية
  - طلب التحرك إلى موقع المنشأة
```

### 2. Check-out Process
```
الطالب ينتهي من النشاط
  ↓
يضغط "تسجيل الانصراف"
  ↓
التطبيق يحدث حالة الحضور إلى CHECKED_OUT
  ↓
يحسب مدة الحضور
  ↓
يمنح النقاط (25 نقطة للحضور الكامل)
  ↓
عرض رسالة نجاح مع النقاط المكتسبة
```

### 3. No-Show Handling
```
إذا مرت 15 دقيقة من موعد البداية بدون check-in:
  ↓
يتم تعيين حالة الحضور تلقائياً إلى NO_SHOW
  ↓
تطبيق تحذير على حساب الطالب
  ↓
إذا تجاوز 3 تحذيرات → حظر الحساب
```

---

## 🎯 المتطلبات الحد الأدنى

### متطلبات العميل (Browser)
- ✅ دعم Geolocation API
- ✅ دعم HTTPS (بعض المتصفحات تتطلب HTTPS للـ Geolocation)
- ✅ إذن الموقع من المستخدم

### متطلبات الخادم
- ✅ قاعدة بيانات محدثة مع الحقول الجديدة
- ✅ Prisma migration (Node backend)
- ✅ إعادة بناء Spring Boot (Java backend)

---

## 📊 البيانات المخزنة

```
جدول Bookings:
├── attendanceStatus    → [NOT_CHECKED_IN, CHECKED_IN, CHECKED_OUT, NO_SHOW]
├── checkedInAt         → 2026-05-05T14:30:00Z
├── checkedOutAt        → 2026-05-05T15:45:00Z
├── studentLatitude     → 30.0544
├── studentLongitude    → 31.3572
├── distanceFromFacility → 0.025 (كم)
└── verifiedBy          → "STUDENT"

جدول Facilities:
├── latitude            → 30.0544
├── longitude           → 31.3572
└── geofencingRadius    → 0.1 (كم = 100م)
```

---

## 🔐 الأمان والتحقق

### Server-side Validations
1. ✅ التحقق من صحة توكن المستخدم
2. ✅ التحقق من أن الحجز موجود ومملوك للمستخدم
3. ✅ التحقق من توقيت التسجيل (قبل 15 دقيقة من البداية)
4. ✅ التحقق من الموقع الجغرافي
5. ✅ منع التلاعب بـ timestamps

### Client-side Validations
1. ✅ التحقق من إذن الموقع
2. ✅ عرض المسافة قبل التأكيد
3. ✅ تنبيهات واضحة عند خارج النطاق

---

## 🧪 الاختبار

### Test Cases

#### Test 1: Check-in الناجح
```bash
POST /api/attendance/check-in
{
  "bookingId": "booking123",
  "studentLatitude": 30.0544,
  "studentLongitude": 31.3572
}
✓ Response: 200 OK
{
  "success": true,
  "message": "تم تسجيل حضورك بنجاح!",
  "attendanceStatus": "CHECKED_IN",
  "distance": 0.025,
  "distanceMeters": 25
}
```

#### Test 2: خارج النطاق
```bash
POST /api/attendance/check-in
{
  "bookingId": "booking123",
  "studentLatitude": 30.1000,
  "studentLongitude": 31.4000
}
✗ Response: 400 Bad Request
{
  "success": false,
  "message": "أنت بعيد جداً عن المنشأة! المسافة: 7500 متر. يجب أن تكون ضمن 100 متر"
}
```

#### Test 3: قبل موعد التسجيل
```bash
← قبل 20 دقيقة من البداية
POST /api/attendance/check-in
✗ Response: 400 Bad Request
{
  "success": false,
  "message": "لم يحن موعد تسجيل الحضور بعد. يمكنك التسجيل من 15 دقيقة قبل الموعد"
}
```

---

## 🚀 التشغيل

### Java Backend
```bash
cd backend
mvn clean compile
# الـ models والـ services جاهزة للاستخدام
```

### Node Backend
```bash
# تحديث قاعدة البيانات
npx prisma migrate dev --name add-attendance-geofencing

# أو استخدام:
npm run db:push
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# سيظهر tab "📍 Attendance" في Student Dashboard
```

---

## 📱 استخدام من الهاتف

للحصول على دقة GPS أفضل:
1. ✅ تأكد من تفعيل GPS على الهاتف
2. ✅ استخدم HTTPS (الـ Geolocation يتطلبها)
3. ✅ كن في الخارج أو بالقرب من نافذة
4. ✅ امنح التطبيق إذن الموقع عند الطلب

---

## 📊 الإحصائيات والتقارير

### للمسؤولين (Admin Dashboard)
- عدد الحاضرين vs الغائبين
- معدل No-Show
- أوقات Check-in/Check-out
- متوسط مدة الحضور

### للطلاب
- حالة حضورهم لكل حجز
- النقاط المكتسبة من الحضور
- عدد التحذيرات

---

## 🔧 الصيانة والتطوير

### Future Enhancements
- [ ] دعم QR Code check-in
- [ ] صور توثيق الحضور
- [ ] تنبيهات للمدربين عند عدم حضور الطلاب
- [ ] تقارير شهرية للمسؤولين
- [ ] تكامل مع نظام الحضور الإلكتروني

---

## ❓ الأسئلة الشائعة

**س: ماذا لو كان الإنترنت بطيء؟**
ج: يتم حفظ الموقع محلياً ثم إرساله عند استقرار الاتصال

**س: هل يعمل بدون GPS؟**
ج: لا، يتطلب GPS/Geolocation. يمكن استخدام Wi-Fi كبديل أقل دقة

**س: ما هي دقة القياس؟**
ج: ±5-10 متر في الظروف العادية

**س: هل يحفظ موقع الطالب؟**
ج: نعم، لأغراض التدقيق والتحقق فقط

---

## 📚 المراجع

- [Haversine Formula](https://en.wikipedia.org/wiki/Haversine_formula)
- [Geolocation API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- [Spring Boot - Persistence](https://spring.io/guides/gs/accessing-data-jpa/)
- [Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
