# Badya Sports Booking Portal - Graduation Presentation Slides
**Presenters / مقدمو العرض**: Yehia Ahmed & Omar Abdelaziz (يحيى أحمد وعمر عبد العزيز)  
**Supervisor / إشراف**: Dr. Amira (د. أميرة)  
**Project Date / تاريخ المشروع**: June 16, 2026 (١٦ يونيو ٢٠٢٦)  

---

## Slide 1: Cover Page / الصفحة الرئيسية
* **English Title**: Badya University Sports Booking Portal
* **Arabic Title**: بوابة جامعة بادية لحجز الملاعب الرياضية
* **Subtitle (EN)**: An Intelligent scheduling, algorithmic fairness-rotation, geofenced verification, and bilingual sports facility management portal.
* **Subtitle (AR)**: نظام حجز ذكي، يعتمد على خوارزميات التدوير العادل، والتحقق الجغرافي بالحدود الرقمية، وإدارة المنشآت ثنائية اللغة بالكامل.
* **Prepared By / إعداد**: 
  - Yehia Ahmed (يحيى أحمد)
  - Omar Abdelaziz (عمر عبد العزيز)
* **Supervised By / إشراف**: Dr. Amira (د. أميرة)

---

## Slide 2: Core Campus Scheduling Challenges / تحديات جدولة الملاعب الجامعية
* **Monopoly & Court Hogging (الاحتكار وحجز الملاعب المتكرر)**:
  - *EN*: Specific student groups reserving prime courts back-to-back, locking others out.
  - *AR*: قيام مجموعات معينة بحجز الفترات المميزة متتالية دون إتاحة الفرصة لباقي الطلاب.
* **No-Show Waste (هدر فترات الحجز - عدم الحضور)**:
  - *EN*: Reserved courts remain empty when booking students fail to show up.
  - *AR*: بقاء الملاعب فارغة رغم حجزها بسبب عدم حضور الطلاب وحرمان الراغبين في اللعب.
* **Check-In GPS Fraud (التسجيل الوهمي للحضور)**:
  - *EN*: Remote logins trying to register attendance from dorms instead of being on-court.
  - *AR*: محاولة الطلاب تسجيل الحضور عن بُعد من الغرف السكنية دون الذهاب الفعلي للملعب.
* **Teammate Discovery Friction (صعوبة إيجاد الفرق واللاعبين)**:
  - *EN*: Solo players unable to organize teams or match Student ID quotas required to book.
  - *AR*: عجز اللاعب الفردي عن حجز ملعب لعدم وجود زملاء كافيين لتسجيل هوياتهم في النظام.

---

## Slide 3: Technical Architecture & Stack / البنية البرمجية والتقنيات
* **Frontend SPA Client (واجهة العميل)**:
  - *EN*: React 18 + Vite, custom bilingual LTR/RTL CSS stylesheet variables, and Leaflet Maps API.
  - *AR*: واجهة تفاعلية أحادية الصفحة مبنية بـ React 18 و Vite، مع دعم ثنائية اللغة الفورية واتجاهات الخطوط (RTL/LTR)، وخرائط Leaflet.
* **Core Backend API (خادم الخدمات)**:
  - *EN*: Java 17 Spring Boot, Spring Data JPA, Hibernate ORM, and automated scheduler services.
  - *AR*: خادم خدمات مبني بـ Spring Boot (Java 17) يدير قيود الأعمال والتحقق الجغرافي وجدولة قواعد البيانات.
* **Database & AI Layer (البيانات والذكاء الاصطناعي)**:
  - *EN*: MySQL (production) & H2 (development), Gemini LLM API integration for conversational concierge scheduling.
  - *AR*: قواعد بيانات MySQL و H2، وربط ذكي مع نموذج Gemini للمساعد الآلي وجدولة الملاعب محادثياً.

---

## Slide 4: Interactive Facility Booking / حجز الملاعب وشبكة الأوقات التفاعلية
* **Availability Grid (شبكة الساعات المتاحة)**:
  - *EN*: Interactive grid displaying real-time green (available) and red (occupied) time slots. One-click fills the booking form.
  - *AR*: شبكة مواعيد تفاعلية تعرض الساعات الشاغرة باللون الأخضر والمحجوزة بالأحمر، مع إمكانية التحديد والنقر للحجز.
* **Buddy ID Validation (التحقق من الزملاء)**:
  - *EN*: Real-time student directory checks to ensure classmate student IDs exist before confirming bookings.
  - *AR*: تدقيق فوري ومباشر في قاعدة البيانات لأرقام الطلاب المضافة لضمان مطابقتها لسجلات الجامعة.
* **Alternative Recommendations (اقتراح الأوقات البديلة)**:
  - *EN*: If a booking overlap conflict is detected, the backend dynamically recommends available slots.
  - *AR*: في حال حدوث تعارض، يقوم النظام تلقائياً باقتراح الساعات الشاغرة البديلة للطالب في نفس اليوم.

---

## Slide 5: Algorithmic Fairness Engine / خوارزمية العدالة والتدوير العادل
* **Weekly Booking Limit (الحصة الأسبوعية)**:
  - *EN*: Max 3 reservations per week per student. Quota resets every Monday morning at 08:00 AM.
  - *AR*: حد أقصى ٣ حجوزات أسبوعياً لكل طالب، ويتصفر الرصيد تلقائياً كل يوم إثنين في الثامنة صباحاً.
* **Booking Cooldown Buffer (فترة التبريد)**:
  - *EN*: 24-hour buffer enforced before booking consecutive slots to prevent booking spam.
  - *AR*: فرض فترة تهدئة مدتها ٢٤ ساعة لمنع حجز ساعات متقاربة وحجب الملاعب عن باقي الطلاب.
* **Consecutive Hour Overlap Guard (حظر التداخل)**:
  - *EN*: Prevents booking groups sharing 50%+ player overlap from holding a court for > 2 hours consecutively.
  - *AR*: حظر حجز فترات متتالية لنفس المجموعة في حال وجود تشابه بين اللاعبين بنسبة ٥٠٪ أو أكثر.
* **Priority Score Resolution (نقاط الأولوية لحل النزاع)**:
  - *Equation*: $Priority = (PlayerDensity \times 2) - (WeeklyBookings \times 3)$
  - *EN*: Resolves overlapping requests by awarding slots to the group with higher player density and lower weekly usage.
  - *AR*: تمنح خوارزمية الأولوية الملعب للفريق الأكثر عدداً والأقل استخداماً للملاعب خلال الأسبوع الجاري.

---

## Slide 6: Geofenced Attendance Verification / التحقق الجغرافي لحضور الطلاب
* **50-Meter Radius Geofence (نطاق الـ ٥٠ متراً)**:
  - *EN*: Integrates Leaflet Maps to calculate student GPS distance. Unlocks check-in button only within 50m of facility center.
  - *AR*: استخدام إحداثيات GPS لحساب المسافة وتفعيل زر تسجيل الحضور فقط عند تواجد هاتف الطالب على بعد أقل من ٥٠م من الملعب.
* **No-Show Auto Cancellation (إلغاء حجز المتغيبين)**:
  - *EN*: Automated script runs 15 minutes after start time. Cancels booking if student fails to check in, releasing it to others.
  - *AR*: فحص الحضور تلقائياً بعد ١٥ دقيقة، وإلغاء حجز الطالب المتغيب فوراً لتمكين الطلاب الآخرين من استغلال الملعب.
* **Integrity Warning Bans (تجميد الحسابات المخالفة)**:
  - *EN*: Missing a booking earns 1 warning. Accumulating 3 warnings triggers an automatic 1-week account suspension.
  - *AR*: الغياب بدون عذر يسجل إنذاراً بحق الطالب، وتراكم ٣ إنذارات يعلق حساب الطالب وحرمانه من الحجز لمدة أسبوع.

---

## Slide 7: Anonymous Matchmaking Queue (LFG) / طابور البحث عن لاعبين (LFG)
* **Privacy-Masked Lobby (خصوصية تامة)**:
  - *EN*: Hides player names in matchmaking queues to eliminate social anxiety and encourage solo player participation.
  - *AR*: إخفاء هويات الطلاب المنضمين للبحث حتى اكتمال العدد تجنباً للحرج الاجتماعي وتشجيعاً للجميع.
* **Balanced Roster Splits (تقسيم الفرق العادل)**:
  - *EN*: Once 4 players join, the engine generates the booking and splits participants into balanced Team A and Team B.
  - *AR*: فور اكتمال طابور خماسيات القدم مثلاً، يقوم النظام بحجز الملعب وتوزيع اللاعبين بالتساوي لفرقتين (أ) و (ب).
* **Matchmaking Promotion (التوجيه للطابور)**:
  - *EN*: Recommends the Matchmaking lobby dynamically to solo users failing teammate ID validations.
  - *AR*: عند محاولة حجز فردي ناقص البيانات، يوجه النظام رسالة ذكية تدعو المستخدم للانضمام لطابور البحث.

---

## Slide 8: AI Concierge (Badya AI) / المساعد الذكي (بادية AI)
* **Natural Language Bookings (حجز الملاعب بالمحادثة)**:
  - *EN*: Gemini API processes text commands like "Book volleyball tomorrow at 4pm" and formats booking structures.
  - *AR*: معالجة جمل مثل "احجزلي سلة بكرة الساعة ٤" وتحويلها لتأكيد حجز بفضل الربط مع محرك Gemini.
* **Dynamic Page Redirection (التحويل التلقائي للصفحات)**:
  - *EN*: Routes students to specific dashboard areas or schedules directly based on conversation intent.
  - *AR*: توجيه المستخدم تلقائياً لفتح نموذج حجز الملعب أو صفحة سجل العقوبات بناءً على رغبته في المحادثة.
* **Offline Fallback Rules Database (قاعدة بيانات محلية احتياطية)**:
  - *EN*: Pre-cached local database of office contacts & facility rules handles queries if Gemini API is offline.
  - *AR*: قاعدة بيانات معبأة مسبقاً تتكفل بالإجابة عن لوائح الملاعب وأرقام التواصل في حال تعذر الاتصال بـ Gemini.

---

## Slide 9: Bilingual engine & Localization / محرك الترجمة وثنائية اللغة
* **RTL / LTR Dynamic Switching (عربي / إنجليزي)**:
  - *EN*: Floating toggle button translates text content, layout direction (`dir="rtl"`), and updates CSS styling instantly.
  - *AR*: زر عائم يقلب اللغة فورا، ويعكس اتجاه القراءة ونوع الخطوط ليلائم اللغتين العربية والإنجليزية.
* **Backend Error Translation Mapping (ترجمة استثناءاتSpring Boot)**:
  - *EN*: Raw database exception messages are captured by a custom filter and translated into clear Arabic user-friendly alerts.
  - *AR*: مرشح بالخلفية يلتقط أخطاء القيود البرمجية ويحولها لإرشادات مفهومة بدلاً من إظهار الكود البرمجي المعقد.
* **Unified State Localization (شمولية التوطين)**:
  - *EN*: Translation mapping covers forms, chatbot queries, geofencing statuses, and error suggestion parameters.
  - *AR*: تشمل الترجمة نماذج الإدخال، أسئلة الذكاء الاصطناعي، إحداثيات الخرائط، ورسائل اقتراح المواعيد الشاغرة.

---

## Slide 10: Live Demo walkthrough Plan / خطة تسلسل العرض الحي للمشروع
1. **Login Verification**: Showcase the initial login page and explain browser session-binding fairness rules.
2. **Language Shift Toggle**: Hit the bilingual button to switch the entire application layout to Arabic RTL.
3. **Availability Slot Grid**: Show color-coded slots, attempt to book an occupied court to trigger suggestion alerts.
4. **Matchmaking Prompt**: Submit a booking without classmate student IDs to show the matchmaking lobby suggestion.
5. **GPS Geofence Scanner**: Adjust coordinate slider to show how check-in unlocks only within 50m of facility bounds.
6. **Audit Logs & Conflicts**: Open the administrator panel to show how overlaps are logged and resolved with audit trails.
