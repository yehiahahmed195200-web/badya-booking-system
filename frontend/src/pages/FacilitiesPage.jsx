import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config/api";

const API = API_BASE;
const AVAILABILITY_OPTIONS = [
  { value: true, label: "Available", icon: "✅", color: "#2ecc71" },
  { value: false, label: "Unavailable", icon: "🔒", color: "#e74c3c" },
];

const getAvailabilityConfig = (active) => AVAILABILITY_OPTIONS.find(option => option.value === active) || AVAILABILITY_OPTIONS[1];

export default function FacilitiesPage({ session }) {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editStatus, setEditStatus] = useState({}); // facilityId → { active, reason }
  const [saving, setSaving] = useState({});
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchFacilities = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/facilities`, { headers });
      setFacilities(await res.json());
    } catch (e) {
      setError("Failed to load facilities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFacilities(); }, []);

  const handleStatusChange = (facilityId, field, value) => {
    setEditStatus(prev => ({
      ...prev,
      [facilityId]: { ...prev[facilityId], [field]: value }
    }));
  };

  const applyStatusChange = async (facility) => {
    const edit = editStatus[facility.id];
    if (typeof edit?.active !== "boolean") return;
    setSaving(prev => ({ ...prev, [facility.id]: true }));
    try {
      const res = await fetch(`${API}/api/facilities/${facility.id}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          active: edit.active,
          status: edit.active ? "OPEN" : "CLOSED",
          statusReason: edit.reason || "",
          policy: "CANCEL",
          notifyUsers: true,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      await fetchFacilities();
      setEditStatus(prev => { const n = { ...prev }; delete n[facility.id]; return n; });
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setSaving(prev => ({ ...prev, [facility.id]: false }));
    }
  };

  // Add new facility form state
  const [newFacility, setNewFacility] = useState({
    name: "", category: "Sport", openTime: "08:00", closeTime: "15:00",
    minParticipants: 1, maxParticipants: 10, defaultSlotMins: 60,
  });

  const handleAddFacility = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/facilities`, {
        method: "POST", headers,
        body: JSON.stringify({
          ...newFacility,
          minParticipants: Number(newFacility.minParticipants),
          maxParticipants: Number(newFacility.maxParticipants),
          defaultSlotMins: Number(newFacility.defaultSlotMins),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      setShowAddForm(false);
      fetchFacilities();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  return (
    <section className="dashboard-section panel slide-in" id="facilities-section">

      {/* Sticky Back Bar */}
      <div className="fac-back-bar">
        <button className="fac-back-btn" onClick={() => navigate("/dashboard")}>
          <span className="fac-back-arrow">←</span>
          Back to Admin Dashboard
        </button>
        <div className="fac-breadcrumb">
          <span>Admin Dashboard</span>
          <span className="fac-breadcrumb-sep">›</span>
          <span className="fac-breadcrumb-active">Facility Management</span>
        </div>
      </div>

      <div className="dashboard-head">
        <div>
          <h2>🏟️ Facility Management</h2>
          <p>Control status, schedules, and settings for all courts and halls.</p>
        </div>
        <button className="btn btn-solid glow-effect" onClick={() => setShowAddForm(v => !v)}>
          {showAddForm ? "✕ Cancel" : "+ Add Facility"}
        </button>
      </div>

      {/* Add Facility Form */}
      {showAddForm && (
        <form onSubmit={handleAddFacility} className="add-facility-form panel">
          <h3>New Facility</h3>
          <div className="form-row">
            <label>
              Name
              <input required value={newFacility.name} onChange={e => setNewFacility(p => ({ ...p, name: e.target.value }))} />
            </label>
            <label>
              Category
              <select value={newFacility.category} onChange={e => setNewFacility(p => ({ ...p, category: e.target.value }))}>
                <option>Sport</option>
                <option>PREMIUM</option>
                <option>Fitness</option>
                <option>Pool</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>Open Time<input type="time" value={newFacility.openTime} onChange={e => setNewFacility(p => ({ ...p, openTime: e.target.value }))} /></label>
            <label>Close Time<input type="time" value={newFacility.closeTime} onChange={e => setNewFacility(p => ({ ...p, closeTime: e.target.value }))} /></label>
            <label>Slot (mins)<input type="number" min={15} max={240} value={newFacility.defaultSlotMins} onChange={e => setNewFacility(p => ({ ...p, defaultSlotMins: e.target.value }))} /></label>
          </div>
          <div className="form-row">
            <label>Min Participants<input type="number" min={1} value={newFacility.minParticipants} onChange={e => setNewFacility(p => ({ ...p, minParticipants: e.target.value }))} /></label>
            <label>Max Participants<input type="number" min={1} value={newFacility.maxParticipants} onChange={e => setNewFacility(p => ({ ...p, maxParticipants: e.target.value }))} /></label>
          </div>
          <button type="submit" className="btn btn-solid">Create Facility</button>
        </form>
      )}

      {/* Facilities Table */}
      {loading ? <p>Loading...</p> : error ? <p className="error-banner">{error}</p> : (
        <div className="facilities-table-wrap">
          <table className="facilities-table">
            <thead>
              <tr>
                <th>Facility</th>
                <th>Category</th>
                <th>Hours</th>
                <th>Participants</th>
                <th>Current Status</th>
                <th>Change Status</th>
                <th>Reason</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {facilities.map(f => {
                const edit = editStatus[f.id] || {};
                const isSaving = saving[f.id];
                return (
                  <tr key={f.id} className={!f.active ? "row-inactive" : ""}>
                    <td data-label="Facility"><strong>{f.name}</strong></td>
                    <td data-label="Category"><span className="category-badge">{f.category}</span></td>
                    <td data-label="Hours">{f.openTime} – {f.closeTime}</td>
                    <td data-label="Participants">{f.minParticipants} – {f.maxParticipants}</td>
                    <td data-label="Current Status">
                      <span className="status-pill" style={{ background: getAvailabilityConfig(Boolean(f.active)).color + "22", color: getAvailabilityConfig(Boolean(f.active)).color, border: `1px solid ${getAvailabilityConfig(Boolean(f.active)).color}` }}>
                        {getAvailabilityConfig(Boolean(f.active)).icon} {getAvailabilityConfig(Boolean(f.active)).label}
                      </span>
                    </td>
                    <td data-label="Change Status">
                      <select
                        value={typeof edit.active === "boolean" ? String(edit.active) : String(Boolean(f.active))}
                        onChange={e => handleStatusChange(f.id, "active", e.target.value === "true")}
                        className="status-select"
                      >
                        {AVAILABILITY_OPTIONS.map(option => <option key={String(option.value)} value={String(option.value)}>{option.icon} {option.label}</option>)}
                      </select>
                    </td>
                    <td data-label="Reason">
                      <input
                        placeholder="Reason (optional)"
                        value={edit.reason || ""}
                        onChange={e => handleStatusChange(f.id, "reason", e.target.value)}
                        className="reason-input"
                      />
                    </td>
                    <td data-label="Action">
                      <button
                        type="button"
                        className="btn-approve"
                        disabled={isSaving || ((typeof edit.active !== "boolean") && !edit.reason) || (typeof edit.active === "boolean" && edit.active === Boolean(f.active) && !edit.reason)}
                        onClick={() => applyStatusChange(f)}
                      >
                        {isSaving ? "..." : "Apply"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
