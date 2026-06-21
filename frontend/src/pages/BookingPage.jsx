import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../BookingPage.css";
import { useLanguage } from "../context/LanguageContext";
import { API_BASE } from "../config/api";

const API = API_BASE;

const getFacilityIcon = (name = "") => {
  const n = name.toLowerCase();
  if (n.includes("basket")) return "🏀";
  if (n.includes("football") || n.includes("soccer")) return "⚽";
  if (n.includes("tennis") || n.includes("padel")) return "🎾";
  if (n.includes("swim") || n.includes("pool")) return "🏊";
  if (n.includes("gym") || n.includes("fitness")) return "🏋️";
  if (n.includes("volleyball")) return "🏐";
  return "🏅";
};

const STATUS_COLOR = {
  OPEN: "#10b981",
  AVAILABLE: "#10b981",
  MAINTENANCE: "#f59e0b",
  TOURNAMENT: "#8b5cf6",
  CLOSED: "#ef4444",
  UNAVAILABLE: "#ef4444",
};

const getFacilityState = (facility) => facility?.status || (facility?.active === false ? "UNAVAILABLE" : "AVAILABLE");

const isFacilityBookable = (facility) => {
  if (facility?.active === false) return false;
  if (facility?.status) return facility.status === "OPEN";
  return true;
};

function getMinDate() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export default function BookingPage({ session }) {
  const { language, t } = useLanguage();

  const translateBackendError = useCallback((msg) => {
    if (!msg) return msg;
    if (msg.includes("OVERLAP_DETECTED")) {
      return language === "en"
        ? "You already have another active booking at this time."
        : "أنت حاجز حاجة تانية في نفس الميعاد ده.";
    }
    if (msg.includes("Sport selection is required")) return t("bookingPage.errSportRequired");
    if (msg.includes("Invalid sport selection")) return t("bookingPage.errInvalidSport");
    if (msg.includes("Basketball has exceeded its weekly quota")) return t("bookingPage.errQuotaBasketball");
    if (msg.includes("Volleyball has exceeded its weekly quota")) return t("bookingPage.errQuotaVolleyball");
    if (msg.includes("account is banned")) return t("bookingPage.errBanned");
    if (msg.includes("Insufficient credits")) return t("bookingPage.errCredits");
    if (msg.includes("warning threshold reached")) return t("bookingPage.errAutoBanned");
    if (msg.includes("Facility is deactivated")) return t("bookingPage.errDeactivated");
    if (msg.includes("Participants outside allowed range")) return t("bookingPage.errParticipantsRange");
    if (msg.includes("Booking duration must be between")) return t("bookingPage.errDuration");
    if (msg.includes("Booking start time cannot be in the past")) return t("bookingPage.errPast");
    if (msg.includes("Booking exceeds advance window")) return t("bookingPage.errAdvanceWindow");
    if (msg.includes("Daily booking limit reached")) return t("bookingPage.errDailyLimit");
    if (msg.includes("Booking must fall within facility operating hours")) return t("bookingPage.errOperatingHours");
    if (msg.includes("Back-to-back bookings are disabled")) return t("bookingPage.errBackToBack");
    if (msg.includes("already booked during the requested time slot")) {
      const idx = msg.indexOf("Available times today: ");
      const times = idx !== -1 ? msg.substring(idx + "Available times today: ".length) : "";
      return t("bookingPage.errAlreadyBooked", { times: times || (language === "en" ? "None" : "لا يوجد") });
    }
    return msg;
  }, [t, language]);
  const [facilities, setFacilities]       = useState([]);
  const [loading, setLoading]             = useState(true);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [step, setStep]                   = useState(1);
  const [form, setForm]                   = useState({ date: getMinDate(), time: "09:00", participants: 1, sport: "" });
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]                 = useState(null);
  const [success, setSuccess]             = useState(null);
  const [search, setSearch]               = useState("");
  // FR-2.7 Terms
  const [termsAccepted, setTermsAccepted] = useState(false);
  // FR-2.12 Buddy bookings
  const [buddyInput, setBuddyInput]       = useState("");
  const [buddyIds, setBuddyIds]           = useState([]);
  const [buddyError, setBuddyError]       = useState("");
  const [buddyLoading, setBuddyLoading]   = useState(false);
  const [showMatchmakingPromo, setShowMatchmakingPromo] = useState(false);
  // FR-2.1 Availability
  const [availability, setAvailability]   = useState(null);
  const [availLoading, setAvailLoading]   = useState(false);
  // FR-2.8 Repeat user
  const [repeatInfo, setRepeatInfo]       = useState(null);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/api/facilities?activeOnly=true&active=true`)
      .then(r => r.json()).then(d => {
        const facs = Array.isArray(d) ? d : [];
        setFacilities(facs);
        setLoading(false);

        // Pre-select facility if passed via sessionStorage or query
        const urlParams = new URLSearchParams(window.location.search);
        const facilityId = urlParams.get("facilityId") || sessionStorage.getItem("prefilledFacilityId");
        if (facilityId) {
          const found = facs.find(f => String(f.id) === String(facilityId));
          if (found) {
            setSelectedFacility(found);
            setForm(p => ({
              ...p,
              participants: found.minParticipants || 1,
              sport: found.sports && !found.sports.includes(",") ? found.sports.trim() : ""
            }));
            setStep(2);
          }
          sessionStorage.removeItem("prefilledFacilityId");
        }
      })
      .catch(() => setLoading(false));
  }, []);

  // FR-2.1: fetch availability when facility+date change
  useEffect(() => {
    if (!selectedFacility || !form.date) return;
    setAvailLoading(true);
    fetch(`${API}/api/facilities/${selectedFacility.id}/availability?date=${form.date}`, { headers })
      .then(res => {
        if (!res.ok) throw new Error("Could not load availability");
        return res.json();
      })
      .then(data => {
        setAvailability(data);
        setAvailLoading(false);
      })
      .catch(() => {
        setAvailability(null);
        setAvailLoading(false);
      });
  }, [selectedFacility?.id, form.date]);

  // FR-2.8: check repeat user when facility selected
  const selectFacility = async (f) => {
    setSelectedFacility(f);
    setForm(p => ({
      ...p,
      participants: f.minParticipants || 1,
      sport: f.sports && !f.sports.includes(",") ? f.sports.trim() : ""
    }));
    setError(null);
    setRepeatInfo(null);
    setStep(2);
  };

  // Reset validation and promos on step change
  useEffect(() => {
    setError(null);
    setBuddyError("");
    setShowMatchmakingPromo(false);
  }, [step]);

  // FR-2.12: add buddy with backend validation
  const addBuddy = async () => {
    const id = buddyInput.trim();
    if (!id) return;
    if (buddyIds.includes(id)) {
      setBuddyError("هذا المستخدم مضاف بالفعل / Already added");
      return;
    }

    setBuddyError("");
    setBuddyLoading(true);
    setShowMatchmakingPromo(false);

    try {
      const res = await fetch(`${API}/api/users/student-id/${id}`, { headers });
      if (!res.ok) {
        throw new Error("Student ID not found");
      }
      const data = await res.json();
      // Successfully verified
      setBuddyIds(p => [...p, id]);
      setBuddyInput("");
      setBuddyError("");
    } catch (err) {
      setBuddyError(
        t("bookingPage.buddyAddError")
      );
      setShowMatchmakingPromo(true);
    } finally {
      setBuddyLoading(false);
    }
  };

  // Validate teammate counts and existence on submit details step
  const handleDetailsSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBuddyError(null);
    setShowMatchmakingPromo(false);

    const participantsNum = parseInt(form.participants, 10);
    const requiredBuddies = participantsNum - 1;

    // Check if enough buddy IDs are provided
    if (participantsNum > 1 && buddyIds.length < requiredBuddies) {
      setError(
        t("bookingPage.buddyMissingError", { participants: participantsNum, required: requiredBuddies })
      );
      setShowMatchmakingPromo(true);
      return;
    }

    // Double check all buddy IDs in parallel to make absolutely sure they exist before advancing
    setBuddyLoading(true);
    try {
      const checkPromises = buddyIds.map(id =>
        fetch(`${API}/api/users/student-id/${id}`, { headers })
          .then(res => ({ id, ok: res.ok }))
          .catch(() => ({ id, ok: false }))
      );
      const results = await Promise.all(checkPromises);
      const invalidIds = results.filter(r => !r.ok).map(r => r.id);

      if (invalidIds.length > 0) {
        setError(
          t("bookingPage.buddyInvalidError", { ids: invalidIds.join(", ") })
        );
        setShowMatchmakingPromo(true);
        return;
      }
    } catch (err) {
      setError(language === "en" ? "Error validating Student IDs. Please try again." : "حدث خطأ أثناء التحقق من معرفات الطلاب. يرجى المحاولة مرة أخرى.");
      return;
    } finally {
      setBuddyLoading(false);
    }

    setStep(3);
  };

  const handleSubmit = async (forceOverlap = false) => {
    setError(null);
    setSubmitting(true);
    if (!token) { setError("Session expired. Please log in again."); setSubmitting(false); return; }
    try {
      const startTime = `${form.date}T${form.time}`;
      const participantsNum = parseInt(form.participants, 10);
      if (isNaN(participantsNum) || participantsNum < 1) throw new Error("Invalid number of participants");

      const res = await fetch(`${API}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId: session?.id,
          facilityId: selectedFacility.id,
          startTime,
          participants: participantsNum,
          termsAccepted,
          buddyIds,
          sport: form.sport || undefined,
          forceCancelOverlap: forceOverlap
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.message && data.message.includes("OVERLAP_DETECTED")) {
          const confirmQuestion = language === "en"
            ? "You already have another active booking at this time. If you proceed with this booking, your other booking will be cancelled. Do you want to continue?"
            : "أنت حاجز حاجة تانية في الميعاد ده. لو كملت، الحجز القديم هيتلغي تلقائي. وخلي بالك، لازم تلغيه قبلها بوقت محدد وإلا مش هينفع تلغيه وهينزل عليك إنذار! هل عاوز تكمل؟";
          if (window.confirm(confirmQuestion)) {
            setSubmitting(false);
            await handleSubmit(true);
            return;
          } else {
            throw new Error(data.message);
          }
        }
        throw new Error(data.message || `Server error ${res.status}`);
      }
      setSuccess(data);
      setTimeout(() => navigate("/dashboard"), 3000);
    } catch (err) {
      setError(translateBackendError(err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = facilities.filter(f =>
    f.name?.toLowerCase().includes(search.toLowerCase()) ||
    f.category?.toLowerCase().includes(search.toLowerCase())
  );

  // ── SUCCESS ──────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="bk-shell">
        <div className="bk-success-screen">
          <div className="bk-success-icon">🎉</div>
          <h2>{t("bookingPage.successTitle")}</h2>
          <p>{t("bookingPage.successRecap")} <strong>{selectedFacility?.name}</strong>.</p>
          {success.pointsAwarded && (
            <div className="bk-points-award">
              +{success.pointsAwarded} {t("common.pts")} {success.isOffPeak ? (language === "en" ? "🌙 Off-peak bonus!" : "🌙 مكافأة الأوقات الهادئة!") : ""}
            </div>
          )}
          <p className="bk-success-sub">{t("bookingPage.redirecting")}</p>
          <div className="bk-success-bar"><div className="bk-success-fill" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bk-shell">
      {/* Header */}
      <div className="bk-header">
        <button className="bk-back-btn" onClick={() => step === 1 ? navigate("/dashboard") : setStep(step - 1)}>
          ← {step === 1 ? (language === "en" ? "Back to Dashboard" : "العودة للوحة التحكم") : t("common.back")}
        </button>
        <div className="bk-header-title">
          <h1>{t("bookingPage.title")}</h1>
          <p>{t("bookingPage.subtitle")}</p>
        </div>
        <div className="bk-steps">
          {[t("bookingPage.step1"), t("bookingPage.step2"), t("bookingPage.step3")].map((label, i) => (
            <div key={i} className={`bk-step ${step > i + 1 ? "done" : ""} ${step === i + 1 ? "active" : ""}`}>
              <div className="bk-step-dot">{step > i + 1 ? "✓" : i + 1}</div>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bk-body">

        {/* ── STEP 1: FACILITY PICKER ── */}
        {step === 1 && (
          <div className="bk-step1">
            <div className="bk-search-wrap">
              <span className="bk-search-icon">🔍</span>
              <input className="bk-search" placeholder={t("bookingPage.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {loading ? (
              <div className="bk-loading"><div className="bk-spinner" /><p>{t("common.loading")}</p></div>
            ) : (
              <div className="bk-facility-grid">
                {filtered.length === 0 && <p className="bk-empty">{t("bookingPage.noFacilities")}</p>}
                {filtered.map(f => (
                  <button key={f.id} className={`bk-facility-card ${selectedFacility?.id === f.id ? "selected" : ""}`}
                    onClick={() => selectFacility(f)} disabled={!isFacilityBookable(f)}>
                    <div className="bk-facility-icon">{getFacilityIcon(f.name)}</div>
                    <div className="bk-facility-info">
                      <h3>{f.name}</h3>
                      <span className="bk-cat-badge">{f.category}</span>
                      <div className="bk-facility-meta">
                        <span>🕐 {f.openTime} – {f.closeTime}</span>
                        <span>👥 {f.minParticipants}–{f.maxParticipants}</span>
                        <span>⏱ {f.defaultSlotMins} {language === "en" ? "min" : "دقيقة"}</span>
                      </div>
                    </div>
                    <div className="bk-facility-status">
                      <span className="bk-status-dot" style={{ background: STATUS_COLOR[getFacilityState(f)] || "#10b981" }} />
                      <span style={{ color: STATUS_COLOR[getFacilityState(f)] || "#10b981", fontWeight: 700, fontSize: "0.8rem" }}>
                        {getFacilityState(f)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: DETAILS ── */}
        {step === 2 && selectedFacility && (
          <div className="bk-step2">
            {/* Facility recap */}
            <div className="bk-selected-recap">
              <span className="bk-recap-icon">{getFacilityIcon(selectedFacility.name)}</span>
              <div>
                <h3>{selectedFacility.name}</h3>
                <span className="bk-cat-badge">{selectedFacility.category}</span>
              </div>
              {/* FR-2.8 Repeat user */}
              {repeatInfo?.isRepeatUser && (
                <div className="bk-repeat-badge">🔄 {language === "en" ? `You've been here ${repeatInfo.previousBookings}× before` : `لقد قمت بزيارة هذا المكان ${repeatInfo.previousBookings} مرات من قبل`}</div>
              )}
              <button className="bk-change-btn" onClick={() => setStep(1)}>{t("bookingPage.changeBtn")}</button>
            </div>

            <form onSubmit={handleDetailsSubmit} className="bk-details-form">
              {error && <div className="bk-error"><span>⚠️</span> {error}</div>}
              {showMatchmakingPromo && (
                <div className="bk-matchmaking-promo" style={{
                  background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
                  border: "1px solid #bfdbfe",
                  borderRadius: "14px",
                  padding: "20px",
                  marginTop: "-10px",
                  marginBottom: "20px",
                  boxShadow: "0 4px 12px rgba(59, 130, 246, 0.08)",
                  direction: language === "en" ? "ltr" : "rtl",
                  textAlign: language === "en" ? "left" : "right"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "1.4rem" }}>🎯</span>
                    <h4 style={{ margin: 0, color: "#1e3a8a", fontSize: "1.05rem", fontWeight: "700" }}>
                      {t("bookingPage.matchmakingPromoTitle")}
                    </h4>
                  </div>
                  <p style={{ margin: "0 0 14px 0", color: "#1e40af", fontSize: "0.88rem", lineHeight: "1.5" }}>
                    {t("bookingPage.matchmakingPromoDesc")}
                  </p>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => navigate("/dashboard?tab=matchmaking")}
                      style={{
                        background: "#2563eb",
                        color: "#fff",
                        border: "none",
                        borderRadius: "10px",
                        padding: "10px 18px",
                        fontSize: "0.88rem",
                        fontWeight: "700",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        boxShadow: "0 2px 6px rgba(37, 99, 235, 0.2)"
                      }}
                      onMouseOver={(e) => e.target.style.background = "#1d4ed8"}
                      onMouseOut={(e) => e.target.style.background = "#2563eb"}
                    >
                      {t("bookingPage.matchmakingGoBtn")}
                    </button>
                  </div>
                </div>
              )}

              <div className="bk-form-row">
                <div className="bk-field">
                  <label>📅 {language === "en" ? "Date" : "التاريخ"}</label>
                  <input type="date" required min={getMinDate()} value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="bk-input" />
                </div>
                <div className="bk-field">
                  <label>🕐 {language === "en" ? "Start Time" : "وقت البدء"}</label>
                  <input type="time" required value={form.time} min={selectedFacility.openTime} max={selectedFacility.closeTime}
                    onChange={e => setForm(p => ({ ...p, time: e.target.value }))} className="bk-input" />
                </div>
                <div className="bk-field">
                  <label>👥 {t("bookingPage.participants")}</label>
                  <input type="number" required min={selectedFacility.minParticipants} max={selectedFacility.maxParticipants}
                    value={form.participants} onChange={e => setForm(p => ({ ...p, participants: e.target.value }))} className="bk-input" />
                  <small className="bk-hint">{t("bookingPage.participantsHint")}: {selectedFacility.minParticipants}–{selectedFacility.maxParticipants}</small>
                </div>
              </div>

              {selectedFacility.sports && selectedFacility.sports.includes(",") && (
                <div className="bk-field" style={{ marginTop: "1rem", marginBottom: "1rem" }}>
                  <label>🏀 {t("bookingPage.sportSelect")}</label>
                  <select
                    required
                    value={form.sport}
                    onChange={e => setForm(p => ({ ...p, sport: e.target.value }))}
                    className="bk-input"
                  >
                    <option value="">{t("bookingPage.sportChoose")}</option>
                    {selectedFacility.sports.split(",").map(s => (
                      <option key={s.trim()} value={s.trim()}>{s.trim()}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* FR-2.1 Time Slot Availability Grid */}
              {form.date && (
                <div className="bk-avail-section">
                  <h4 className="bk-avail-title">📊 {t("bookingPage.slotAvailability")} — {form.date}</h4>
                  {availLoading ? (
                    <div className="bk-avail-loading"><div className="bk-spinner" style={{ width: 20, height: 20 }} /> {t("common.loading")}</div>
                  ) : availability?.slots ? (
                    <div className="bk-slot-grid">
                      {availability.slots.map(slot => (
                        <button key={slot.time} type="button"
                          className={`bk-slot ${slot.available ? "free" : "taken"} ${form.time === slot.time ? "selected" : ""}`}
                          onClick={() => slot.available && setForm(p => ({ ...p, time: slot.time }))}
                          disabled={!slot.available}
                          title={slot.available ? "Available" : "Booked"}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="bk-slot-legend">
                    <span className="bk-legend free">{language === "en" ? "Free" : "متاح"}</span>
                    <span className="bk-legend taken">{language === "en" ? "Booked" : "محجوز"}</span>
                    <span className="bk-legend selected">{language === "en" ? "Selected" : "محدد"}</span>
                  </div>
                </div>
              )}

              {/* FR-2.12 Buddy Booking */}
              <div className="bk-buddy-section">
                <h4 className="bk-avail-title">👫 {t("bookingPage.buddyBooking")} <span className="bk-optional">{language === "en" ? "optional" : "اختياري"}</span></h4>
                <p className="bk-buddy-desc">{t("bookingPage.buddyBookingSub")}</p>
                <div className="bk-buddy-row">
                  <input className="bk-input" placeholder={t("bookingPage.buddyInputPlaceholder")}
                    value={buddyInput} onChange={e => setBuddyInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addBuddy())}
                    style={{ flex: 1 }}
                    disabled={buddyLoading}
                  />
                  <button type="button" className="bk-buddy-add-btn" onClick={addBuddy} disabled={buddyLoading}>
                    {buddyLoading ? t("common.loading") : t("bookingPage.buddyAddBtn")}
                  </button>
                </div>
                {buddyError && <p className="bk-buddy-error">{buddyError}</p>}
                
                {showMatchmakingPromo && (
                  <div className="bk-matchmaking-promo" style={{
                    background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
                    border: "1px solid #bfdbfe",
                    borderRadius: "14px",
                    padding: "16px 20px",
                    marginTop: "12px",
                    marginBottom: "12px",
                    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.08)",
                    direction: language === "en" ? "ltr" : "rtl",
                    textAlign: language === "en" ? "left" : "right"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                      <span style={{ fontSize: "1.4rem" }}>🎯</span>
                      <h4 style={{ margin: 0, color: "#1e3a8a", fontSize: "1.02rem", fontWeight: "700" }}>
                        {t("bookingPage.matchmakingPromoTitle")}
                      </h4>
                    </div>
                    <p style={{ margin: "0 0 14px 0", color: "#1e40af", fontSize: "0.85rem", lineHeight: "1.5" }}>
                      {t("bookingPage.matchmakingPromoDesc")}
                    </p>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => navigate("/dashboard?tab=matchmaking")}
                        style={{
                          background: "#2563eb",
                          color: "#fff",
                          border: "none",
                          borderRadius: "10px",
                          padding: "8px 16px",
                          fontSize: "0.85rem",
                          fontWeight: "700",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          boxShadow: "0 2px 6px rgba(37, 99, 235, 0.2)"
                        }}
                        onMouseOver={(e) => e.target.style.background = "#1d4ed8"}
                        onMouseOut={(e) => e.target.style.background = "#2563eb"}
                      >
                        {t("bookingPage.matchmakingGoBtn")}
                      </button>
                    </div>
                  </div>
                )}

                {buddyIds.length > 0 && (
                  <div className="bk-buddy-chips">
                    {buddyIds.map(id => (
                      <span key={id} className="bk-buddy-chip">
                        {id}
                        <button type="button" onClick={() => setBuddyIds(p => p.filter(x => x !== id))}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="bk-info-box">
                <span>ℹ️</span>
                <div><strong>{language === "en" ? "Session duration:" : "مدة الجلسة:"}</strong> {selectedFacility.defaultSlotMins} {language === "en" ? "min" : "دقيقة"} · <strong>{language === "en" ? "Hours:" : "الساعات:"}</strong> {selectedFacility.openTime} – {selectedFacility.closeTime}</div>
              </div>

              <button type="submit" className="bk-submit-btn">{t("bookingPage.reviewBtn")}</button>
            </form>
          </div>
        )}

        {/* ── STEP 3: CONFIRM ── */}
        {step === 3 && selectedFacility && (
          <div className="bk-step3">
            <h2 className="bk-confirm-title">{t("bookingPage.confirmTitle")}</h2>
            <div className="bk-confirm-card">
              <div className="bk-confirm-icon">{getFacilityIcon(selectedFacility.name)}</div>
              <div className="bk-confirm-details">
                <div className="bk-confirm-row"><span>{t("bookingPage.facilityLabel")}</span><strong>{selectedFacility.name}</strong></div>
                <div className="bk-confirm-row"><span>{t("bookingPage.categoryLabel")}</span><strong>{selectedFacility.category}</strong></div>
                <div className="bk-confirm-row">
                  <span>{t("bookingPage.dateTimeLabel")}</span>
                  <strong>{new Date(`${form.date}T${form.time}`).toLocaleString(language === "en" ? "en-GB" : "ar-EG", { dateStyle: "full", timeStyle: "short" })}</strong>
                </div>
                <div className="bk-confirm-row"><span>{t("bookingPage.durationLabel")}</span><strong>{selectedFacility.defaultSlotMins} {language === "en" ? "minutes" : "دقائق"}</strong></div>
                <div className="bk-confirm-row"><span>{t("bookingPage.participantsLabel")}</span><strong>{form.participants}</strong></div>
                <div className="bk-confirm-row"><span>{t("bookingPage.bookedByLabel")}</span><strong>{session?.fullName}</strong></div>
                {buddyIds.length > 0 && (
                  <div className="bk-confirm-row"><span>{t("bookingPage.buddiesLabel")}</span><strong>{buddyIds.join(", ")}</strong></div>
                )}
                {form.sport && (
                  <div className="bk-confirm-row"><span>{t("bookingPage.sportLabel")}</span><strong>{form.sport}</strong></div>
                )}
                <div className="bk-confirm-row">
                  <span>{t("bookingPage.pointsEarnLabel")}</span>
                  <strong style={{ color: "#10b981" }}>
                    {new Date(`${form.date}T${form.time}`).getHours() < 10 ||
                     new Date(`${form.date}T${form.time}`).getHours() >= 19
                      ? (language === "en" ? "+25 pts 🌙 Off-peak bonus!" : "+25 نقطة 🌙 مكافأة الأوقات الهادئة!") 
                      : (language === "en" ? "+10 pts" : "+10 نقاط")}
                  </strong>
                </div>
              </div>
            </div>

            <div className="bk-rules-notice">
              <strong>📋 {t("bookingPage.rulesTitle")}:</strong>
              <ul>
                <li>{t("bookingPage.rule1")}</li>
                <li>{t("bookingPage.rule2")}</li>
                <li>{t("bookingPage.rule3")}</li>
                <li>{t("bookingPage.rule4")}</li>
              </ul>
            </div>

            {/* FR-2.7 Terms & Conditions */}
            <label className="bk-terms-label">
              <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} />
              <span>{t("bookingPage.termsLabel")}</span>
            </label>

            {error && <div className="bk-error"><span>⚠️</span> {error}</div>}

            <div className="bk-confirm-actions">
              <button className="bk-back-link" onClick={() => setStep(2)}>{t("bookingPage.editDetailsBtn")}</button>
              <button className="bk-submit-btn" onClick={handleSubmit} disabled={submitting || !termsAccepted}>
                {submitting ? t("bookingPage.submitting") : t("bookingPage.confirmSubmitBtn")}
              </button>
            </div>
            {!termsAccepted && (
              <p style={{ textAlign: "center", color: "#9ab0c4", fontSize: "0.82rem", marginTop: 8 }}>
                {t("bookingPage.termsRequired")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
