# دليل نشر وتشغيل مشروع Badya Sport Booking System على خادم IIS

هذا الدليل يشرح بالتفصيل كيفية تهيئة ونشر التطبيق بالكامل (الواجهة الأمامية React والواجهة الخلفية Spring Boot والـ Chatbot) على خادم **IIS (Internet Information Services)** على نظام تشغيل Windows.

---

## 🛠️ المتطلبات الأساسية (Prerequisites)

قبل البدء في إعداد IIS، تأكد من تثبيت الأدوات التالية على الخادم:
1. **أدوات تطوير الويب على IIS:**
   - **URL Rewrite Module:** [تحميل وتثبيت من مايكروسوفت](https://www.iis.net/downloads/microsoft/url-rewrite) (مطلوب لإعادة توجيه المسارات للـ React Router).
   - **Application Request Routing (ARR 3.0):** [تحميل وتثبيت من مايكروسوفت](https://www.iis.net/downloads/microsoft/application-request-routing) (مطلوب لتشغيل IIS كـ Proxy وتوجيه طلبات الـ API إلى السيرفر الخلفي).
2. **برامج النظام:**
   - **Java JDK (الإصدار 17 أو أعلى)** لتشغيل سيرفر الـ Spring Boot.
   - **Node.js (الإصدار 18 أو أعلى)** لبناء مشروع الـ React وتشغيل الـ Chatbot.
   - **Microsoft SQL Server** وقاعدة بيانات جاهزة بالاسم المذكور في ملف الإعدادات.

---

## 📂 هيكل ملفات الإعداد المدمجة في المشروع

لقد قمنا بإعداد وتضمين الملفات التالية لتسهيل النشر الفوري:
1. **ملف تهيئة الواجهة الأمامية:** [web.config](file:///c:/projectes/Badya%20Sport%20Booking%20System/frontend/public/web.config)
   - مكانه: `frontend/public/web.config`.
   - يقوم بالتالي:
     - عند بناء مشروع React (`npm run build`) يتم نسخه تلقائياً إلى مجلد البناء `dist`.
     - يتضمن قواعد إعادة التوجيه للـ React Router (إعادة توجيه أي مسار غير موجود كملف إلى `index.html`).
     - يحتوي على إعدادات الـ **API Proxy** والـ **Chatbot Proxy** لتمرير الطلبات تلقائياً للسيرفر المناسب دون حدوث مشاكل **CORS**.
2. **ملف تهيئة السيرفر الخلفي (اختياري):** [web.config.template](file:///c:/projectes/Badya%20Sport%20Booking%20System/backend/web.config.template)
   - مكانه: `backend/web.config.template`.
   - يُستخدم في حال رغبتك بتشغيل الـ Java Backend داخل IIS مباشرة باستخدام وحدة **HttpPlatformHandler**.

---

## 🚀 خطوات النشر التفصيلية

### الخطوة 1: تفعيل الـ Proxy في IIS (مهم جداً للـ API)
لكي يقوم الـ IIS بتمرير طلبات `/api/` إلى سيرفر الـ Spring Boot (على بورت 8080) والـ Chatbot (على بورت 3333)، يجب تفعيل خاصية الـ Proxy:
1. افتح **IIS Manager**.
2. من القائمة اليسرى (Connections)، اضغط على اسم السيرفر الرئيسي.
3. ابحث عن أيقونة **Application Request Routing Cache** وافتحها.
4. من القائمة اليمنى (Actions)، اضغط على **Server Settings**.
5. ضع علامة صح بجانب خيار **Enable proxy**، ثم اضغط على **Apply** في الأعلى.

---

### الخطوة 2: بناء ونشر الواجهة الأمامية (React Frontend)
1. افتح موجه الأوامر (CMD) في مجلد `frontend` واكتب الأوامر التالية:
   ```cmd
   npm install
   npm run build
   ```
2. سينتج مجلد جديد باسم `dist` يحتوي على ملفات الموقع المبنية بالإضافة إلى ملف الـ `web.config`.
3. في **IIS Manager**:
   - اضغط بزر الماوس الأيمن على **Sites** ثم اختر **Add Website**.
   - **Site name:** `BadyaSport`
   - **Physical path:** حدد مسار المجلد `frontend/dist` الناتج عن البناء.
   - **Binding:** اختر البورت المناسب (مثال: بورت `80` أو أي بورت تريده).
   - اضغط **OK**.

---

### الخطوة 3: تشغيل الواجهة الخلفية (Spring Boot Backend)
هناك طريقتان لتشغيل الـ Java Backend على السيرفر:

#### الطريقة الأولى (الموصى بها): تشغيلها كخدمة خلفية (Background Service)
1. قم بإنشاء ملف الـ JAR من خلال فتح CMD في المجلد `backend` وتشغيل الأمر:
   ```cmd
   mvn clean package -DskipTests
   ```
2. سينتج ملف الـ JAR داخل مجلد `target`.
3. يمكنك تشغيله في الخلفية باستخدام أداة مثل **NSSM (Non-Sucking Service Manager)** لتسجيله كخدمة ويندوز (Windows Service) تبدأ تلقائياً مع إقلاع النظام:
   - قم بتحميل NSSM ثم قم بتسجيل الخدمة عبر الأمر: `nssm install BadyaBackend`
   - حدد مسار الـ Java ومسار ملف الـ JAR المنتج.
   - شغل الخدمة لتعمل على البورت الافتراضي `8080`.

#### الطريقة الثانية: تشغيلها مباشرة داخل IIS باستخدام HttpPlatformHandler
1. قم بتحميل وتثبيت وحدة **HttpPlatformHandler** على الـ IIS.
2. انسخ ملف الـ JAR الناتج من البناء ومعه ملف [web.config.template](file:///c:/projectes/Badya%20Sport%20Booking%20System/backend/web.config.template) بعد تسميته إلى `web.config` إلى مجلد منفصل على السيرفر.
3. قم بإنشاء موقع ويب جديد في IIS يشير إلى هذا المجلد، وسيقوم IIS بتشغيل الـ Java وإدارة البورتات تلقائياً.

---

### الخطوة 4: تشغيل الـ Chatbot
1. افتح CMD في مجلد `chatbot` ونفذ:
   ```cmd
   npm install
   ```
2. قم بإنشاء ملف `.env` داخل مجلد الـ `chatbot` وضع فيه المتغيرات اللازمة مثل:
   ```env
   CHATBOT_PORT=3333
   LLM_API_KEY=مفتاح_الجيميني_الخاص_بك
   BACKEND_URL=http://localhost:8080
   ```
3. قم بتشغيل السيرفر باستخدام NSSM كخدمة ويندوز أو تشغيله باستخدام PM2 للويندوز عبر الأمر:
   ```cmd
   node server.js
   ```

---

## 🔒 التحقق والتأكد من نجاح النشر

بعد إتمام الخطوات السابقة:
1. عند زيارة موقع الـ IIS الخاص بك (مثلاً `http://localhost`), سيتم تحميل واجهة الـ React بشكل كامل.
2. عند التنقل داخل الموقع (مثال الذهاب إلى `/dashboard` وعمل تحديث للصفحة F5)، سيقوم ملف `web.config` بتوجيه الطلب داخلياً ليعمل الـ Routing بشكل طبيعي ودون ظهور خطأ 404.
3. جميع طلبات الـ API المتجهة إلى `/api/...` سيتم إعادة توجيهها داخلياً بواسطة الـ IIS إلى `http://localhost:8080/api/...` بدون ظهور أي مشاكل في الـ CORS.
