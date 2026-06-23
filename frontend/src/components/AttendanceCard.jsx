import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "../context/LanguageContext";

/* ─────────────────────────────────────────
   Professional Geo-Radar Attendance Card
   World-class Design — Badya Sport Portal
   ───────────────────────────────────────── */

export default function AttendanceCard({ booking, onCheckIn, onCheckOut, API }) {
  const { language, t } = useLanguage();
  const locale = language === "ar" ? "ar-EG" : "en-GB";

  const [loading, setLoading]       = useState(false);
  const [location, setLocation]     = useState(null);
  const [distance, setDistance]     = useState(null);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState("");
  const [insideField, setInsideField] = useState(null);

  const heartbeatIntervalRef = useRef(null);
  const canvasRef            = useRef(null);
  const animFrameRef         = useRef(null);

  // Telemetry Simulator state
  const [simulatedAccuracy, setSimulatedAccuracy] = useState(5.0);
  const [simulatedMock,     setSimulatedMock]     = useState(false);
  const [verificationMethod,     setVerificationMethod]     = useState(booking.verificationMethod || "");
  const [verificationMethodDesc, setVerificationMethodDesc] = useState(booking.verificationMethodDesc || "");
  const [riskScore, setRiskScore] = useState(booking.riskScore ?? null);

  // Live map coordinates — updated by ref so the render loop always has fresh data
  const mapCoordsRef = useRef({
    facilityLat: booking.facility?.latitude  || 30.0544,
    facilityLon: booking.facility?.longitude || 31.3572,
    studentLat:  booking.studentLatitude,
    studentLon:  booking.studentLongitude,
  });

  const isCheckedIn  = booking.attendanceStatus === "CHECKED_IN"  || booking.attendanceStatus === "CHECKED_OUT";
  const isCheckedOut = booking.attendanceStatus === "CHECKED_OUT";

  /* ── Haversine distance (km) ── */
  const calcDist = (la1, lo1, la2, lo2) => {
    const R   = 6371;
    const dLa = ((la2 - la1) * Math.PI) / 180;
    const dLo = ((lo2 - lo1) * Math.PI) / 180;
    const a   = Math.sin(dLa / 2) ** 2 +
                Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  /* ── Update map coordinates ── */
  const drawMap = (fLat, fLon, sLat, sLon) => {
    mapCoordsRef.current = { facilityLat: fLat, facilityLon: fLon, studentLat: sLat, studentLon: sLon };
  };

  /* ────────────────────────────────────────────────────
     60 FPS RADAR CANVAS RENDER LOOP
     ──────────────────────────────────────────────────── */
  useEffect(() => {
    let sweepAngle    = 0;
    let pulseProgress = 0;
    let trailAngle    = 0;
    const TRAIL_LENGTH = Math.PI * 0.55;

    const render = (ts) => {
      const canvas = canvasRef.current;
      if (!canvas) { animFrameRef.current = requestAnimationFrame(render); return; }
      const ctx = canvas.getContext("2d");

      // DPI-aware dimensions
      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const cy = H / 2;
      const R  = Math.min(W, H) / 2 - 18; // radar radius in px

      // ── 1. Background ──────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.75);
      bg.addColorStop(0,   "#0d1b2a");
      bg.addColorStop(0.6, "#071018");
      bg.addColorStop(1,   "#020a14");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── 2. Outer bezel ring ────────────────────────────────────────
      ctx.save();
      ctx.strokeStyle = "rgba(0,212,255,0.18)";
      ctx.lineWidth   = 12;
      ctx.shadowColor = "#00d4ff";
      ctx.shadowBlur  = 20;
      ctx.beginPath();
      ctx.arc(cx, cy, R + 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // thin crisp inner ring
      ctx.save();
      ctx.strokeStyle = "rgba(0,212,255,0.45)";
      ctx.lineWidth   = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // ── 3. Clip everything to the radar circle ─────────────────────
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      // subtle scanline tint inside
      const scanBg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      scanBg.addColorStop(0,   "rgba(0,40,80,0.25)");
      scanBg.addColorStop(1,   "rgba(0,10,30,0)");
      ctx.fillStyle = scanBg;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

      // ── 4. Concentric grid rings ───────────────────────────────────
      const rings = [0.25, 0.5, 0.75, 1.0];
      rings.forEach((f, i) => {
        const r = R * f;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = i === rings.length - 1
          ? "rgba(0,212,255,0.22)"
          : "rgba(0,212,255,0.09)";
        ctx.lineWidth = i === rings.length - 1 ? 1.2 : 0.7;
        ctx.stroke();
      });

      // ── 5. Cross-hair lines ────────────────────────────────────────
      ctx.strokeStyle = "rgba(0,212,255,0.12)";
      ctx.lineWidth   = 0.7;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.stroke();
      }

      // ── 6. Radar sweep trail (gradient arc) ───────────────────────
      sweepAngle = (sweepAngle + 0.015) % (Math.PI * 2);
      trailAngle = sweepAngle - TRAIL_LENGTH;

      ctx.save();
      // Trail gradient along the arc
      const trailGrad = ctx.createConicalGradient
        ? null  // native API if exists
        : null;
      // Fallback: filled sector
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, trailAngle, sweepAngle, false);
      ctx.closePath();
      const trailFill = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      trailFill.addColorStop(0,   "rgba(0,255,128,0.18)");
      trailFill.addColorStop(0.6, "rgba(0,255,128,0.06)");
      trailFill.addColorStop(1,   "rgba(0,255,128,0)");
      ctx.fillStyle = trailFill;
      ctx.fill();

      // Bright leading edge line
      ctx.strokeStyle = "rgba(0,255,128,0.85)";
      ctx.lineWidth   = 1.5;
      ctx.shadowColor = "#00ff80";
      ctx.shadowBlur  = 8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweepAngle) * R, cy + Math.sin(sweepAngle) * R);
      ctx.stroke();
      ctx.restore();

      // ── 7. Range labels ───────────────────────────────────────────
      const { facilityLat, facilityLon, studentLat, studentLon } = mapCoordsRef.current;
      const radiusKm      = booking.facility?.geofencingRadius ?? 0.004;
      const radiusMeters  = radiusKm * 1000;
      const bufferMeters  = Math.min(simulatedAccuracy * 0.5, 15);
      const effRadMeters  = radiusMeters + bufferMeters;
      const distMeters    = (studentLat !== undefined && studentLon !== undefined)
        ? calcDist(facilityLat, facilityLon, studentLat, studentLon) * 1000 : 0;

      const maxDim = Math.max(effRadMeters, simulatedAccuracy, distMeters, 30);
      const scale  = (R * 0.85) / maxDim; // px per meter, 85% of R

      // ring labels
      ctx.fillStyle = "rgba(0,212,255,0.45)";
      ctx.font      = "bold 9px 'Courier New', monospace";
      ctx.textAlign = "center";
      rings.forEach((f) => {
        const mLabel = Math.round((R * f) / scale);
        if (mLabel > 0) {
          ctx.fillText(`${mLabel}m`, cx + R * f - 8, cy - 4);
        }
      });

      // ── 8. Geofence zone (green glow ring) ────────────────────────
      const geoR = radiusMeters * scale;
      const effR = effRadMeters * scale;

      // fill
      const geoFill = ctx.createRadialGradient(cx, cy, geoR * 0.6, cx, cy, geoR);
      geoFill.addColorStop(0, "rgba(0,255,128,0.04)");
      geoFill.addColorStop(1, "rgba(0,255,128,0.12)");
      ctx.fillStyle = geoFill;
      ctx.beginPath();
      ctx.arc(cx, cy, geoR, 0, Math.PI * 2);
      ctx.fill();

      // border
      ctx.save();
      ctx.shadowColor = "#00ff80";
      ctx.shadowBlur  = 14;
      ctx.strokeStyle = "rgba(0,255,128,0.9)";
      ctx.lineWidth   = 1.8;
      ctx.beginPath();
      ctx.arc(cx, cy, geoR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // fuzzy buffer
      if (effR > geoR + 1) {
        ctx.save();
        ctx.shadowColor  = "#f59e0b";
        ctx.shadowBlur   = 8;
        ctx.strokeStyle  = "rgba(245,158,11,0.65)";
        ctx.lineWidth    = 1.2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(cx, cy, effR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // ── 9. Student position ───────────────────────────────────────
      if (studentLat !== undefined && studentLon !== undefined) {
        const dLatM = (studentLat - facilityLat) * 111320;
        const dLonM = (studentLon - facilityLon) * 111320 * Math.cos(facilityLat * Math.PI / 180);
        const sx = cx + dLonM * scale;
        const sy = cy - dLatM * scale;

        // connector line (clipped to radar)
        ctx.save();
        ctx.strokeStyle = "rgba(250,100,130,0.55)";
        ctx.lineWidth   = 1.2;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(sx, sy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // distance badge
        const midX = (cx + sx) / 2;
        const midY = (cy + sy) / 2;
        const badge = `${Math.round(distMeters)}m`;
        ctx.save();
        ctx.font = "bold 9px 'Courier New', monospace";
        const bw = ctx.measureText(badge).width + 12;
        ctx.fillStyle   = "rgba(5,15,30,0.88)";
        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth   = 1;
        ctx.shadowColor = "#f43f5e";
        ctx.shadowBlur  = 6;
        ctx.beginPath();
        ctx.roundRect(midX - bw / 2, midY - 8, bw, 16, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#f87171";
        ctx.textAlign = "center";
        ctx.shadowBlur = 0;
        ctx.fillText(badge, midX, midY + 4);
        ctx.restore();

        // GPS accuracy halo
        const accPx = simulatedAccuracy * scale;
        ctx.save();
        ctx.fillStyle   = "rgba(56,189,248,0.07)";
        ctx.strokeStyle = "rgba(56,189,248,0.3)";
        ctx.lineWidth   = 0.8;
        ctx.beginPath();
        ctx.arc(sx, sy, accPx, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // student pulse rings
        pulseProgress = ((Date.now() % 2000) / 2000);
        ctx.save();
        ctx.strokeStyle = `rgba(56,189,248,${(1 - pulseProgress) * 0.8})`;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, 6 + pulseProgress * 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // student dot
        ctx.save();
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur  = 16;
        ctx.fillStyle   = "#38bdf8";
        ctx.beginPath();
        ctx.arc(sx, sy, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth   = 1.5;
        ctx.stroke();
        ctx.restore();

        // "YOU" label
        ctx.fillStyle = "#7dd3fc";
        ctx.font      = "bold 9px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText(t("attendance.mapLabelYou"), sx, sy - 14);
      }

      // ── 10. Facility crosshair ─────────────────────────────────────
      const fPulse = (Date.now() % 2500) / 2500;
      ctx.save();
      ctx.strokeStyle = `rgba(239,68,68,${(1 - fPulse) * 0.9})`;
      ctx.lineWidth   = 1.5;
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur  = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, 9 + fPulse * 18, 0, Math.PI * 2);
      ctx.stroke();

      // crosshair lines
      ctx.strokeStyle = "rgba(239,68,68,0.7)";
      ctx.lineWidth   = 1;
      ctx.shadowBlur  = 4;
      const crossSize = 14;
      ctx.beginPath();
      ctx.moveTo(cx - crossSize, cy); ctx.lineTo(cx + crossSize, cy);
      ctx.moveTo(cx, cy - crossSize); ctx.lineTo(cx, cy + crossSize);
      ctx.stroke();

      // facility dot
      ctx.shadowBlur = 18;
      ctx.fillStyle  = "#ef4444";
      ctx.beginPath();
      ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth   = 1.5;
      ctx.shadowBlur  = 0;
      ctx.stroke();
      ctx.restore();

      // facility label
      ctx.fillStyle = "#fca5a5";
      ctx.font      = "bold 9px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText(t("attendance.mapLabelFacility"), cx, cy - 18);

      // ── end clip ──────────────────────────────────────────────────
      ctx.restore();

      // ── 11. HUD overlays (outside clip) ───────────────────────────
      // top-left: system label
      ctx.fillStyle = "rgba(0,212,255,0.5)";
      ctx.font      = "bold 8px 'Courier New', monospace";
      ctx.textAlign = "left";
      ctx.fillText("◈ GEO-RADAR  v3.1", 10, 16);

      // top-right: GPS state
      ctx.textAlign = "right";
      if (simulatedMock) {
        ctx.fillStyle = "#f87171";
        ctx.fillText("⚠  GPS: MOCKED", W - 10, 16);
      } else {
        ctx.fillStyle = "#4ade80";
        ctx.fillText("✓  GPS: SECURE", W - 10, 16);
      }

      // bottom-left: accuracy
      ctx.fillStyle = "rgba(0,212,255,0.45)";
      ctx.textAlign = "left";
      ctx.fillText(`ACC ±${Math.round(simulatedAccuracy)}m`, 10, H - 8);

      // bottom-right: risk
      ctx.textAlign = "right";
      const riskLabel = riskScore !== null
        ? `RISK ${riskScore}%`
        : "RISK --";
      ctx.fillStyle = riskScore !== null
        ? (riskScore > 70 ? "#f87171" : riskScore > 30 ? "#fbbf24" : "#4ade80")
        : "rgba(0,212,255,0.45)";
      ctx.fillText(riskLabel, W - 10, H - 8);

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [simulatedAccuracy, simulatedMock, riskScore]);

  /* ── Geolocation helper ── */
  const getCurrentLocation = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) { setError(t("attendance.browserNoSupport")); resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        ({ coords: { latitude, longitude, accuracy } }) => {
          const finalAcc = simulatedAccuracy !== 5.0 ? simulatedAccuracy : (accuracy || 5.0);
          setLocation({ latitude, longitude, accuracy: finalAcc });
          resolve({ latitude, longitude, accuracy: finalAcc });
        },
        (err) => {
          const msgs = { 1: t("attendance.locationPermissionDenied"), 2: t("attendance.locationUnavailable"), 3: t("attendance.locationTimeout") };
          setError(msgs[err.code] || t("attendance.locationErrorDefault"));
          resolve(null);
        }
      );
    });

  /* ── Heartbeat ── */
  const sendHeartbeat = async (loc) => {
    const res  = await fetch(`${API}/api/attendance/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
      body: JSON.stringify({ bookingId: booking.id, studentLatitude: loc.latitude, studentLongitude: loc.longitude, gpsAccuracy: simulatedAccuracy, isMocked: simulatedMock, deviceId: localStorage.getItem("device_uuid") || "" }),
    });
    const data = await res.json();
    if (!res.ok || data.success === false) throw new Error(data.message || t("attendance.locationFail"));
    if (typeof data.insideField === "boolean") setInsideField(data.insideField);
    if (data.verificationMethod) setVerificationMethod(data.verificationMethod);
    if (data.riskScore !== undefined) setRiskScore(data.riskScore);
    return data;
  };

  /* ── Check-In ── */
  const handleCheckIn = async () => {
    setLoading(true); setError(""); setSuccess("");
    try {
      const loc = await getCurrentLocation();
      if (!loc) { setLoading(false); return; }
      const res  = await fetch(`${API}/api/attendance/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ bookingId: booking.id, studentLatitude: loc.latitude, studentLongitude: loc.longitude, gpsAccuracy: simulatedAccuracy, isMocked: simulatedMock, deviceId: localStorage.getItem("device_uuid") || "" }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(t("attendance.checkinSuccess"));
        if (data.verificationMethod)     setVerificationMethod(data.verificationMethod);
        if (data.verificationMethodDesc) setVerificationMethodDesc(data.verificationMethodDesc);
        if (data.riskScore !== undefined) setRiskScore(data.riskScore);
        drawMap(booking.facility?.latitude || 30.0544, booking.facility?.longitude || 31.3572, loc.latitude, loc.longitude);
        onCheckIn(true, data.message);
      } else {
        setError(data.message); onCheckIn(false, data.message);
      }
    } catch (err) {
      setError(t("attendance.connError") + err.message); onCheckIn(false, err.message);
    } finally { setLoading(false); }
  };

  /* ── Check-Out ── */
  const handleCheckOut = async () => {
    setLoading(true); setError(""); setSuccess("");
    try {
      const res  = await fetch(`${API}/api/attendance/check-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ bookingId: booking.id }),
      });
      const data = await res.json();
      if (data.success) { setSuccess(t("attendance.checkoutSuccess")); onCheckOut(true, data.message); }
      else { setError(data.message); onCheckOut(false, data.message); }
    } catch (err) {
      setError(t("attendance.connError") + err.message); onCheckOut(false, err.message);
    } finally { setLoading(false); }
  };

  /* ── Update location preview ── */
  const refreshLocationPreview = async () => {
    setError("");
    const loc = await getCurrentLocation();
    if (!loc) return;
    const fLat = booking.facility?.latitude  || 30.0544;
    const fLon = booking.facility?.longitude || 31.3572;
    const d    = calcDist(fLat, fLon, loc.latitude, loc.longitude);
    setDistance(d);
    drawMap(fLat, fLon, loc.latitude, loc.longitude);
    if (booking.attendanceStatus === "CHECKED_IN") {
      try { await sendHeartbeat(loc); } catch {}
    }
  };

  /* ── On mount: load saved attendance details & draw map ── */
  useEffect(() => {
    const fetchDetails = async () => {
      if (isCheckedIn) {
        try {
          const res  = await fetch(`${API}/api/attendance/booking/${booking.id}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
          const data = await res.json();
          if (data.verificationMethod)     setVerificationMethod(data.verificationMethod);
          if (data.verificationMethodDesc) setVerificationMethodDesc(data.verificationMethodDesc);
          if (data.riskScore !== undefined) setRiskScore(data.riskScore);
        } catch {}
      }
    };
    fetchDetails();
    if (booking.facility?.latitude && booking.facility?.longitude) {
      drawMap(booking.facility.latitude, booking.facility.longitude, booking.studentLatitude, booking.studentLongitude);
    }
  }, []);

  /* ── Heartbeat interval ── */
  useEffect(() => {
    if (booking.attendanceStatus !== "CHECKED_IN") {
      clearInterval(heartbeatIntervalRef.current); heartbeatIntervalRef.current = null; return;
    }
    const tick = async () => {
      const loc = await getCurrentLocation();
      if (!loc) return;
      drawMap(booking.facility?.latitude || 30.0544, booking.facility?.longitude || 31.3572, loc.latitude, loc.longitude);
      try { await sendHeartbeat(loc); } catch {}
    };
    tick();
    heartbeatIntervalRef.current = setInterval(tick, 20000);
    return () => clearInterval(heartbeatIntervalRef.current);
  }, [booking.attendanceStatus, booking.id, API]);

  /* ── Time helpers ── */
  const startTime       = new Date(booking.startTime);
  const now             = new Date();
  const checkInOpensAt  = new Date(startTime.getTime() - 15 * 60 * 1000);
  const checkInClosesAt = new Date(startTime.getTime() + 60 * 60 * 1000);
  const canCheckInNow   = now >= checkInOpensAt && now <= checkInClosesAt;

  /* ── Status helpers ── */
  const statusLabel =
    isCheckedOut ? { text: t("attendance.doneBtn"),    color: "#34d399", bg: "rgba(52,211,153,0.12)",  icon: "✓" } :
    isCheckedIn  ? { text: "CHECKED IN",               color: "#60a5fa", bg: "rgba(96,165,250,0.12)",  icon: "●" } :
                   { text: "PENDING",                  color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  icon: "○" };

  const riskColor = riskScore === null ? "#94a3b8"
    : riskScore > 70 ? "#f87171"
    : riskScore > 30 ? "#fbbf24"
    : "#4ade80";

  /* ═══════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════ */
  return (
    <div style={{
      fontFamily: "'Inter', 'Cairo', system-ui, sans-serif",
      background: "linear-gradient(145deg, #0f172a 0%, #0d1b2a 60%, #071018 100%)",
      border: "1px solid rgba(0,212,255,0.2)",
      borderRadius: "20px",
      padding: "0",
      marginBottom: "20px",
      overflow: "hidden",
      boxShadow: "0 0 40px rgba(0,212,255,0.08), 0 8px 32px rgba(0,0,0,0.6)",
      position: "relative",
    }}>

      {/* ── Header strip ─────────────────────────────────────── */}
      <div style={{
        padding: "16px 20px 12px",
        borderBottom: "1px solid rgba(0,212,255,0.1)",
        background: "linear-gradient(90deg, rgba(0,212,255,0.06) 0%, transparent 100%)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>📍</span>
            <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "#e2e8f0", letterSpacing: "0.02em" }}>
              {booking.facility?.name || t("attendance.facility")}
            </span>
          </div>
          <div style={{ color: "#64748b", fontSize: "0.78rem", fontFamily: "'Courier New', monospace" }}>
            {startTime.toLocaleString(locale)}
          </div>
        </div>
        {/* Status pill */}
        <div style={{
          padding: "5px 14px", borderRadius: 999,
          background: statusLabel.bg, border: `1px solid ${statusLabel.color}40`,
          color: statusLabel.color, fontWeight: 700, fontSize: "0.72rem",
          letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 5,
        }}>
          <span style={{ fontSize: 10 }}>{statusLabel.icon}</span>
          {statusLabel.text}
        </div>
      </div>

      {/* ── Check-in window bar ───────────────────────────────── */}
      <div style={{
        padding: "8px 20px",
        borderBottom: "1px solid rgba(0,212,255,0.06)",
        display: "flex", alignItems: "center", gap: 8,
        fontSize: "0.78rem",
        color: canCheckInNow ? "#34d399" : "#f59e0b",
      }}>
        <span style={{ opacity: 0.7 }}>⏱</span>
        <span style={{ fontFamily: "'Courier New', monospace" }}>
          {t("attendance.window")}&nbsp;
          {checkInOpensAt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
          &nbsp;→&nbsp;
          {checkInClosesAt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
        </span>
        {canCheckInNow && (
          <span style={{
            marginLeft: "auto", padding: "2px 8px",
            background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)",
            borderRadius: 999, color: "#34d399", fontSize: "0.68rem", fontWeight: 700,
          }}>WINDOW OPEN</span>
        )}
      </div>

      {/* ── Radar map ─────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "20px 20px 0",
        background: "radial-gradient(ellipse at center, rgba(0,212,255,0.03) 0%, transparent 70%)",
      }}>
        {/* Radar label row */}
        <div style={{
          width: "100%", maxWidth: 300,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 8,
        }}>
          <span style={{
            fontSize: "0.7rem", fontFamily: "'Courier New', monospace",
            color: "rgba(0,212,255,0.55)", letterSpacing: "0.1em",
          }}>◈ GEO-RADAR DISPLAY</span>
          <span style={{
            fontSize: "0.7rem", fontFamily: "'Courier New', monospace",
            color: simulatedMock ? "#f87171" : "#4ade80",
          }}>
            {simulatedMock ? "⚠ MOCKED" : "✓ SECURE"}
          </span>
        </div>

        {/* Canvas with decorative frame */}
        <div style={{ position: "relative", width: 300, height: 300 }}>
          {/* Corner decorators */}
          {[
            { top: 0,  left: 0,  borderTop: "2px solid", borderLeft:  "2px solid" },
            { top: 0,  right: 0, borderTop: "2px solid", borderRight: "2px solid" },
            { bottom: 0, left: 0,  borderBottom: "2px solid", borderLeft:  "2px solid" },
            { bottom: 0, right: 0, borderBottom: "2px solid", borderRight: "2px solid" },
          ].map((s, i) => (
            <div key={i} style={{
              position: "absolute", width: 14, height: 14,
              borderColor: "rgba(0,212,255,0.55)",
              ...s,
            }} />
          ))}

          <canvas
            ref={canvasRef}
            width={300}
            height={300}
            style={{ display: "block", borderRadius: 4 }}
          />
        </div>

        {/* Coordinate readout */}
        {location && (
          <div style={{
            marginTop: 10, padding: "5px 12px",
            background: "rgba(0,212,255,0.06)",
            border: "1px solid rgba(0,212,255,0.12)",
            borderRadius: 8, fontSize: "0.7rem",
            fontFamily: "'Courier New', monospace", color: "#7dd3fc",
            letterSpacing: "0.04em",
          }}>
            LAT {location.latitude.toFixed(5)}  ·  LON {location.longitude.toFixed(5)}
          </div>
        )}

        {/* Distance & field status pills */}
        {distance !== null && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <div style={{
              padding: "5px 14px", borderRadius: 999,
              background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)",
              color: "#f87171", fontSize: "0.78rem", fontWeight: 700,
              fontFamily: "'Courier New', monospace",
            }}>
              ◌ {Math.round(distance * 1000)}m {t("attendance.metersFromFacility")}
            </div>
            {insideField !== null && (
              <div style={{
                padding: "5px 14px", borderRadius: 999,
                background: insideField ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                border: `1px solid ${insideField ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
                color: insideField ? "#34d399" : "#f87171",
                fontSize: "0.78rem", fontWeight: 700,
              }}>
                {insideField ? "✓ " + t("attendance.insideField") : "✕ " + t("attendance.outsideField")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Telemetry Simulator Panel ─────────────────────────── */}
      <div style={{
        margin: "16px 20px",
        padding: "14px 16px",
        background: "rgba(0,212,255,0.04)",
        border: "1px solid rgba(0,212,255,0.12)",
        borderRadius: 14,
        fontSize: "0.82rem",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          marginBottom: 12, color: "#94a3b8",
          fontFamily: "'Courier New', monospace",
          fontSize: "0.72rem", letterSpacing: "0.08em",
        }}>
          ⚙ TELEMETRY SIMULATOR — GPS PARAMETERS
        </div>

        {/* Accuracy slider */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <label style={{ color: "#94a3b8", fontSize: "0.78rem" }}>
              📡 {t ? "دقة الـ GPS" : "GPS Accuracy"}
            </label>
            <span style={{
              padding: "2px 10px", borderRadius: 999,
              background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)",
              color: "#7dd3fc", fontWeight: 700, fontFamily: "'Courier New', monospace",
              fontSize: "0.78rem",
            }}>
              ±{simulatedAccuracy}m
            </span>
          </div>
          <input
            type="range" min="3" max="100" value={simulatedAccuracy}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSimulatedAccuracy(val);
              if (location) drawMap(
                booking.facility?.latitude  || 30.0544,
                booking.facility?.longitude || 31.3572,
                location.latitude, location.longitude
              );
            }}
            style={{
              width: "100%", appearance: "none", height: 4,
              borderRadius: 2, background: `linear-gradient(to right, #00d4ff ${(simulatedAccuracy - 3) / 97 * 100}%, rgba(0,212,255,0.15) 0%)`,
              outline: "none", cursor: "pointer",
            }}
          />
          <p style={{ color: "#475569", fontSize: "0.7rem", margin: "5px 0 0" }}>
            (الدقة الضعيفة &gt; 15م تزيد تلقائياً القطر الفعال للملعب)
          </p>
        </div>

        {/* Mock GPS toggle */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 12px",
          background: simulatedMock ? "rgba(248,113,113,0.08)" : "rgba(0,212,255,0.04)",
          border: `1px solid ${simulatedMock ? "rgba(248,113,113,0.25)" : "rgba(0,212,255,0.1)"}`,
          borderRadius: 10,
        }}>
          <label style={{ position: "relative", width: 36, height: 20, cursor: "pointer", flexShrink: 0 }}>
            <input
              type="checkbox" id="mock-gps-check" checked={simulatedMock}
              onChange={(e) => setSimulatedMock(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
            />
            <div style={{
              position: "absolute", inset: 0, borderRadius: 999,
              background: simulatedMock ? "#ef4444" : "rgba(71,85,105,0.6)",
              transition: "background 0.2s",
              border: "1px solid rgba(255,255,255,0.1)",
            }} />
            <div style={{
              position: "absolute", top: 2, left: simulatedMock ? 18 : 2,
              width: 16, height: 16, borderRadius: "50%",
              background: "#fff", transition: "left 0.2s",
              boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
            }} />
          </label>
          <label htmlFor="mock-gps-check" style={{
            color: simulatedMock ? "#f87171" : "#64748b",
            fontWeight: 600, cursor: "pointer", fontSize: "0.8rem",
          }}>
            ⚠️ محاكاة برنامج Fake GPS (Mock Location)
          </label>
        </div>

        {/* Security info */}
        <div style={{
          marginTop: 10, padding: "8px 12px",
          background: "rgba(0,100,200,0.08)",
          borderLeft: "3px solid rgba(0,212,255,0.4)",
          borderRadius: "0 8px 8px 0", fontSize: "0.72rem", color: "#475569", lineHeight: 1.5,
        }}>
          💡 <strong style={{ color: "#64748b" }}>معلومة أمنية:</strong> فحص شبكة WiFi الجامعة يتم تلقائياً من السيرفر بناءً على عنوان الـ IP — لا يُرسَل أي بيانات من الـ Frontend لمنع التزوير.
        </div>
      </div>

      {/* ── Update location button ─────────────────────────────── */}
      <div style={{ padding: "0 20px 4px" }}>
        <button
          onClick={refreshLocationPreview}
          disabled={loading}
          style={{
            width: "100%", padding: "10px",
            background: "rgba(0,212,255,0.06)",
            border: "1px solid rgba(0,212,255,0.25)",
            borderRadius: 10, color: "#7dd3fc",
            fontSize: "0.82rem", fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background 0.2s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(0,212,255,0.12)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(0,212,255,0.06)"}
        >
          🔄 {t("attendance.updateLocationBtn")}
        </button>
      </div>

      {/* ── Check-in info block (if already checked in) ─────────── */}
      {booking.checkedInAt && (
        <div style={{
          margin: "12px 20px",
          padding: "12px 16px",
          background: "rgba(52,211,153,0.06)",
          border: "1px solid rgba(52,211,153,0.15)",
          borderRadius: 12, fontSize: "0.8rem",
        }}>
          <p style={{ margin: "0 0 6px", color: "#94a3b8" }}>
            <span style={{ color: "#64748b" }}>⏱ {t("attendance.checkedInTime")}</span>&nbsp;
            <span style={{ color: "#34d399", fontFamily: "'Courier New', monospace", fontWeight: 700 }}>
              {new Date(booking.checkedInAt).toLocaleTimeString(locale)}
            </span>
          </p>
          {verificationMethod && (
            <p style={{ margin: "0 0 6px", color: "#94a3b8" }}>
              <span style={{ color: "#64748b" }}>طريقة التحقق:&nbsp;</span>
              <span style={{
                padding: "2px 8px", borderRadius: 999, fontSize: "0.72rem", fontWeight: 700,
                background: verificationMethod === "CAMPUS_WIFI" ? "rgba(3,105,161,0.15)" : "rgba(21,128,61,0.15)",
                color:      verificationMethod === "CAMPUS_WIFI" ? "#38bdf8" : "#4ade80",
                border: `1px solid ${verificationMethod === "CAMPUS_WIFI" ? "rgba(56,189,248,0.25)" : "rgba(74,222,128,0.25)"}`,
              }}>
                {verificationMethodDesc || verificationMethod}
              </span>
            </p>
          )}
          {riskScore !== null && (
            <p style={{ margin: 0, color: "#94a3b8" }}>
              <span style={{ color: "#64748b" }}>Risk Score:&nbsp;</span>
              <span style={{
                padding: "2px 8px", borderRadius: 999, fontSize: "0.72rem", fontWeight: 700,
                background: `${riskColor}18`, color: riskColor,
                border: `1px solid ${riskColor}40`,
              }}>
                {riskScore}%&nbsp;
                {riskScore > 70 ? "(مرتفع)" : riskScore > 30 ? "(متوسط)" : "(منخفض)"}
              </span>
            </p>
          )}
        </div>
      )}

      {/* ── Alerts ────────────────────────────────────────────── */}
      {error && (
        <div style={{
          margin: "0 20px 12px",
          padding: "10px 14px",
          background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)",
          borderRadius: 10, color: "#f87171", fontSize: "0.82rem",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span>✕</span> {error}
        </div>
      )}
      {success && (
        <div style={{
          margin: "0 20px 12px",
          padding: "10px 14px",
          background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)",
          borderRadius: 10, color: "#34d399", fontSize: "0.82rem",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span>✓</span> {success}
        </div>
      )}

      {/* ── Action buttons ─────────────────────────────────────── */}
      <div style={{ padding: "4px 20px 20px", display: "flex", gap: 10 }}>
        {!isCheckedIn && (
          <button
            onClick={handleCheckIn}
            disabled={loading || !canCheckInNow}
            style={{
              flex: 1, padding: "13px",
              background: loading || !canCheckInNow
                ? "rgba(52,211,153,0.12)"
                : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              border: "1px solid rgba(52,211,153,0.35)",
              borderRadius: 12, color: loading || !canCheckInNow ? "#4ade8080" : "#fff",
              fontWeight: 700, fontSize: "0.9rem", cursor: loading ? "not-allowed" : canCheckInNow ? "pointer" : "not-allowed",
              opacity: loading || !canCheckInNow ? 0.65 : 1,
              transition: "all 0.2s",
              boxShadow: !loading && canCheckInNow ? "0 4px 20px rgba(16,185,129,0.35)" : "none",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {loading ? "⏳ " + t("attendance.loading") : "✓ " + t("attendance.checkinBtn")}
          </button>
        )}

        {isCheckedIn && !isCheckedOut && (
          <button
            onClick={handleCheckOut}
            disabled={loading}
            style={{
              flex: 1, padding: "13px",
              background: loading
                ? "rgba(96,165,250,0.12)"
                : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
              border: "1px solid rgba(96,165,250,0.35)",
              borderRadius: 12, color: loading ? "#60a5fa80" : "#fff",
              fontWeight: 700, fontSize: "0.9rem", cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.65 : 1,
              transition: "all 0.2s",
              boxShadow: !loading ? "0 4px 20px rgba(59,130,246,0.35)" : "none",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {loading ? "⏳ " + t("attendance.loading") : "↩ " + t("attendance.checkoutBtn")}
          </button>
        )}

        {isCheckedOut && (
          <div style={{
            flex: 1, padding: "13px", textAlign: "center",
            background: "rgba(52,211,153,0.1)",
            border: "1px solid rgba(52,211,153,0.25)",
            borderRadius: 12, color: "#34d399", fontWeight: 700, fontSize: "0.9rem",
          }}>
            ✓ {t("attendance.doneBtn")}
          </div>
        )}
      </div>

      {/* ── Notes footer ──────────────────────────────────────── */}
      <div style={{
        borderTop: "1px solid rgba(0,212,255,0.08)",
        padding: "12px 20px",
        background: "rgba(0,0,0,0.2)",
      }}>
        <p style={{ color: "#475569", fontSize: "0.72rem", margin: "0 0 5px", fontWeight: 600, letterSpacing: "0.05em" }}>
          ◈ {t("attendance.notesTitle")}
        </p>
        <ul style={{ margin: 0, paddingLeft: 16, color: "#374151" }}>
          <li style={{ color: "#4b5563", fontSize: "0.7rem", marginBottom: 3 }}>{t("attendance.note1")}</li>
          <li style={{ color: "#4b5563", fontSize: "0.7rem", marginBottom: 3 }}>
            {t("attendance.note2", { radius: Math.round((booking.facility?.geofencingRadius ?? 0.004) * 1000) })}
          </li>
          <li style={{ color: "#4b5563", fontSize: "0.7rem" }}>{t("attendance.note3")}</li>
        </ul>
      </div>
    </div>
  );
}
