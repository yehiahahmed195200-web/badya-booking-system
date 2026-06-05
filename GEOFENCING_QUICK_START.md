## 🚀 دليل البدء السريع - نظام التحقق من الحضور بـ Geofencing

### ✅ ما تم تنفيذه

تم بناء نظام متكامل للتحقق من حضور الطالب في الحجز من خلال تحديد الموقع الجغرافي.

---

## 📋 خطوات البدء

### 1️⃣ قاعدة البيانات - Node Backend

```bash
cd backend  # أو حيث Prisma schema موجود

# تطبيق التغييرات على قاعدة البيانات
npx prisma migrate dev --name add-attendance-geofencing

# أو إذا كنت تستخدم push بدلاً من migrate:
npx prisma db push
```

### 2️⃣ بناء Spring Boot Backend

```bash
cd backend  # مجلد Spring Boot

# تنظيف وبناء
mvn clean compile

# أو تشغيل مباشرة
mvn spring-boot:run
```

الـ classes الجديدة:
- ✅ `AttendanceStatus.java` - enum لحالات الحضور
- ✅ `GeofencingService.java` - خدمة حساب المسافات
- ✅ `AttendanceController.java` - API endpoints

### 3️⃣ تشغيل Node Backend (اختياري)

```bash
npm install
npm run dev
# سيعمل على http://localhost:4000
```

Routes المضافة:
- `POST /api/attendance/check-in`
- `POST /api/attendance/check-out`
- `GET /api/attendance/booking/:bookingId`

### 4️⃣ تشغيل Frontend

```bash
cd frontend

npm install
npm run dev
# سيعمل على http://localhost:5173
```

**الميزات الجديدة:**
- 📍 Tab جديد "Attendance" في Student Dashboard
- 🗺️ خريطة بسيطة توضح موقع المنشأة والطالب
- ✓ زر "تسجيل الحضور" و "تسجيل الانصراف"

---

## 🧪 اختبار سريع

### 1. تسجيل الدخول
- البريد: `student1@badya.edu`
- كلمة المرور: أي قيمة (demo)

### 2. الذهاب إلى Student Dashboard
- اضغط على tab "📍 Attendance"
- يجب أن ترى الحجوزات القادمة

### 3. اختبار Check-in
```
✅ شروط النجاح:
- يكون الحجز بحالة CONFIRMED أو APPROVED
- تكون ضمن 15 دقيقة من موعد البداية
- تكون موقعك ضمن 100 متر من المنشأة (تقريباً)

❌ حالات الفشل:
- "لم يحن موعد تسجيل الحضور بعد" - قبل 15 دقيقة
- "أنت بعيد جداً عن المنشأة" - خارج النطاق
- "لقد فاتك موعد الحجز" - أكثر من ساعة بعد البداية
```

---

## 📱 الاختبار من الهاتف

1. **استخدام HTTPS** (إذا كان بعيد عن localhost)
   ```bash
   # تأكد من أن الخادم يعمل على HTTPS
   ```

2. **من localhost على نفس الشبكة:**
   ```bash
   npm run dev -- --host
   # ثم افتح: http://<your-ip>:5173 من الهاتف
   ```

3. **السماح بالموقع الجغرافي:**
   - عند الضغط على "تسجيل الحضور"
   - سيطلب التطبيق إذن الموقع
   - اختر "السماح"

---

## 🎯 أمثلة الاستخدام

### Check-in الناجح
```bash
curl -X POST http://localhost:8080/api/attendance/check-in \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": 1,
    "studentLatitude": 30.0544,
    "studentLongitude": 31.3572
  }'

Response:
{
  "success": true,
  "message": "تم تسجيل حضورك بنجاح!",
  "attendanceStatus": "CHECKED_IN",
  "distance": 0.025,
  "distanceMeters": 25,
  "checkedInAt": "2026-05-05T14:30:00"
}
```

### Check-out
```bash
curl -X POST http://localhost:8080/api/attendance/check-out \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": 1
  }'

Response:
{
  "success": true,
  "message": "تم تسجيل انصرافك بنجاح!",
  "attendanceStatus": "CHECKED_OUT",
  "checkedOutAt": "2026-05-05T15:45:00",
  "duration": "75 دقيقة",
  "earnedPoints": 25
}
```

---

## 📊 البيانات المخزنة

كل حجز يحتفظ الآن بـ:
- ✅ `attendanceStatus` - حالة الحضور
- ✅ `checkedInAt` - وقت تسجيل الحضور
- ✅ `checkedOutAt` - وقت الانصراف
- ✅ `studentLatitude/Longitude` - موقع الطالب
- ✅ `distanceFromFacility` - المسافة من المنشأة
- ✅ `verifiedBy` - من أثبت الحضور

كل منشأة تملك الآن:
- ✅ `latitude/longitude` - إحداثيات GPS
- ✅ `geofencingRadius` - نطاق الحضور المسموح (افتراضي: 100m)

---

## 🔧 التخصيص

### تغيير نطاق Geofencing
```java
// في DataSeeder.java
facility.setGeofencingRadius(0.2); // 200 متر بدلاً من 100
```

### تغيير مدة الـ Grace Period
```java
// في AttendanceController.java، سطر حوالي 90
LocalDateTime checkInDeadline = booking.getStartTime().minusMinutes(30); // 30 دقيقة بدلاً من 15
```

### تغيير النقاط المكتسبة
```java
// في AttendanceController.java، دالة calculatePointsForAttendance
return 50; // 50 نقطة بدلاً من 25
```

---

## ⚠️ ملاحظات مهمة

1. **GPS Accuracy**: تتراوح دقة GPS بين ±5-10 متر عادة
2. **HTTPS Required**: بعض المتصفحات تتطلب HTTPS للـ Geolocation
3. **Battery Usage**: تفعيل GPS يستهلك بطارية الهاتف
4. **Offline Mode**: النظام لا يعمل بدون اتصال إنترنت

---

## 📚 الملفات الرئيسية المضافة

### Java Backend
```
backend/src/main/java/com/badya/booking/
├── model/
│   ├── AttendanceStatus.java ✨ جديد
│   ├── Booking.java (محدثة)
│   └── Facility.java (محدثة)
├── service/
│   └── GeofencingService.java ✨ جديد
└── controller/
    └── AttendanceController.java ✨ جديد
```

### Node Backend
```
src/
├── services/
│   └── attendanceService.ts ✨ جديد
└── routes/
    └── attendance.ts ✨ جديد
```

### Frontend
```
frontend/src/
├── components/
│   └── AttendanceCard.jsx ✨ جديد
└── pages/
    └── StudentDashboard.jsx (محدثة)
```

### Schema
```
prisma/
└── schema.prisma (محدثة)

backend/src/main/java/com/badya/booking/config/
└── DataSeeder.java (محدثة)
```

---

## 🆘 استكشاف الأخطاء

### "Cannot find geolocation"
- تأكد من استخدام HTTPS أو localhost
- تحقق من إذن الموقع في إعدادات المتصفح

### "Out of geofence"
- تأكد من صحة إحداثيات المنشأة في قاعدة البيانات
- تحقق من أن `geofencingRadius` معقول (10-500 متر عادة)

### "Booking not found"
- تأكد من أن الحجز موجود في قاعدة البيانات
- استخدم booking ID صحيح من الخادم

### API Timeout
- تحقق من أن الخادم يعمل على الميناء الصحيح
- تأكد من أن `API_BASE_URL` في الـ frontend صحيح

---

## 📞 دعم إضافي

للمزيد من التفاصيل، راجع:
- [`GEOFENCING_ATTENDANCE.md`](./GEOFENCING_ATTENDANCE.md) - توثيق شامل
- [`AUTHENTICATION_FLOW.md`](./AUTHENTICATION_FLOW.md) - تسجيل الدخول
- README.md في كل مجلد (backend, frontend, etc.)

---

## ✨ الخطوات التالية (Optional)

- [ ] إضافة QR Code check-in
- [ ] دعم صور توثيق الحضور
- [ ] تنبيهات للمدربين (Coaches) عند عدم الحضور
- [ ] تقارير يومية/شهرية للمسؤولين
- [ ] تكامل مع نظام الحضور الإلكتروني الرسمي

---

**تم الانتهاء! 🎉**

النظام الآن جاهز للاختبار والاستخدام. استمتع بالتحقق من الحضور الذكي! 📍
