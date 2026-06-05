import React, { useState, useEffect, useRef } from "react";
import "../AdminDashboard.css"; // استخدام نفس الـ styling

export default function AttendanceCard({
  booking,
  onCheckIn,
  onCheckOut,
  API,
}) {
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [insideField, setInsideField] = useState(null);
  const heartbeatIntervalRef = useRef(null);
  const mapContainer = useRef(null);

  const isCheckedIn =
    booking.attendanceStatus === "CHECKED_IN" ||
    booking.attendanceStatus === "CHECKED_OUT";
  const isCheckedOut = booking.attendanceStatus === "CHECKED_OUT";

  // الحصول على الموقع الجغرافي الحالي
  const getCurrentLocation = async () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setError("متصفحك لا يدعم تحديد الموقع الجغرافي");
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocation({ latitude, longitude });
          resolve({ latitude, longitude });
        },
        (error) => {
          const errorMessages = {
            "1": "يجب السماح بالوصول إلى موقعك الجغرافي",
            "2": "لم نتمكن من تحديد موقعك الجغرافي",
            "3": "انتهت مهلة تحديد الموقع",
          };
          setError(
            errorMessages[error.code] ||
              "خطأ في تحديد الموقع الجغرافي"
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
    canvas.style.border = "1px solid #ccc";
    canvas.style.borderRadius = "8px";
    canvas.style.marginBottom = "15px";

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // رسم خلفية
    ctx.fillStyle = "#e8f4f8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // رسم شبكة
    ctx.strokeStyle = "#d0d0d0";
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

    // رسم نطاق الـ geofencing
    const radiusKm = Math.min(booking.facility?.geofencingRadius ?? 0.004, 0.004);
    const radiusPixels = (radiusKm / 0.2) * 50; // تحويل إلى بكسلات

    ctx.fillStyle = "rgba(76, 175, 80, 0.1)";
    ctx.beginPath();
    ctx.arc(centerX, centerY, radiusPixels, 0, 2 * Math.PI);
    ctx.fill();

    ctx.strokeStyle = "#4CAF50";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radiusPixels, 0, 2 * Math.PI);
    ctx.stroke();

    // رسم موقع المنشأة (المركز)
    ctx.fillStyle = "#FF6B6B";
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText("المنشأة", centerX, centerY - 15);

    // رسم موقع الطالب (إن وجد)
    if (studentLat !== undefined && studentLon !== undefined) {
      const dist = calculateDistance(facilityLat, facilityLon, studentLat, studentLon);
      setDistance(dist);

      // تحويل الإحداثيات إلى بكسلات (تقريب بسيط)
      const scaleX = (studentLon - facilityLon) * 11132 * 0.7; // تحويل إلى بكسلات
      const scaleY = (studentLat - facilityLat) * 11132 * 0.7;

      const studentX = Math.max(20, Math.min(canvas.width - 20, centerX + scaleX));
      const studentY = Math.max(20, Math.min(canvas.height - 20, centerY + scaleY));

      ctx.fillStyle = "#4169E1";
      ctx.beginPath();
      ctx.arc(studentX, studentY, 6, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.fillText("أنت", studentX, studentY - 12);

      // رسم خط يربط بين الموقعين
      ctx.strokeStyle = "#FFA500";
      ctx.setLineDash([5, 5]);
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

  // معالج تسجيل الحضور
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
      }),
    });

    const data = await response.json();
    if (!response.ok || data.success === false) {
      throw new Error(data.message || "فشل تحديث الموقع");
    }
    if (typeof data.insideField === "boolean") {
      setInsideField(data.insideField);
    }
    return data;
  };

  const handleCheckIn = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const loc = await getCurrentLocation();
      if (!loc) {
        setError("لم نتمكن من الحصول على موقعك الجغرافي");
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
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess("تم تسجيل حضورك بنجاح! ✓");
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
      setError("خطأ في الاتصال: " + err.message);
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
        setSuccess("تم تسجيل انصرافك بنجاح! ✓");
        onCheckOut(true, data.message);
      } else {
        setError(data.message);
        onCheckOut(false, data.message);
      }
    } catch (err) {
      setError("خطأ في الاتصال: " + err.message);
      onCheckOut(false, err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
        📍 {booking.facility?.name || "منشأة"}
      </h4>

      <p style={{ marginBottom: "8px", color: "#666", fontSize: "14px" }}>
        <strong>الموعد:</strong> {startTime.toLocaleString("ar-EG")}
      </p>

      <p style={{ marginBottom: "8px", color: canCheckInNow ? "#2e7d32" : "#92400e", fontSize: "13px" }}>
        <strong>نافذة الحضور:</strong> {checkInOpensAt.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
        {" "}→{" "}
        {checkInClosesAt.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
      </p>

      {location && (
        <p style={{ marginBottom: "8px", color: "#5a6a80", fontSize: "12px" }}>
          <strong>موقعك الحالي:</strong> {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
        </p>
      )}

      <button
        onClick={refreshLocationPreview}
        disabled={loading}
        style={{
          marginBottom: "10px",
          padding: "8px 10px",
          borderRadius: "6px",
          border: "1px solid #d9e2ec",
          background: "#fff",
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: "12px",
          color: "#1f2937"
        }}
      >
        📡 تحديث الموقع على الخريطة
      </button>

      <div ref={mapContainer} style={{ marginBottom: "15px" }} />

      {distance !== null && (
        <p style={{
          marginBottom: "10px",
          padding: "10px",
          backgroundColor: distance * 1000 <= Math.min((booking.facility?.geofencingRadius ?? 0.004) * 1000, 4) ? "#e8f5e9" : "#ffebee",
          borderRadius: "4px",
          color: distance * 1000 <= Math.min((booking.facility?.geofencingRadius ?? 0.004) * 1000, 4) ? "#2e7d32" : "#c62828",
        }}>
          <strong>المسافة:</strong> {Math.round(distance * 1000)} متر من المنشأة
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
          {insideField ? "🟢 الحالة الآن: داخل الملعب" : "🔴 الحالة الآن: خارج الملعب"}
        </p>
      )}

      {booking.checkedInAt && (
        <p style={{ marginBottom: "8px", color: "#666", fontSize: "14px" }}>
          <strong>✓ وقت الحضور:</strong> {new Date(booking.checkedInAt).toLocaleTimeString("ar-EG")}
        </p>
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
            {loading ? "جاري التحميل..." : "✓ تسجيل الحضور"}
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
            {loading ? "جاري التحميل..." : "↪ تسجيل الانصراف"}
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
            ✓ تم الانتهاء
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
          <strong>ملاحظات:</strong>
        </p>
        <ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
          <li>يمكنك تسجيل الحضور من 15 دقيقة قبل بدء الحجز</li>
          <li>
            يجب أن تكون ضمن نطاق{" "}
            {Math.min(Math.round((booking.facility?.geofencingRadius ?? 0.004) * 1000), 4)} متر من
            المنشأة
          </li>
          <li>سيتم حساب نقاط المشاركة فقط عند تسجيل الحضور</li>
        </ul>
      </div>
    </div>
  );
}
