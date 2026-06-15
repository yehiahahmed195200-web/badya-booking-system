import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../BookingPage.css";
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
    // Java backend does not expose this endpoint yet; keep UI functional without 404 spam.
    setAvailability(null);
    setAvailLoading(false);
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

  // FR-2.12: add buddy
  const addBuddy = () => {
    const id = buddyInput.trim();
    if (!id) return;
    if (buddyIds.includes(id)) { setBuddyError("Already added"); return; }
    setBuddyIds(p => [...p, id]);
    setBuddyInput("");
    setBuddyError("");
  };

  const handleSubmit = async () => {
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Server error ${res.status}`);
      setSuccess(data);
      setTimeout(() => navigate("/dashboard"), 3000);
    } catch (err) {
      setError(err.message);
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
          <h2>Booking Submitted!</h2>
          <p>Your reservation at <strong>{selectedFacility?.name}</strong> has been submitted.</p>
          {success.pointsAwarded && (
            <div className="bk-points-award">
              +{success.pointsAwarded} pts {success.isOffPeak ? "🌙 Off-peak bonus!" : ""}
            </div>
          )}
          <p className="bk-success-sub">Redirecting to your dashboard…</p>
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
          ← {step === 1 ? "Back to Dashboard" : "Back"}
        </button>
        <div className="bk-header-title">
          <h1>Reserve a Facility</h1>
          <p>Book your spot in advance — reservations require at least 1 hour notice</p>
        </div>
        <div className="bk-steps">
          {["Choose Facility", "Set Details", "Confirm"].map((label, i) => (
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
              <input className="bk-search" placeholder="Search courts, gyms, pools…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {loading ? (
              <div className="bk-loading"><div className="bk-spinner" /><p>Loading…</p></div>
            ) : (
              <div className="bk-facility-grid">
                {filtered.length === 0 && <p className="bk-empty">No facilities found.</p>}
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
                        <span>⏱ {f.defaultSlotMins} min</span>
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
                <div className="bk-repeat-badge">🔄 You've been here {repeatInfo.previousBookings}× before</div>
              )}
              <button className="bk-change-btn" onClick={() => setStep(1)}>Change ↩</button>
            </div>

            <form onSubmit={e => { e.preventDefault(); setStep(3); }} className="bk-details-form">
              {error && <div className="bk-error"><span>⚠️</span> {error}</div>}

              <div className="bk-form-row">
                <div className="bk-field">
                  <label>📅 Date</label>
                  <input type="date" required min={getMinDate()} value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="bk-input" />
                </div>
                <div className="bk-field">
                  <label>🕐 Start Time</label>
                  <input type="time" required value={form.time} min={selectedFacility.openTime} max={selectedFacility.closeTime}
                    onChange={e => setForm(p => ({ ...p, time: e.target.value }))} className="bk-input" />
                </div>
                <div className="bk-field">
                  <label>👥 Participants</label>
                  <input type="number" required min={selectedFacility.minParticipants} max={selectedFacility.maxParticipants}
                    value={form.participants} onChange={e => setForm(p => ({ ...p, participants: e.target.value }))} className="bk-input" />
                  <small className="bk-hint">Range: {selectedFacility.minParticipants}–{selectedFacility.maxParticipants}</small>
                </div>
              </div>

              {selectedFacility.sports && selectedFacility.sports.includes(",") && (
                <div className="bk-field" style={{ marginTop: "1rem", marginBottom: "1rem" }}>
                  <label>🏀 Select Sport</label>
                  <select
                    required
                    value={form.sport}
                    onChange={e => setForm(p => ({ ...p, sport: e.target.value }))}
                    className="bk-input"
                  >
                    <option value="">-- Choose sport (Basketball or Volleyball) --</option>
                    {selectedFacility.sports.split(",").map(s => (
                      <option key={s.trim()} value={s.trim()}>{s.trim()}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* FR-2.1 Time Slot Availability Grid */}
              {form.date && (
                <div className="bk-avail-section">
                  <h4 className="bk-avail-title">📊 Slot Availability — {form.date}</h4>
                  {availLoading ? (
                    <div className="bk-avail-loading"><div className="bk-spinner" style={{ width: 20, height: 20 }} /> Checking…</div>
                  ) : availability?.slots ? (
                    <div className="bk-slot-grid">
                      {availability.slots.map(slot => (
                        <button key={slot.time} type="button"
                          className={`bk-slot ${slot.available ? "free" : "taken"} ${form.time === slot.time ? "selected" : ""}`}
                          onClick={() => slot.available && setForm(p => ({ ...p, time: slot.time }))}
                          disabled={!slot.available}
                          title={slot.available ? "Available — click to select" : "Already booked"}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="bk-slot-legend">
                    <span className="bk-legend free">Free</span>
                    <span className="bk-legend taken">Booked</span>
                    <span className="bk-legend selected">Selected</span>
                  </div>
                </div>
              )}

              {/* FR-2.12 Buddy Booking */}
              <div className="bk-buddy-section">
                <h4 className="bk-avail-title">👫 Buddy Booking <span className="bk-optional">optional</span></h4>
                <p className="bk-buddy-desc">Add teammate Student IDs — they'll be notified about this booking.</p>
                <div className="bk-buddy-row">
                  <input className="bk-input" placeholder="Enter Student ID (e.g. S20210001)"
                    value={buddyInput} onChange={e => setBuddyInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addBuddy())}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="bk-buddy-add-btn" onClick={addBuddy}>+ Add</button>
                </div>
                {buddyError && <p className="bk-buddy-error">{buddyError}</p>}
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
                <div><strong>Session duration:</strong> {selectedFacility.defaultSlotMins} min · <strong>Hours:</strong> {selectedFacility.openTime} – {selectedFacility.closeTime}</div>
              </div>

              <button type="submit" className="bk-submit-btn">Review Booking →</button>
            </form>
          </div>
        )}

        {/* ── STEP 3: CONFIRM ── */}
        {step === 3 && selectedFacility && (
          <div className="bk-step3">
            <h2 className="bk-confirm-title">Confirm Your Reservation</h2>
            <div className="bk-confirm-card">
              <div className="bk-confirm-icon">{getFacilityIcon(selectedFacility.name)}</div>
              <div className="bk-confirm-details">
                <div className="bk-confirm-row"><span>Facility</span><strong>{selectedFacility.name}</strong></div>
                <div className="bk-confirm-row"><span>Category</span><strong>{selectedFacility.category}</strong></div>
                <div className="bk-confirm-row">
                  <span>Date & Time</span>
                  <strong>{new Date(`${form.date}T${form.time}`).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" })}</strong>
                </div>
                <div className="bk-confirm-row"><span>Duration</span><strong>{selectedFacility.defaultSlotMins} minutes</strong></div>
                <div className="bk-confirm-row"><span>Participants</span><strong>{form.participants}</strong></div>
                <div className="bk-confirm-row"><span>Booked by</span><strong>{session?.fullName}</strong></div>
                {buddyIds.length > 0 && (
                  <div className="bk-confirm-row"><span>Buddies</span><strong>{buddyIds.join(", ")}</strong></div>
                )}
                {form.sport && (
                  <div className="bk-confirm-row"><span>Sport</span><strong>{form.sport}</strong></div>
                )}
                <div className="bk-confirm-row">
                  <span>Points to earn</span>
                  <strong style={{ color: "#10b981" }}>
                    {new Date(`${form.date}T${form.time}`).getHours() < 10 ||
                     new Date(`${form.date}T${form.time}`).getHours() >= 19
                      ? "+25 pts 🌙 Off-peak bonus!" : "+10 pts"}
                  </strong>
                </div>
              </div>
            </div>

            <div className="bk-rules-notice">
              <strong>📋 Booking Rules:</strong>
              <ul>
                <li>Reservations must be made at least 1 hour in advance.</li>
                <li>Cancellations must be requested at least 24 hours before the slot.</li>
                <li>This booking will be reviewed by an admin if required.</li>
                <li>Earn <strong>+25 pts</strong> for off-peak bookings (before 10:00 or after 19:00).</li>
              </ul>
            </div>

            {/* FR-2.7 Terms & Conditions */}
            <label className="bk-terms-label">
              <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} />
              <span>I have read and agree to the <strong>facility terms and conditions</strong> and the cancellation policy.</span>
            </label>

            {error && <div className="bk-error"><span>⚠️</span> {error}</div>}

            <div className="bk-confirm-actions">
              <button className="bk-back-link" onClick={() => setStep(2)}>← Edit Details</button>
              <button className="bk-submit-btn" onClick={handleSubmit} disabled={submitting || !termsAccepted}>
                {submitting ? "Submitting…" : "✓ Confirm & Submit"}
              </button>
            </div>
            {!termsAccepted && (
              <p style={{ textAlign: "center", color: "#9ab0c4", fontSize: "0.82rem", marginTop: 8 }}>
                Please accept the terms and conditions to proceed.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
