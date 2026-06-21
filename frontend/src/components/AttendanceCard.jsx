import React, { useState, useEffect, useRef } from "react";
import "../AdminDashboard.css"; // استخدام نفس الـ styling
import { useLanguage } from "../context/LanguageContext";

export default function AttendanceCard({
  booking,
  onCheckIn,
  onCheckOut,
  API,
}) {
  const { language, t } = useLanguage();
  const locale = language === "ar" ? "ar-EG" : "en-GB";
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [insideField, setInsideField] = useState(null);
  const heartbeatIntervalRef = useRef(null);
  const mapContainer = useRef(null);

  // Telemetry Simulator & Verification Details State
  const [simulatedAccuracy, setSimulatedAccuracy] = useState(5.0); // meters
  const [simulatedMock, setSimulatedMock] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState(booking.verificationMethod || "");
  const [verificationMethodDesc, setVerificationMethodDesc] = useState(booking.verificationMethodDesc || "");
  const [riskScore, setRiskScore] = useState(booking.riskScore || null);

  const isCheckedIn =
    booking.attendanceStatus === "CHECKED_IN" ||
    booking.attendanceStatus === "CHECKED_OUT";
  const isCheckedOut = booking.attendanceStatus === "CHECKED_OUT";

  // الحصول على الموقع الجغرافي الحالي
  const getCurrentLocation = async () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setError(t("attendance.browserNoSupport"));
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          // Use simulated accuracy if user interacted, else actual GPS accuracy
          const finalAccuracy = simulatedAccuracy !== 5.0 ? simulatedAccuracy : (accuracy || 5.0);
          setLocation({ latitude, longitude, accuracy: finalAccuracy });
          resolve({ latitude, longitude, accuracy: finalAccuracy });
        },
        (error) => {
          const errorMessages = {
            "1": t("attendance.locationPermissionDenied"),
            "2": t("attendance.locationUnavailable"),
            "3": t("attendance.locationTimeout"),
          };
          setError(
            errorMessages[error.code] ||
              t("attendance.locationErrorDefault")
          );
          resolve(null);
        }
      );
    });
  };

  // حساب المسافة بين نقطتين (Haversine Formula)
  const calculateDistance = (
    lat1,
    lon1,
    lat2,
    lon2
  ) => {
    const R = 6371; // نصف قطر الأرض بالكيلومترات
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // رسم الخريطة البسيطة
  const drawMap = (
    facilityLat,
    facilityLon,
    studentLat,
    studentLon
  ) => {
    if (!mapContainer.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    canvas.style.border = "1px solid #e2e8f0";
    canvas.style.borderRadius = "8px";
    canvas.style.marginBottom = "15px";

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // رسم خلفية
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // رسم شبكة إحداثيات
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= canvas.width; i += 30) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i <= canvas.height; i += 30) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // حساب المسافات
    const radiusKm = booking.facility?.geofencingRadius ?? 0.004;
    const radiusMeters = radiusKm * 1000;
    const accuracyBufferMeters = Math.min(simulatedAccuracy * 0.5, 15);
    const effectiveRadiusMeters = radiusMeters + accuracyBufferMeters;

    // حساب المسافة الفعلية للطالب
    const distMeters = studentLat !== undefined && studentLon !== undefined
      ? calculateDistance(facilityLat, facilityLon, studentLat, studentLon) * 1000
      : 0;

    // تحديد مقياس الرسم ديناميكياً ليناسب الشاشة (pixels per meter)
    const maxDimensionMeters = Math.max(effectiveRadiusMeters, simulatedAccuracy, distMeters, 25);
    const scale = 110 / maxDimensionMeters; // ترك هامش 40 بكسل

    const radiusPixels = radiusMeters * scale;
    const effectiveRadiusPixels = effectiveRadiusMeters * scale;

    // 1. رسم نطاق الـ geofencing الأصلي (أخضر خفيف)
    ctx.fillStyle = "rgba(74, 222, 128, 0.1)";
    ctx.beginPath();
    ctx.arc(centerX, centerY, radiusPixels, 0, 2 * Math.PI);
    ctx.fill();

    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radiusPixels, 0, 2 * Math.PI);
    ctx.stroke();

    // 2. رسم القطر الفعال المرن (Fuzzy Geofence) بخط برتقالي منقط لو كان هناك تمدد
    if (effectiveRadiusPixels > radiusPixels) {
      ctx.strokeStyle = "#fb923c";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, effectiveRadiusPixels, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 3. رسم موقع المنشأة (المركز) باللون الأحمر
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 10px Cairo, Arial";
    ctx.textAlign = "center";
    ctx.fillText(t("attendance.mapLabelFacility"), centerX, centerY - 14);

    // 4. رسم موقع الطالب ودائرة الدقة المترية (translucent blue)
    if (studentLat !== undefined && studentLon !== undefined) {
      const diffLatMeters = (studentLat - facilityLat) * 111320;
      const diffLonMeters = (studentLon - facilityLon) * 111320 * Math.cos(facilityLat * Math.PI / 180);

      const studentX = centerX + diffLonMeters * scale;
      const studentY = centerY - diffLatMeters * scale;

      // دائرة دقة الـ GPS
      const accuracyPixels = simulatedAccuracy * scale;
      ctx.fillStyle = "rgba(56, 189, 248, 0.18)";
      ctx.beginPath();
      ctx.arc(studentX, studentY, accuracyPixels, 0, 2 * Math.PI);
      ctx.fill();

      ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(studentX, studentY, accuracyPixels, 0, 2 * Math.PI);
      ctx.stroke();

      // نقطة موقع الطالب
      ctx.fillStyle = "#0284c7";
      ctx.beginPath();
      ctx.arc(studentX, studentY, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 10px Cairo, Arial";
      ctx.textAlign = "center";
      ctx.fillText(t("attendance.mapLabelYou"), studentX, studentY - 12);

      // خط التوصيل بين موقع الطالب والملعب
      ctx.strokeStyle = "#f97316";
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(studentX, studentY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // إضافة الخريطة إلى الـ container
    mapContainer.current.innerHTML = "";
    mapContainer.current.appendChild(canvas);
  };

  // معالج إرسال النبضات الدورية
  const sendHeartbeat = async (loc) => {
    const response = await fetch(`${API}/api/attendance/heartbeat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        bookingId: booking.id,
        studentLatitude: loc.latitude,
        studentLongitude: loc.longitude,
        gpsAccuracy: simulatedAccuracy,
        isMocked: simulatedMock,
        deviceId: localStorage.getItem("device_uuid") || "",
      }),
    });

    const data = await response.json();
    if (!response.ok || data.success === false) {
      throw new Error(data.message || t("attendance.locationFail"));
    }
    if (typeof data.insideField === "boolean") {
      setInsideField(data.insideField);
    }
    if (data.verificationMethod) setVerificationMethod(data.verificationMethod);
    if (data.riskScore !== undefined) setRiskScore(data.riskScore);
    return data;
  };

  // معالج تسجيل الحضور
  const handleCheckIn = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const loc = await getCurrentLocation();
      if (!loc) {
        setError(t("attendance.locationFail"));
        setLoading(false);
        return;
      }

      const response = await fetch(`${API}/api/attendance/check-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          bookingId: booking.id,
          studentLatitude: loc.latitude,
          studentLongitude: loc.longitude,
          gpsAccuracy: simulatedAccuracy,
          isMocked: simulatedMock,
          deviceId: localStorage.getItem("device_uuid") || "",
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(t("attendance.checkinSuccess"));
        if (data.verificationMethod) setVerificationMethod(data.verificationMethod);
        if (data.verificationMethodDesc) setVerificationMethodDesc(data.verificationMethodDesc);
        if (data.riskScore !== undefined) setRiskScore(data.riskScore);
        
        onCheckIn(true, data.message);
        drawMap(
          booking.facility?.latitude || 30.0544,
          booking.facility?.longitude || 31.3572,
          loc.latitude,
          loc.longitude
        );
      } else {
        setError(data.message);
        onCheckIn(false, data.message);
      }
    } catch (err) {
      setError(t("attendance.connError") + err.message);
      onCheckIn(false, err.message);
    } finally {
      setLoading(false);
    }
  };

  // معالج تسجيل الانصراف
  const handleCheckOut = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API}/api/attendance/check-out`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          bookingId: booking.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(t("attendance.checkoutSuccess"));
        onCheckOut(true, data.message);
      } else {
        setError(data.message);
        onCheckOut(false, data.message);
      }
    } catch (err) {
      setError(t("attendance.connError") + err.message);
      onCheckOut(false, err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // جلب تفاصيل الحضور المسجلة مسبقاً (مثل طريقة التحقق ومستوى المخاطر)
    const fetchAttendanceDetails = async () => {
      if (booking.attendanceStatus === "CHECKED_IN" || booking.attendanceStatus === "CHECKED_OUT") {
        try {
          const response = await fetch(`${API}/api/attendance/booking/${booking.id}`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });
          const data = await response.json();
          if (data) {
            if (data.verificationMethod) setVerificationMethod(data.verificationMethod);
            if (data.verificationMethodDesc) setVerificationMethodDesc(data.verificationMethodDesc);
            if (data.riskScore !== undefined) setRiskScore(data.riskScore);
          }
        } catch (err) {
          console.error("Error fetching attendance details:", err);
        }
      }
    };
    
    fetchAttendanceDetails();

    // رسم الخريطة عند تحميل الـ component
    if (booking.facility?.latitude && booking.facility?.longitude) {
      drawMap(
        booking.facility.latitude,
        booking.facility.longitude,
        booking.studentLatitude,
        booking.studentLongitude
      );
    }
  }, []);

  const startTime = new Date(booking.startTime);
  const now = new Date();
  const checkInOpensAt = new Date(startTime.getTime() - 15 * 60 * 1000);
  const checkInClosesAt = new Date(startTime.getTime() + 60 * 60 * 1000);
  const canCheckInNow = now >= checkInOpensAt && now <= checkInClosesAt;

  const refreshLocationPreview = async () => {
    setError("");
    const loc = await getCurrentLocation();
    if (!loc) return;
    drawMap(
      booking.facility?.latitude || 30.0544,
      booking.facility?.longitude || 31.3572,
      loc.latitude,
      loc.longitude
    );

    if (booking.attendanceStatus === "CHECKED_IN") {
      try {
        await sendHeartbeat(loc);
      } catch {
        // Keep map update working even if heartbeat fails once.
      }
    }
  };

  useEffect(() => {
    const canTrackLive = booking.attendanceStatus === "CHECKED_IN";
    if (!canTrackLive) {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      return;
    }

    const heartbeatTick = async () => {
      const loc = await getCurrentLocation();
      if (!loc) return;
      drawMap(
        booking.facility?.latitude || 30.0544,
        booking.facility?.longitude || 31.3572,
        loc.latitude,
        loc.longitude
      );
      try {
        await sendHeartbeat(loc);
      } catch {
        // Ignore intermittent failures; next tick will retry.
      }
    };

    heartbeatTick();
    heartbeatIntervalRef.current = setInterval(heartbeatTick, 20000);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [booking.attendanceStatus, booking.id, API]);

  return (
    <div style={{
      padding: "15px",
      border: "1px solid #e0e0e0",
      borderRadius: "8px",
      marginBottom: "15px",
      backgroundColor: "#fafafa",
    }}>
      <h4 style={{ marginBottom: "10px", color: "#333" }}>
        📍 {booking.facility?.name || t("attendance.facility")}
      </h4>

      <p style={{ marginBottom: "8px", color: "#666", fontSize: "14px" }}>
        <strong>{t("attendance.time")}</strong> {startTime.toLocaleString(locale)}
      </p>

      <p style={{ marginBottom: "8px", color: canCheckInNow ? "#2e7d32" : "#92400e", fontSize: "13px" }}>
        <strong>{t("attendance.window")}</strong> {checkInOpensAt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
        {" "}→{" "}
        {checkInClosesAt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
      </p>

      {location && (
        <p style={{ marginBottom: "8px", color: "#5a6a80", fontSize: "12px" }}>
          <strong>{t("attendance.yourLocation")}</strong> {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
        </p>
      )}

      <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
        <button
          onClick={refreshLocationPreview}
          disabled={loading}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: "6px",
            border: "1px solid #d9e2ec",
            background: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "12px",
            color: "#1f2937"
          }}
        >
          {t("attendance.updateLocationBtn")}
        </button>
      </div>

      {/* Telemetry Simulator Panel */}
      <div style={{
        margin: "15px 0",
        padding: "12px",
        backgroundColor: "#f0f4f8",
        border: "1px solid #d9e2ec",
        borderRadius: "6px",
        fontSize: "13px"
      }}>
        <h5 style={{ margin: "0 0 10px 0", color: "#102a43", fontWeight: "bold" }}>
          ⚙️ محاكي معلمات الـ GPS (Telemetry Simulator)
        </h5>
        
        <div style={{ marginBottom: "10px" }}>
          <label style={{ display: "block", marginBottom: "5px", color: "#334e68", fontWeight: "500" }}>
            📡 دقة الـ GPS المحاكاة: <span style={{ fontWeight: "bold", color: "#0066cc" }}>{simulatedAccuracy} متر</span>
          </label>
          <input
            type="range"
            min="3"
            max="100"
            value={simulatedAccuracy}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSimulatedAccuracy(val);
              if (location) {
                drawMap(
                  booking.facility?.latitude || 30.0544,
                  booking.facility?.longitude || 31.3572,
                  location.latitude,
                  location.longitude
                );
              }
            }}
            style={{ width: "100%", cursor: "pointer" }}
          />
          <span style={{ fontSize: "11px", color: "#627d98" }}>
            (الدقة الضعيفة &gt; 15م تزيد تلقائياً القطر الفعال للملعب لمنع مشاكل التغطية داخل المباني)
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <input
            type="checkbox"
            id="mock-gps-check"
            checked={simulatedMock}
            onChange={(e) => setSimulatedMock(e.target.checked)}
            style={{ cursor: "pointer" }}
          />
          <label htmlFor="mock-gps-check" style={{ color: "#c62828", fontWeight: "bold", cursor: "pointer" }}>
            ⚠️ محاكاة برنامج Fake GPS (Mock Location)
          </label>
        </div>

        <div style={{ padding: "8px", backgroundColor: "#fff", borderLeft: "3px solid #0066cc", borderRadius: "4px", fontSize: "11px", color: "#486581" }}>
          💡 <strong>معلومة أمنية:</strong> فحص شبكة واي فاي الجامعة (Campus WiFi Fallback) يتم تلقائياً بالكامل من السيرفر بناءً على عنوان الـ IP الفعلي للجهاز (مثل الاتصال بـ Localhost أو شبكة داخلية) ولا يتم إرسال أي بيانات من الـ Frontend لمنع التزوير.
        </div>
      </div>

      <div ref={mapContainer} style={{ marginBottom: "15px" }} />

      {distance !== null && (
        <p style={{
          marginBottom: "10px",
          padding: "10px",
          backgroundColor: (distance * 1000) <= ((booking.facility?.geofencingRadius ?? 0.004) * 1000 + Math.min(simulatedAccuracy * 0.5, 15)) ? "#e8f5e9" : "#ffebee",
          borderRadius: "4px",
          color: (distance * 1000) <= ((booking.facility?.geofencingRadius ?? 0.004) * 1000 + Math.min(simulatedAccuracy * 0.5, 15)) ? "#2e7d32" : "#c62828",
        }}>
          <strong>{t("attendance.distance")}</strong> {Math.round(distance * 1000)} {t("attendance.metersFromFacility")}
        </p>
      )}

      {insideField !== null && (
        <p style={{
          marginBottom: "10px",
          padding: "8px 10px",
          borderRadius: "4px",
          fontSize: "13px",
          backgroundColor: insideField ? "#e8f5e9" : "#ffebee",
          color: insideField ? "#2e7d32" : "#c62828",
          fontWeight: "bold",
        }}>
          {insideField ? t("attendance.insideField") : t("attendance.outsideField")}
        </p>
      )}

      {booking.checkedInAt && (
        <div style={{
          marginBottom: "12px",
          padding: "10px",
          backgroundColor: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "6px",
          fontSize: "13px"
        }}>
          <p style={{ margin: "0 0 5px 0", color: "#475569" }}>
            <strong>{t("attendance.checkedInTime")}</strong> {new Date(booking.checkedInAt).toLocaleTimeString(locale)}
          </p>
          {verificationMethod && (
            <p style={{ margin: "0 0 5px 0", color: "#475569" }}>
              <strong>طريقة التحقق:</strong> <span style={{
                padding: "2px 6px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: "bold",
                backgroundColor: verificationMethod === "CAMPUS_WIFI" ? "#e0f2fe" : "#dcfce7",
                color: verificationMethod === "CAMPUS_WIFI" ? "#0369a1" : "#15803d"
              }}>{verificationMethodDesc || verificationMethod}</span>
            </p>
          )}
          {riskScore !== null && (
            <p style={{ margin: "0", color: "#475569" }}>
              <strong>درجة المخاطر (Risk Score):</strong> <span style={{
                padding: "2px 6px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: "bold",
                backgroundColor: riskScore > 70 ? "#fee2e2" : riskScore > 30 ? "#ffedd5" : "#dcfce7",
                color: riskScore > 70 ? "#b91c1c" : riskScore > 30 ? "#c2410c" : "#15803d"
              }}>{riskScore}% {riskScore > 70 ? "(مرتفع / تلاعب محتمل)" : riskScore > 30 ? "(متوسط / مريب)" : "(منخفض / موثوق)"}</span>
            </p>
          )}
        </div>
      )}

      {error && (
        <div style={{
          marginBottom: "10px",
          padding: "10px",
          backgroundColor: "#ffebee",
          color: "#c62828",
          borderRadius: "4px",
          fontSize: "14px",
        }}>
          ❌ {error}
        </div>
      )}

      {success && (
        <div style={{
          marginBottom: "10px",
          padding: "10px",
          backgroundColor: "#e8f5e9",
          color: "#2e7d32",
          borderRadius: "4px",
          fontSize: "14px",
        }}>
          ✓ {success}
        </div>
      )}

      <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
        {!isCheckedIn && (
          <button
            onClick={handleCheckIn}
            disabled={loading || !canCheckInNow}
            style={{
              flex: 1,
              padding: "10px",
              backgroundColor: "#4CAF50",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading || !canCheckInNow ? 0.6 : 1,
              fontWeight: "bold",
            }}
          >
            {loading ? t("attendance.loading") : t("attendance.checkinBtn")}
          </button>
        )}

        {isCheckedIn && !isCheckedOut && (
          <button
            onClick={handleCheckOut}
            disabled={loading}
            style={{
              flex: 1,
              padding: "10px",
              backgroundColor: "#2196F3",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              fontWeight: "bold",
            }}
          >
            {loading ? t("attendance.loading") : t("attendance.checkoutBtn")}
          </button>
        )}

        {isCheckedOut && (
          <div style={{
            flex: 1,
            padding: "10px",
            backgroundColor: "#e8f5e9",
            color: "#2e7d32",
            borderRadius: "4px",
            textAlign: "center",
            fontWeight: "bold",
          }}>
            {t("attendance.doneBtn")}
          </div>
        )}
      </div>

      <div style={{
        marginTop: "15px",
        padding: "10px",
        backgroundColor: "#f5f5f5",
        borderRadius: "4px",
        fontSize: "12px",
        color: "#999",
      }}>
        <p style={{ marginBottom: "5px" }}>
          <strong>{t("attendance.notesTitle")}</strong>
        </p>
        <ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
          <li>{t("attendance.note1")}</li>
          <li>
            {t("attendance.note2", { radius: Math.round((booking.facility?.geofencingRadius ?? 0.004) * 1000) })}
          </li>
          <li>{t("attendance.note3")}</li>
        </ul>
      </div>
    </div>
  );
}
