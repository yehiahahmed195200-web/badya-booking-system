import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./StudentDashboard.css";
import { API_BASE } from "../config/api";
import AttendanceCard from "../components/AttendanceCard";
import NotificationBell from "../components/NotificationBell";
import { useLanguage } from "../context/LanguageContext";

const API = API_BASE;
const CHATBOT_URL = import.meta.env.VITE_CHATBOT_URL || "http://localhost:3333";

const STATUS_CONFIG = {
  CONFIRMED: { label: "Confirmed", color: "#10b981", bg: "#d1fae5", icon: "✅" },
  PENDING: { label: "Pending", color: "#f59e0b", bg: "#fef3c7", icon: "⏳" },
  CONFLICT: { label: "Conflict", color: "#ef4444", bg: "#fee2e2", icon: "⚠️" },
  APPROVED: { label: "Approved", color: "#3b82f6", bg: "#dbeafe", icon: "👍" },
  REJECTED: { label: "Rejected", color: "#ef4444", bg: "#fee2e2", icon: "❌" },
  CANCELLED: { label: "Cancelled", color: "#6b7280", bg: "#f3f4f6", icon: "🚫" },
  COMPLETED: { label: "Completed", color: "#8b5cf6", bg: "#ede9fe", icon: "🏁" },
};

const FACILITY_ICONS = (name = "") => {
  const n = name.toLowerCase();
  if (n.includes("basket")) return "🏀";
  if (n.includes("football") || n.includes("soccer")) return "⚽";
  if (n.includes("tennis") || n.includes("padel")) return "🎾";
  if (n.includes("swim") || n.includes("pool")) return "🏊";
  if (n.includes("gym") || n.includes("fitness")) return "🏋️";
  if (n.includes("volleyball")) return "🏐";
  return "🏅";
};

function StatCard({ icon, value, label, sub, color = "#1cb2bf", warn = false }) {
  return (
    <div className="sd-stat-card" style={{ borderTop: `3px solid ${warn && value > 0 ? "#ef4444" : color}` }}>
      <div className="sd-stat-icon" style={{ background: (warn && value > 0 ? "#ef4444" : color) + "18", color: warn && value > 0 ? "#ef4444" : color }}>
        {icon}
      </div>
      <div>
        <div className="sd-stat-value" style={{ color: warn && value > 0 ? "#ef4444" : undefined }}>{value}</div>
        <div className="sd-stat-label">{label}</div>
        {sub && <div className="sd-stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

function BookingCard({ booking, onCancel, onReschedule, onFeedback }) {
  const { language, t } = useLanguage();
  const locale = language === "ar" ? "ar-EG" : "en-GB";
  const displayStatus = booking.conflictId && booking.status === "PENDING" ? "CONFLICT" : booking.status;
  const cfg = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.PENDING;
  const start = new Date(booking.startTime);
  const isUpcoming = start > new Date() && ["CONFIRMED", "APPROVED", "PENDING", "CONFLICT"].includes(displayStatus);
  const statusKey = `status${displayStatus.charAt(0) + displayStatus.slice(1).toLowerCase()}`;
  const translatedLabel = t(`studentDashboard.${statusKey}`) || cfg.label;

  return (
    <div className={`sd-booking-card ${isUpcoming ? "upcoming" : ""}`}>
      <div className="sd-booking-icon">{FACILITY_ICONS(booking.facility?.name)}</div>
      <div className="sd-booking-main">
        <div className="sd-booking-name">{booking.facility?.name || "Facility"}</div>
        <div className="sd-booking-meta">
          <span>📅 {start.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })}</span>
          <span>🕐 {start.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</span>
          <span>👥 {t("studentDashboard.participantsCount", { count: booking.participants })}</span>
        </div>
        {booking.rejectionReason && (
          <div className="sd-rejection-reason">{t("studentDashboard.rejectionReasonLabel", { reason: booking.rejectionReason })}</div>
        )}
        {displayStatus === "CONFLICT" && (
          <div className="sd-rejection-reason">{t("studentDashboard.conflictDetectedAwaitingAdmin")}</div>
        )}
      </div>
      <div className="sd-booking-right">
        <span className="sd-status-badge" style={{ background: cfg.bg, color: cfg.color }}>
          {cfg.icon} {translatedLabel}
        </span>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          {isUpcoming && (<>
            <button className="sd-cancel-btn" onClick={() => onCancel(booking.id)}>{t("studentDashboard.cancelBtn")}</button>
            <button className="sd-reschedule-btn" onClick={() => onReschedule && onReschedule(booking)}>{t("studentDashboard.rescheduleBtn")}</button>
          </>)}
          {booking.status === "COMPLETED" && onFeedback && (
            <button className="sd-feedback-btn" onClick={() => onFeedback(booking.facilityId)}>{t("studentDashboard.feedbackBtn")}</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StudentDashboard({ session, onLogout, toggleNotifications }) {
  const { language, t } = useLanguage();
  const locale = language === "ar" ? "ar-EG" : "en-GB";
  const [bookings, setBookings] = useState([]);
  const [userPoints, setUserPoints] = useState(session?.points || 0);
  const [userWarnings, setUserWarnings] = useState(session?.warnings || 0);
  const [userCredits, setUserCredits] = useState(session?.credits || 10);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "bookings";
  });
  const [cancellingId, setCancellingId] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [fbFacility, setFbFacility] = useState("");
  const [fbBookingId, setFbBookingId] = useState("");
  const [fbConflictId, setFbConflictId] = useState("");
  const [fbRating, setFbRating] = useState(5);
  const [fbComment, setFbComment] = useState("");
  const [fbLoading, setFbLoading] = useState(false);
  const [fbSuccess, setFbSuccess] = useState("");
  const [fbError, setFbError] = useState("");
  const [facilities, setFacilities] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [fairnessData, setFairnessData] = useState(null);
  const [fairnessLoading, setFairnessLoading] = useState(false);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [medLoading, setMedLoading] = useState(false);
  const [showUploadMedical, setShowUploadMedical] = useState(false);
  const [medForm, setMedForm] = useState({ documentName: "", description: "", documentUrl: "" });
  const [medSuccess, setMedSuccess] = useState("");
  const [medError, setMedError] = useState("");
  const [medUploading, setMedUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getMinDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  };

  const [matchmakingOptions, setMatchmakingOptions] = useState([]);
  const [myQueues, setMyQueues] = useState([]);
  const [myMatches, setMyMatches] = useState([]);
  const [matchmakingLoading, setMatchmakingLoading] = useState(false);
  const [lfgForm, setLfgForm] = useState({ optionId: "", date: "", timeSlot: "09:00" });
  const [lfgLoading, setLfgLoading] = useState(false);
  const [lfgError, setLfgError] = useState("");
  const [lfgSuccess, setLfgSuccess] = useState("");

  // Initialize date on mount
  useEffect(() => {
    setLfgForm(p => ({ ...p, date: getMinDate() }));
  }, []);

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const fetchMatchmakingData = async () => {
    setMatchmakingLoading(true);
    try {
      const [optRes, qRes, mRes] = await Promise.all([
        fetch(`${API}/api/matchmaking/options`, { headers }),
        fetch(`${API}/api/matchmaking/my-queues`, { headers }),
        fetch(`${API}/api/matchmaking/my-matches`, { headers })
      ]);
      if (optRes.ok) setMatchmakingOptions(await optRes.json());
      if (qRes.ok) setMyQueues(await qRes.json());
      if (mRes.ok) setMyMatches(await mRes.json());
    } catch (e) {
      console.error("Error fetching matchmaking data:", e);
    } finally {
      setMatchmakingLoading(false);
    }
  };

  const handleJoinQueue = async (e) => {
    e.preventDefault();
    setLfgLoading(true);
    setLfgError("");
    setLfgSuccess("");
    try {
      const [facIdStr, sportId] = lfgForm.optionId.split("-");
      const facilityId = parseInt(facIdStr);
      const opt = matchmakingOptions.find(o => o.facilityId === facilityId && o.sportId === sportId);
      if (!opt) throw new Error("Please select a sport.");

      const res = await fetch(`${API}/api/matchmaking/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          sportId: opt.sportId,
          facilityId: opt.facilityId,
          date: lfgForm.date,
          timeSlot: lfgForm.timeSlot
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to join queue.");
      
      setLfgSuccess("Successfully joined the queue!");
      await fetchMatchmakingData();
      await fetchData(); // refresh bookings/dashboard stats
    } catch (err) {
      setLfgError(err.message);
    } finally {
      setLfgLoading(false);
    }
  };

  const handleLeaveQueue = async (sportId, date, timeSlot) => {
    setLfgLoading(true);
    setLfgError("");
    setLfgSuccess("");
    try {
      const res = await fetch(`${API}/api/matchmaking/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ sportId, date, timeSlot })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to leave queue.");
      
      setLfgSuccess("Left queue successfully.");
      await fetchMatchmakingData();
    } catch (err) {
      setLfgError(err.message);
    } finally {
      setLfgLoading(false);
    }
  };
 
  const fetchData = async () => {
    try {
      const [bRes, fRes, uRes] = await Promise.all([
        fetch(`${API}/api/bookings`, { headers }),
        fetch(`${API}/api/facilities`, { headers }),
        fetch(`${API}/api/users/${session.id}`, { headers }),
      ]);
      if (bRes.ok) setBookings(await bRes.json());
      if (fRes.ok) setFacilities(await fRes.json());
      if (uRes.ok) {
        const uData = await uRes.json();
        setUserPoints(uData.earnedPoints || 0);
        setUserWarnings(uData.warnings || 0);
        setUserCredits(uData.credits != null ? uData.credits : 10);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchFairnessData = async () => {
    setFairnessLoading(true);
    try {
      const res = await fetch(`${API}/api/analytics/fairness`, { headers });
      if (res.ok) {
        const data = await res.json();
        setFairnessData(data);
      }
    } catch (e) {
      console.error("Error fetching fairness data:", e);
    } finally {
      setFairnessLoading(false);
    }
  };

  const fetchMedicalHistory = async () => {
    setMedLoading(true);
    try {
      const res = await fetch(`${API}/api/medical-records/student/${session.id}`, { headers });
      if (res.ok) {
        setMedicalRecords(await res.json());
      }
    } catch (e) {
      console.error("Error fetching medical records:", e);
    } finally {
      setMedLoading(false);
    }
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    setSelectedFile(file);
    setMedForm(p => ({
      ...p,
      documentName: file.name,
      documentUrl: `/uploads/${Date.now()}_${file.name}`
    }));
  };

  const handleUploadMedical = async (e) => {
    e.preventDefault();
    if (!selectedFile && !medForm.documentName) {
      setMedError("Please select a file to upload.");
      return;
    }
    setMedUploading(true);
    setMedError("");
    setMedSuccess("");

    if (selectedFile) {
      // Simulate real-time progress bar animation
      for (let p = 0; p <= 100; p += 10) {
        setUploadProgress(p);
        await new Promise(resolve => setTimeout(resolve, 80));
      }
    }

    try {
      const res = await fetch(`${API}/api/medical-records/student/${session.id}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          documentName: medForm.documentName,
          description: medForm.description,
          documentUrl: medForm.documentUrl || `/uploads/${medForm.documentName}`
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit clearance report.");
      setMedSuccess(t("studentDashboard.uploadSuccessMsg"));
      setMedForm({ documentName: "", description: "", documentUrl: "" });
      setSelectedFile(null);
      setUploadProgress(0);
      await fetchMedicalHistory();
      setTimeout(() => { setShowUploadMedical(false); setMedSuccess(""); }, 2000);
    } catch (err) {
      setMedError(err.message);
      setUploadProgress(0);
    } finally {
      setMedUploading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get("tab");
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  useEffect(() => {
    if (activeTab === "fairness") {
      fetchFairnessData();
    } else if (activeTab === "medical") {
      fetchMedicalHistory();
    } else if (activeTab === "matchmaking") {
      fetchMatchmakingData();
    }
  }, [activeTab]);

  // Mobile menu side-effects
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "auto";
    return () => { document.body.style.overflow = "auto"; };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    window.history.pushState({ menuOpen: true }, "");
    const handlePopState = () => setIsMobileMenuOpen(false);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (window.history.state?.menuOpen) {
        window.history.back();
      }
    };
  }, [isMobileMenuOpen]);

  const handleCancel = async (id) => {
    if (!window.confirm(t("studentDashboard.cancelConfirmQuestion"))) return;
    setCancellingId(id);
    try {
      const res = await fetch(`${API}/api/bookings/${id}/cancel`, { method: "PATCH", headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Cancellation failed");
      await fetchData();
    } catch (err) {
      alert(err.message);
    } finally { setCancellingId(null); }
  };

  const handleReschedule = (booking) => {
    sessionStorage.setItem("rescheduleBooking", JSON.stringify({ id: booking.id, facilityId: booking.facilityId }));
    navigate("/book");
  };

  const submitFeedback = async (e) => {
    e.preventDefault();
    setFbLoading(true); setFbError(""); setFbSuccess("");
    try {
      let res, data;

      if (fbConflictId) {
        // Submit a dispute report instead of generic feedback
        res = await fetch(`${API}/api/violations/conflicts/${fbConflictId}/report`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ bookingId: fbBookingId || undefined, description: fbComment || undefined, evidenceUrl: undefined }),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.message || "Dispute submission failed");
        setFbSuccess(t("studentDashboard.disputeSuccessMsg"));
      } else {
        res = await fetch(`${API}/api/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ facilityId: fbFacility, bookingId: fbBookingId || undefined, rating: fbRating, comment: fbComment }),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.message || "Feedback failed");
        setFbSuccess(t("studentDashboard.feedbackSuccessMsg"));
      }
      setFbComment(""); setFbRating(5);
      setTimeout(() => { setShowFeedback(false); setFbConflictId(""); setFbBookingId(""); }, 2000);
    } catch (err) { setFbError(err.message); }
    finally { setFbLoading(false); }
  };

  // Stats
  const active = bookings.filter(b => ["CONFIRMED", "APPROVED", "PENDING"].includes(b.status));
  const upcoming = active.filter(b => new Date(b.startTime) > new Date());
  const completed = bookings.filter(b => b.status === "COMPLETED");
  const conflictBookings = bookings.filter(b => b.conflictId && b.status === "PENDING");
  const conflictsById = Object.values(
    conflictBookings.reduce((acc, b) => {
      if (!acc[b.conflictId]) acc[b.conflictId] = { id: b.conflictId, bookings: [] };
      acc[b.conflictId].bookings.push(b);
      return acc;
    }, {})
  );

  const [showConflictDetail, setShowConflictDetail] = useState(false);
  const [activeConflict, setActiveConflict] = useState(null);

  const upcomingGrouped = upcoming
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
    .reduce((acc, b) => {
      const key = new Date(b.startTime).toDateString();
      (acc[key] = acc[key] || []).push(b);
      return acc;
    }, {});

  const filterTabs = [
    { id: "bookings", label: t("studentDashboard.allBookings"), count: bookings.length },
    { id: "upcoming", label: t("studentDashboard.upcoming"), count: upcoming.length },
    { id: "conflicts", label: t("studentDashboard.conflicts"), count: conflictBookings.length },
    { id: "completed", label: t("studentDashboard.completed"), count: completed.length },
    { id: "attendance", label: t("studentDashboard.attendance"), count: upcoming.length },
  ];

  const displayBookings =
    activeTab === "upcoming" ? upcoming :
      activeTab === "conflicts" ? conflictBookings :
      activeTab === "completed" ? completed :
        bookings;

  return (
    <div className="sd-shell">
      {/* Sidebar Overlay */}
      <div 
        className={`sd-sidebar-overlay ${isMobileMenuOpen ? "active" : ""}`}
        role="button"
        tabIndex={0}
        aria-label="Close menu"
        onClick={() => setIsMobileMenuOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            setIsMobileMenuOpen(false);
          }
        }}
      />
      {/* Sidebar */}
      <aside className={`sd-sidebar ${isMobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="sd-sidebar-profile">
          <div className="sd-avatar">
            {session?.fullName?.charAt(0)?.toUpperCase() || "S"}
          </div>
          <div>
            <div className="sd-profile-name">{session?.fullName}</div>
            <div className="sd-profile-id">{session?.studentId || "Student"}</div>
          </div>
        </div>

        <nav className="sd-nav">
          {[
            { id: "bookings", icon: "📅", label: t("studentDashboard.allBookings") },
            { id: "matchmaking", icon: "🎯", label: t("studentDashboard.matchmakingTab").replace("🎯 ", "") },
            { id: "upcoming", icon: "🔜", label: t("studentDashboard.upcoming") },
            { id: "conflicts", icon: "⚠️", label: t("studentDashboard.conflicts") },
            { id: "completed", icon: "🏁", label: t("studentDashboard.completed") },
            { id: "attendance", icon: "📍", label: t("studentDashboard.attendance") },
            { id: "medical", icon: "⚕️", label: t("studentDashboard.medicalClearance") },
            { id: "fairness", icon: "⚖️", label: t("studentDashboard.fairnessIndex") },
          ].map(item => (
            <button
              key={item.id}
              className={`sd-nav-item ${activeTab === item.id ? "active" : ""}`}
              onClick={() => {
                setActiveTab(item.id);
                setIsMobileMenuOpen(false);
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sd-sidebar-footer">
          <button className="sd-nav-item" onClick={() => { navigate("/book"); setIsMobileMenuOpen(false); }}>
            <span>🎯</span> {t("studentDashboard.newBooking")}
          </button>
          <button className="sd-nav-item danger" onClick={() => { onLogout(); setIsMobileMenuOpen(false); }}>
            <span>🚪</span> {t("common.logout")}
          </button>
        </div>

        {/* Warnings Alert */}
        {session?.warnings > 0 && (
          <div className="sd-warnings-alert">
            <strong>⚠️ {session.warnings} {t("studentDashboard.warningsTitle")}</strong>
            <p>{t("studentDashboard.warningsBanNotice", { count: 3 - session.warnings, plural: (3 - session.warnings !== 1 ? "s" : "") })}</p>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="sd-main">
        {/* Topbar */}
        <header className="sd-topbar">
          <div className="sd-topbar-left">
            <button 
              className="sd-menu-toggle"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Open navigation menu"
              aria-expanded={isMobileMenuOpen}
            >
              ☰
            </button>
            <div>
              <h1 className="sd-topbar-title">{t("studentDashboard.studentPortal")}</h1>
              <p className="sd-topbar-sub">
                {t("studentDashboard.welcome")} <strong>{session?.fullName}</strong> — {new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
          </div>
          <div className="sd-topbar-right">
            <NotificationBell onClick={toggleNotifications} />
            <button className="sd-book-cta" onClick={() => navigate("/book")}>
              {t("studentDashboard.bookFacilityBtn")}
            </button>
          </div>
        </header>

        <div className="sd-content">
          {/* Stats Row & Timeline (only on overview/bookings tab) */}
          {activeTab === "bookings" && (
            <>
              {/* Stats Row */}
              <div className="sd-stats-row">
                <StatCard icon="📅" value={bookings.length} label={t("studentDashboard.totalBookings")} sub={t("studentDashboard.allTime")} color="#1cb2bf" />
                <StatCard icon="🔜" value={upcoming.length} label={t("studentDashboard.upcoming")} sub={t("studentDashboard.confirmed")} color="#3b82f6" />
                <StatCard icon="🏁" value={completed.length} label={t("studentDashboard.sessionsDone")} sub={t("studentDashboard.completed")} color="#10b981" />
                <StatCard icon="⭐" value={userPoints} label={t("studentDashboard.myPoints")} sub={t("studentDashboard.earnedSoFar")} color="#f59e0b" />
                <StatCard icon="⚠️" value={userWarnings} label={t("studentDashboard.warningsCard")} sub={t("studentDashboard.maxBan")} color="#ef4444" warn />
                <StatCard icon="🎫" value={userCredits} label={t("studentDashboard.availableCredits")} sub={t("studentDashboard.timingAllowance")} color="#8b5cf6" />
              </div>

              {/* Upcoming Timeline (if any) */}
              {upcoming.length > 0 && (
                <div className="sd-timeline-card">
                  <h3 className="sd-section-title">{t("studentDashboard.yourSchedule")}</h3>
                  <div className="sd-timeline">
                    {Object.entries(upcomingGrouped).map(([dateStr, items]) => (
                      <div key={dateStr} className="sd-timeline-group">
                        <div className="sd-timeline-date">
                          {new Date(dateStr).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
                        </div>
                        {items.map(b => {
                          const statusKey = b.conflictId && b.status === "PENDING" ? "CONFLICT" : b.status;
                          const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.PENDING;
                          const translatedLabel = t(`studentDashboard.status${statusKey.charAt(0) + statusKey.slice(1).toLowerCase()}`) || cfg.label;
                          return (
                            <div key={b.id} className="sd-timeline-item">
                              <div className="sd-timeline-dot" style={{ background: cfg.color }} />
                              <div className="sd-timeline-body">
                                <span className="sd-timeline-facility">{FACILITY_ICONS(b.facility?.name)} {b.facility?.name}</span>
                                <span className="sd-timeline-time">
                                  {new Date(b.startTime).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                                </span>
                                <span className="sd-status-badge" style={{ background: cfg.bg, color: cfg.color }}>{cfg.icon} {translatedLabel}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Bookings List */}
          {activeTab === "matchmaking" ? (
            <div className="sd-matchmaking-container">
              <div className="sd-list-card">
                <div className="sd-list-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 className="sd-section-title" style={{ margin: 0 }}>
                      {t("studentDashboard.matchmakingTitle")}
                    </h3>
                    <p style={{ margin: "4px 0 0", color: "#5a6a80", fontSize: "0.85rem" }}>
                      {t("studentDashboard.matchmakingSubtitle")}
                    </p>
                  </div>
                  <button 
                    onClick={fetchMatchmakingData} 
                    className="sd-reschedule-btn" 
                    style={{ padding: "6px 14px", margin: 0 }}
                    disabled={matchmakingLoading}
                  >
                    {matchmakingLoading ? t("studentDashboard.updating") : t("studentDashboard.updateStatusBtn")}
                  </button>
                </div>

                {/* Matchmaking Grid */}
                <div className="sd-matchmaking-grid">
                  
                  {/* Left Column: Join Queue Form */}
                  <div className="sd-matchmaking-form-panel" style={{ background: '#f8fafc', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#1e293b' }}>{t("studentDashboard.joinMatchmakingQueue")}</h4>
                    {lfgError && <div className="sd-feedback-error" style={{ marginBottom: 12, background: '#fee2e2', color: '#ef4444', padding: '10px 14px', borderRadius: 8, fontSize: '0.88rem' }}>{lfgError}</div>}
                    {lfgSuccess && <div className="sd-feedback-success" style={{ marginBottom: 12, background: '#d1fae5', color: '#10b981', padding: '10px 14px', borderRadius: 8, fontSize: '0.88rem' }}>{lfgSuccess}</div>}
                    
                    <form onSubmit={handleJoinQueue} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: 6, color: '#475569' }}>{t("studentDashboard.sportAndFacility")}</label>
                        <select 
                          className="sd-fb-input" 
                          value={lfgForm.optionId} 
                          onChange={e => setLfgForm(p => ({ ...p, optionId: e.target.value }))}
                          required
                          style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.9rem', color: '#334155' }}
                        >
                          <option value="">{t("studentDashboard.selectSportPlaceholder")}</option>
                          {matchmakingOptions.map(opt => (
                            <option key={`${opt.facilityId}-${opt.sportId}`} value={`${opt.facilityId}-${opt.sportId}`}>
                              {opt.icon} {opt.sportName} ({opt.facilityName})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sd-matchmaking-form-row">
                        <div>
                          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: 6, color: '#475569' }}>{t("studentDashboard.date")}</label>
                          <input 
                            type="date" 
                            required 
                            min={getMinDate()} 
                            value={lfgForm.date} 
                            onChange={e => setLfgForm(p => ({ ...p, date: e.target.value }))} 
                            className="sd-fb-input"
                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.9rem', color: '#334155' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: 6, color: '#475569' }}>{t("studentDashboard.timeSlot")}</label>
                          <select 
                            className="sd-fb-input" 
                            value={lfgForm.timeSlot} 
                            onChange={e => setLfgForm(p => ({ ...p, timeSlot: e.target.value }))}
                            required
                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.9rem', color: '#334155' }}
                          >
                            {["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00"].map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <button 
                        type="submit" 
                        className="sd-fb-submit" 
                        disabled={lfgLoading || !lfgForm.optionId}
                        style={{ marginTop: 8, width: '100%', padding: '12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}
                      >
                        {lfgLoading ? t("studentDashboard.joiningQueue") : t("studentDashboard.joinAnonymousQueueBtn")}
                      </button>
                    </form>
                  </div>

                  {/* Right Column: Active Queues */}
                  <div className="sd-matchmaking-queues-panel" style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', minHeight: 200 }}>
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#1e293b' }}>{t("studentDashboard.activeQueuesAnonymous")}</h4>
                    {myQueues.length === 0 ? (
                      <div className="sd-empty" style={{ padding: '40px 20px', textAlign: 'center', border: '2px dashed #cbd5e1', borderRadius: 8 }}>
                        <div style={{ fontSize: '2.5rem' }}>⏳</div>
                        <h4 style={{ margin: '12px 0 4px', color: '#475569' }}>{t("studentDashboard.noActiveQueues")}</h4>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>{t("studentDashboard.notWaitingInQueues")}</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {myQueues.map(q => {
                          const statusStr = q.playersCount >= q.idealCount 
                            ? t("studentDashboard.statusCreatingMatch") 
                            : t("studentDashboard.statusWaitingPlayers", { count: (q.idealCount || 10) - (q.playersCount || 1) });
                          return (
                            <div key={q.id} className="sd-queue-card">
                              <div className="sd-conflict-left">
                                <div className="sd-conflict-fac" style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1e293b' }}>
                                  {FACILITY_ICONS(q.facility?.name)} {q.sport?.name}
                                </div>
                                <div className="sd-conflict-time" style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>
                                  📅 {q.date} | 🕐 {q.timeSlot}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                                  <span style={{ display: 'inline-block', background: '#3b82f6', color: '#fff', fontSize: '0.75rem', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>
                                    {t("studentDashboard.playersCount", { count: q.playersCount || 1, ideal: q.idealCount || 10 })}
                                  </span>
                                  <span style={{ display: 'inline-block', background: '#e2e8f0', color: '#475569', fontSize: '0.75rem', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>
                                    {t("studentDashboard.minPlayersCount", { min: q.minCount || 6 })}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: (q.playersCount >= q.minCount) ? '#10b981' : '#f59e0b', fontWeight: 600, marginTop: 6 }}>
                                  🔔 Status: {statusStr}
                                </div>
                              </div>
                              <div className="sd-conflict-right">
                                <button 
                                  className="sd-cancel-btn"
                                  style={{ margin: 0, padding: '6px 12px', fontSize: '0.85rem' }}
                                  onClick={() => handleLeaveQueue(q.sportId, q.date, q.timeSlot)}
                                  disabled={lfgLoading}
                                >
                                  {t("studentDashboard.leaveBtn")}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                </div>

                {/* Section: Matched Games / Balanced Teams */}
                <div className="sd-matched-games-section" style={{ marginTop: 32 }}>
                  <h3 className="sd-section-title" style={{ marginBottom: 16 }}>{t("studentDashboard.matchedGamesAndTeams")}</h3>
                  {myMatches.length === 0 ? (
                    <div className="sd-empty" style={{ padding: '60px 20px', textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                      <div style={{ fontSize: '3rem' }}>⚔️</div>
                      <h4 style={{ margin: '16px 0 6px', color: '#475569' }}>{t("studentDashboard.noMatchedGames")}</h4>
                      <p style={{ fontSize: '0.88rem', color: '#64748b', maxWidth: 400, margin: '0 auto' }}>{t("studentDashboard.matchedGamesDesc")}</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {myMatches.map(m => (
                        <div key={m.id} style={{ border: '1px solid #cbd5e1', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                          
                          {/* Match Header */}
                          <div className="sd-match-header">
                            <div>
                              <span style={{ fontWeight: 800, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 6, color: '#1e293b' }}>
                                {FACILITY_ICONS(m.sportName)} {t("studentDashboard.matchTitle", { sportName: m.sportName })}
                              </span>
                              <span style={{ fontSize: '0.82rem', color: '#64748b', display: 'block', marginTop: 2 }}>
                                🏟️ {t("studentDashboard.courtLabel", { facility: m.facilityName })}
                              </span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem' }}>
                                📅 {new Date(m.startTime).toLocaleDateString(locale, { day: 'numeric', month: 'short' })} | 🕐 {new Date(m.startTime).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <span className="sd-status-badge" style={{ background: '#d1fae5', color: '#10b981', display: 'inline-block', marginTop: 6, fontWeight: 700 }}>
                                {t("studentDashboard.matchFound")}
                              </span>
                            </div>
                          </div>

                          {/* Match Teams / Balancing Grid */}
                          <div className="sd-match-teams-grid">
                            
                            {/* Team A */}
                            <div style={{ border: m.myTeam === "A" ? '2px solid #3b82f6' : '1px solid #e2e8f0', background: m.myTeam === "A" ? '#eff6ff' : '#fff', padding: 16, borderRadius: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <span style={{ fontWeight: 800, color: '#1e293b' }}>{t("studentDashboard.teamRight")}</span>
                                {m.myTeam === "A" && <span style={{ background: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 800 }}>{t("studentDashboard.yourTeamTag")}</span>}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {m.teamA.map((p, idx) => (
                                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#334155' }}>👤 {p.fullName}</span>
                                    <span style={{
                                      fontSize: '0.72rem',
                                      fontWeight: 800,
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      background: p.skillLevel === "Advanced" ? "#fee2e2" : p.skillLevel === "Intermediate" ? "#fef3c7" : "#ede9fe",
                                      color: p.skillLevel === "Advanced" ? "#ef4444" : p.skillLevel === "Intermediate" ? "#d97706" : "#8b5cf6"
                                    }}>
                                      {p.skillLevel}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Team B */}
                            <div style={{ border: m.myTeam === "B" ? '2px solid #3b82f6' : '1px solid #e2e8f0', background: m.myTeam === "B" ? '#eff6ff' : '#fff', padding: 16, borderRadius: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <span style={{ fontWeight: 800, color: '#1e293b' }}>{t("studentDashboard.teamLeft")}</span>
                                {m.myTeam === "B" && <span style={{ background: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 800 }}>{t("studentDashboard.yourTeamTag")}</span>}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {m.teamB.map((p, idx) => (
                                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#334155' }}>👤 {p.fullName}</span>
                                    <span style={{
                                      fontSize: '0.72rem',
                                      fontWeight: 800,
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      background: p.skillLevel === "Advanced" ? "#fee2e2" : p.skillLevel === "Intermediate" ? "#fef3c7" : "#ede9fe",
                                      color: p.skillLevel === "Advanced" ? "#ef4444" : p.skillLevel === "Intermediate" ? "#d97706" : "#8b5cf6"
                                    }}>
                                      {p.skillLevel}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          ) : activeTab === "medical" ? (
            <div className="sd-medical-container">
              <div className="sd-list-card">
                <div className="sd-list-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 className="sd-section-title" style={{ margin: 0 }}>
                      {t("studentDashboard.studentMedicalHistory")}
                    </h3>
                    <p style={{ margin: "4px 0 0", color: "#5a6a80", fontSize: "0.85rem" }}>
                      {t("studentDashboard.medicalHistoryDesc")}
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setMedSuccess("");
                      setMedError("");
                      setMedForm({ documentName: "", description: "", documentUrl: "" });
                      setShowUploadMedical(true);
                    }} 
                    className="sd-book-cta" 
                    style={{ margin: 0 }}
                  >
                    {t("studentDashboard.uploadNewReportBtn")}
                  </button>
                </div>

                {/* Compliance Banner */}
                {(() => {
                  const hasApproved = medicalRecords.some(r => r.status === "APPROVED");
                  const hasPending = medicalRecords.some(r => r.status === "PENDING");
                  let statusKey = "statusNonCompliant";
                  let badgeColor = "#ef4444";
                  let badgeBg = "#fee2e2";
                  let badgeDescKey = "nonCompliantDesc";
                  let badgeIcon = "❌";

                  if (hasApproved) {
                    statusKey = "statusCompliant";
                    badgeColor = "#10b981";
                    badgeBg = "#d1fae5";
                    badgeDescKey = "compliantDesc";
                    badgeIcon = "✅";
                  } else if (hasPending) {
                    statusKey = "statusPendingReview";
                    badgeColor = "#f59e0b";
                    badgeBg = "#fef3c7";
                    badgeDescKey = "pendingReviewDesc";
                    badgeIcon = "⏳";
                  }

                  const badgeText = t(`studentDashboard.${statusKey}`);
                  const badgeDesc = t(`studentDashboard.${badgeDescKey}`);

                  return (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      background: badgeBg,
                      color: badgeColor,
                      padding: 16,
                      borderRadius: 12,
                      marginBottom: 24,
                      border: `1px solid ${badgeColor}40`
                    }}>
                      <div style={{ fontSize: "2rem" }}>{badgeIcon}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{t("studentDashboard.complianceStatusLabel", { status: badgeText })}</div>
                        <div style={{ color: "#334155", fontSize: "0.88rem", marginTop: 4 }}>{badgeDesc}</div>
                      </div>
                    </div>
                  );
                })()}

                {medLoading ? (
                  <div className="sd-loading">
                    <div className="sd-spinner" />
                    <p>{t("studentDashboard.loadingMedicalRecords")}</p>
                  </div>
                ) : medicalRecords.length === 0 ? (
                  <div className="sd-empty">
                    <div style={{ fontSize: "3rem" }}>⚕️</div>
                    <h3>{t("studentDashboard.noMedicalRecordsUploaded")}</h3>
                    <p>{t("studentDashboard.medicalRecordsUploadPrompt")}</p>
                  </div>
                ) : (
                  <div className="ac-table-wrap" style={{ marginTop: 12 }}>
                    <table className="ac-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th>{t("studentDashboard.docNameCol")}</th>
                          <th>{t("studentDashboard.submittedDateCol")}</th>
                          <th>{t("studentDashboard.submittedByCol")}</th>
                          <th>{t("studentDashboard.statusCol")}</th>
                          <th>{t("studentDashboard.descriptionCol")}</th>
                          <th>{t("studentDashboard.downloadCol")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {medicalRecords.map(r => (
                          <tr key={r.id}>
                            <td>
                              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                📄 {r.documentName}
                              </div>
                            </td>
                            <td>{new Date(r.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                            <td>
                              <span className="ac-role-badge" data-role={r.submittedBy}>{r.submittedBy}</span>
                            </td>
                            <td>
                              <span className="sd-status-badge" style={{
                                background: r.status === "APPROVED" ? "#d1fae5" : r.status === "PENDING" ? "#fef3c7" : "#fee2e2",
                                color: r.status === "APPROVED" ? "#10b981" : r.status === "PENDING" ? "#f59e0b" : "#ef4444",
                                padding: "4px 8px",
                                borderRadius: 6,
                                fontWeight: 700
                              }}>
                                {t(`studentDashboard.status${r.status.charAt(0) + r.status.slice(1).toLowerCase()}`) || r.status}
                              </span>
                            </td>
                            <td style={{ fontSize: "0.85rem", color: "#475569", maxWidth: 250, whiteSpace: "pre-wrap" }}>
                              {r.description || "N/A"}
                            </td>
                            <td>
                              <a 
                                href={r.documentUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="sd-view-conflict"
                                style={{ textDecoration: 'none', display: 'inline-block', padding: '4px 10px', fontSize: '0.82rem' }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  alert(t("studentDashboard.simulatedDownloadAlert", { name: r.documentName, url: r.documentUrl }));
                                }}
                              >
                                📥 {t("studentDashboard.downloadBtn")}
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "fairness" ? (
            <div className="sd-fairness-container">
              <div className="sd-list-card">
                <div className="sd-list-header" style={{ marginBottom: 24 }}>
                  <div>
                    <h3 className="sd-section-title" style={{ margin: 0 }}>
                      {t("studentDashboard.fairnessIndexTitle")}
                    </h3>
                    <p style={{ margin: "4px 0 0", color: "#5a6a80", fontSize: "0.85rem" }}>
                      {t("studentDashboard.fairnessIndexSub")}
                    </p>
                  </div>
                  <button 
                    onClick={fetchFairnessData} 
                    className="sd-reschedule-btn" 
                    style={{ padding: "6px 14px" }}
                    disabled={fairnessLoading}
                  >
                    {fairnessLoading ? t("studentDashboard.refreshing") : t("studentDashboard.refreshMetricsBtn")}
                  </button>
                </div>

                {fairnessLoading && !fairnessData ? (
                  <div className="sd-loading">
                    <div className="sd-spinner" />
                    <p>{t("studentDashboard.fetchingFairness")}</p>
                  </div>
                ) : !fairnessData ? (
                  <div className="sd-empty">
                    <div style={{ fontSize: "3rem" }}>⚠️</div>
                    <h3>{t("studentDashboard.fairnessUnavailable")}</h3>
                    <p>{t("studentDashboard.fairnessUnavailableDesc")}</p>
                  </div>
                ) : (
                  <div className="sd-fairness-content">
                    {/* Active Priorities Grid */}
                    <div className="sd-fairness-grid">
                      
                      {/* Priority Badges */}
                      <div className="sd-fairness-info-card priority">
                        <div className="sd-info-card-header">
                          <span className="sd-info-card-icon">👑</span>
                          <span className="sd-info-card-title">{t("studentDashboard.weeksPriority")}</span>
                        </div>
                        <div className="sd-info-card-body">
                          <div className="sd-priority-badge-large">
                            {fairnessData.currentPrioritySport === "Basketball" ? "🏀 Basketball" : "🏐 Volleyball"}
                          </div>
                          <p className="sd-info-card-desc">
                            {t("studentDashboard.weeksPriorityDesc")}
                          </p>
                        </div>
                      </div>

                      {/* Prime Time Allocation */}
                      <div className="sd-fairness-info-card prime-time">
                        <div className="sd-info-card-header">
                          <span className="sd-info-card-icon">⚡</span>
                          <span className="sd-info-card-title">{t("studentDashboard.primeTimePriority")}</span>
                        </div>
                        <div className="sd-info-card-body">
                          <div className="sd-priority-badge-large prime">
                            {fairnessData.primeTimePrioritySport === "Basketball" ? "🏀 Basketball" : 
                             fairnessData.primeTimePrioritySport === "Volleyball" ? "🏐 Volleyball" : t("studentDashboard.sharedFree")}
                          </div>
                          <p className="sd-info-card-desc">
                            {t("studentDashboard.primeTimePriorityDesc")}
                          </p>
                        </div>
                      </div>

                      {/* General Fairness Scores */}
                      <div className="sd-fairness-info-card scores">
                        <div className="sd-info-card-header">
                          <span className="sd-info-card-icon">📊</span>
                          <span className="sd-info-card-title">{t("studentDashboard.priorityScores")}</span>
                        </div>
                        <div className="sd-info-card-body">
                          <div className="sd-score-comparison">
                            <div className="sd-score-item">
                              <span className="sd-score-sport">🏀 Basketball</span>
                              <div className="sd-score-bar-bg">
                                <div className="sd-score-bar-fill basketball" style={{ width: `${Math.min(100, (fairnessData.fairnessScore.Basketball / Math.max(1, fairnessData.fairnessScore.Basketball + fairnessData.fairnessScore.Volleyball)) * 100)}%` }} />
                              </div>
                              <span className="sd-score-val">{fairnessData.fairnessScore.Basketball} pts</span>
                            </div>
                            <div className="sd-score-item">
                              <span className="sd-score-sport">🏐 Volleyball</span>
                              <div className="sd-score-bar-bg">
                                <div className="sd-score-bar-fill volleyball" style={{ width: `${Math.min(100, (fairnessData.fairnessScore.Volleyball / Math.max(1, fairnessData.fairnessScore.Basketball + fairnessData.fairnessScore.Volleyball)) * 100)}%` }} />
                              </div>
                              <span className="sd-score-val">{fairnessData.fairnessScore.Volleyball} pts</span>
                            </div>
                          </div>
                          <p className="sd-info-card-desc" style={{ marginTop: 8 }}>
                            {t("studentDashboard.priorityScoresDesc")}
                          </p>
                        </div>
                      </div>

                    </div>

                    {/* Quota Progress & Details */}
                    <div className="sd-fairness-details-section">
                      <div className="sd-quota-section">
                        <h4 className="sd-details-title">{t("studentDashboard.weeklyQuotaTitle")}</h4>
                        
                        <div className="sd-quota-progress-card">
                          <div className="sd-quota-label-row">
                            <span className="sd-quota-sport">{t("studentDashboard.basketballQuota")}</span>
                            <span className="sd-quota-percent">{fairnessData.quotaAchievement.Basketball}%</span>
                          </div>
                          <div className="sd-quota-progress-bg">
                            <div className="sd-quota-progress-fill bb" style={{ width: `${Math.min(100, fairnessData.quotaAchievement.Basketball)}%` }} />
                          </div>
                          <div className="sd-quota-meta-row">
                            <span>{t("studentDashboard.bookedHoursLabel", { count: fairnessData.bookedHours.Basketball })}</span>
                            <span>{t("studentDashboard.activePlayersLabel", { count: fairnessData.activePlayers.Basketball })}</span>
                          </div>
                        </div>

                        <div className="sd-quota-progress-card" style={{ marginTop: 16 }}>
                          <div className="sd-quota-label-row">
                            <span className="sd-quota-sport">{t("studentDashboard.volleyballQuota")}</span>
                            <span className="sd-quota-percent">{fairnessData.quotaAchievement.Volleyball}%</span>
                          </div>
                          <div className="sd-quota-progress-bg">
                            <div className="sd-quota-progress-fill vb" style={{ width: `${Math.min(100, fairnessData.quotaAchievement.Volleyball)}%` }} />
                          </div>
                          <div className="sd-quota-meta-row">
                            <span>{t("studentDashboard.bookedHoursLabel", { count: fairnessData.bookedHours.Volleyball })}</span>
                            <span>{t("studentDashboard.activePlayersLabel", { count: fairnessData.activePlayers.Volleyball })}</span>
                          </div>
                        </div>
                      </div>

                      {/* Fairness Policy Guidelines */}
                      <div className="sd-policies-section">
                        <h4 className="sd-details-title">{t("studentDashboard.smartFairnessPolicies")}</h4>
                        <ul className="sd-policies-list">
                          <li>
                            <strong>{t("studentDashboard.antiMonopolyRule")}</strong>
                          </li>
                          <li>
                            <strong>{t("studentDashboard.consecutiveLimitRule")}</strong>
                          </li>
                          <li>
                            <strong>{t("studentDashboard.overlapResolutionRule")}</strong>
                          </li>
                          <li>
                            <strong>{t("studentDashboard.publicTransparencyRule")}</strong>
                          </li>
                        </ul>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="sd-list-card">
              <div className="sd-list-header">
                <h3 className="sd-section-title" style={{ margin: 0 }}>
                  {activeTab === "attendance" ? t("studentDashboard.checkinCheckoutTab") :
                    activeTab === "conflicts" ? t("studentDashboard.bookingConflictsTab") :
                    activeTab === "upcoming" ? t("studentDashboard.upcomingBookingsTab") :
                    activeTab === "completed" ? t("studentDashboard.completedSessionsTab") :
                    t("studentDashboard.allBookingsTab")}
                </h3>
                <div className="sd-filter-tabs">
                  {filterTabs.map(t => (
                    <button
                      key={t.id}
                      className={`sd-filter-tab ${activeTab === t.id ? "active" : ""}`}
                      onClick={() => setActiveTab(t.id)}
                    >
                      {t.label}
                      <span className="sd-tab-count">{t.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="sd-loading">
                  <div className="sd-spinner" />
                  <p>{t("common.loading")}</p>
                </div>
              ) : activeTab === "attendance" ? (
                upcoming.length === 0 ? (
                  <div className="sd-empty">
                    <div style={{ fontSize: "3.5rem" }}>📍</div>
                    <h3>{t("studentDashboard.noUpcomingBookings")}</h3>
                    <p>{t("studentDashboard.bookFacilityToStart")}</p>
                  </div>
                ) : (
                  <div className="sd-booking-list">
                    {upcoming.map(b => (
                      <AttendanceCard
                        key={b.id}
                        booking={b}
                        onCheckIn={(success, message) => {
                          if (success) {
                            fetchData();
                          }
                        }}
                        onCheckOut={(success, message) => {
                          if (success) {
                            fetchData();
                          }
                        }}
                        API={API}
                      />
                    ))}
                  </div>
                )
              ) : activeTab === "conflicts" ? (
                conflictsById.length === 0 ? (
                  <div className="sd-empty">
                    <div style={{ fontSize: "3.5rem" }}>⚠️</div>
                    <h3>{t("studentDashboard.noConflicts")}</h3>
                    <p>{t("studentDashboard.noConflictsDesc")}</p>
                  </div>
                ) : (
                  <div className="sd-booking-list">
                    {conflictsById.map(c => {
                      const mine = c.bookings.find(b => b.userId === session?.id);
                      const otherCount = c.bookings.length - (mine ? 1 : 0);
                      const sample = c.bookings[0];
                      const start = new Date(sample.startTime);
                      return (
                        <div className="sd-conflict-card" key={c.id}>
                          <div className="sd-conflict-left">
                            <div className="sd-conflict-fac">{FACILITY_ICONS(sample.facility?.name)} {sample.facility?.name}</div>
                            <div className="sd-conflict-time">{start.toLocaleString(locale)}</div>
                            <div className="sd-conflict-count">
                              {t("studentDashboard.bookingsCountLabel", { count: c.bookings.length, otherCount, plural: (otherCount !== 1 ? "s" : "") })}
                            </div>
                          </div>
                          <div className="sd-conflict-right">
                            <button className="sd-view-conflict" onClick={() => { setActiveConflict(c); setShowConflictDetail(true); }}>{t("studentDashboard.viewDetailsBtn")}</button>
                            <button className="sd-dispute-btn" onClick={() => {
                              // prefill dispute modal with student's booking id and conflict id
                              const myBooking = c.bookings.find(b => b.userId === session?.id);
                              setFbFacility(myBooking?.facilityId || sample.facilityId);
                              setFbBookingId(myBooking?.id || "");
                              setFbConflictId(c.id);
                              setFbComment(`Dispute regarding conflict at ${sample.facility?.name} on ${start.toLocaleString(locale)}`);
                              setShowFeedback(true);
                            }}>{t("studentDashboard.reportDisputeBtn")}</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : displayBookings.length === 0 ? (
                <div className="sd-empty">
                  <div style={{ fontSize: "3.5rem" }}>🏟️</div>
                  <h3>{activeTab === "conflicts" ? t("studentDashboard.noConflicts") : t("studentDashboard.noBookingsYet")}</h3>
                  <p>
                    {activeTab === "conflicts"
                      ? t("studentDashboard.noConflictsDesc")
                      : t("studentDashboard.bookFirstFacilityPrompt")}
                  </p>
                  {activeTab !== "conflicts" && (
                    <button className="sd-book-cta" onClick={() => navigate("/book")}>{t("studentDashboard.bookNowBtn")}</button>
                  )}
                </div>
              ) : (
                <div className="sd-booking-list">
                  {displayBookings
                    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
                    .map(b => (
                      <BookingCard
                        key={b.id}
                        booking={b}
                        onCancel={handleCancel}
                        onReschedule={handleReschedule}
                        onFeedback={(facilityId) => { setFbFacility(facilityId); setShowFeedback(true); setFbSuccess(""); setFbError(""); }}
                      />
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* FR-1.4 Feedback Modal */}
      {showFeedback && (
        <div className="sd-modal-overlay" onClick={() => setShowFeedback(false)}>
          <div className="sd-modal" onClick={e => e.stopPropagation()}>
            <button className="sd-modal-close" onClick={() => setShowFeedback(false)}>✕</button>
            <h2 className="sd-modal-title">{t("studentDashboard.giveFeedbackHeader")}</h2>
            <p className="sd-modal-sub">{t("studentDashboard.helpUsImprove")}</p>
            {fbSuccess ? (
              <div className="sd-feedback-success">{fbSuccess}</div>
            ) : (
              <form onSubmit={submitFeedback} className="sd-feedback-form">
                {fbError && <div className="sd-feedback-error">{fbError}</div>}
                <label>{t("studentDashboard.ratingLabel")}
                  <div className="sd-star-row">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} type="button"
                        className={`sd-star ${fbRating >= n ? "lit" : ""}`}
                        onClick={() => setFbRating(n)}>★</button>
                    ))}
                  </div>
                </label>
                <label>{t("studentDashboard.categoryLabel")}
                  <select className="sd-fb-input" value={fbFacility} onChange={e => setFbFacility(e.target.value)} required>
                    <option value="">{t("studentDashboard.selectFacilityPlaceholder")}</option>
                    {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </label>
                <label>{t("studentDashboard.commentLabel")}
                  <textarea className="sd-fb-input" rows={4} placeholder={t("studentDashboard.yourFeedbackPlaceholder")}
                    value={fbComment} onChange={e => setFbComment(e.target.value)} />
                </label>
                <button type="submit" className="sd-fb-submit" disabled={fbLoading}>
                  {fbLoading ? t("studentDashboard.submittingFeedback") : t("studentDashboard.submitFeedbackBtn")}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Conflict Detail Modal */}
      {showConflictDetail && activeConflict && (
        <div className="sd-modal-overlay" onClick={() => setShowConflictDetail(false)}>
          <div className="sd-modal" onClick={e => e.stopPropagation()}>
            <button className="sd-modal-close" onClick={() => setShowConflictDetail(false)}>✕</button>
            <h2 className="sd-modal-title">{t("studentDashboard.conflictDetailsHeader")}</h2>
            <p className="sd-modal-sub">{t("studentDashboard.involvedBookings")}</p>
            <div className="sd-conflict-detail-list">
              {activeConflict.bookings.map(b => (
                <div key={b.id} className="sd-conflict-detail-item">
                  <div className="sd-conflict-detail-left">
                    <div className="sd-conflict-fac-small">{FACILITY_ICONS(b.facility?.name)} {b.facility?.name}</div>
                    <div className="sd-conflict-time-small">{new Date(b.startTime).toLocaleString(locale)}</div>
                    <div className="sd-conflict-user">{b.user?.fullName ? b.user.fullName : (b.userId === session?.id ? t("studentDashboard.youTag") : t("studentDashboard.studentTag"))}</div>
                  </div>
                  <div className="sd-conflict-detail-right">
                    <span className="sd-status-badge" style={{ background: "#fee2e2", color: "#ef4444" }}>
                      {t(`studentDashboard.status${b.status.charAt(0) + b.status.slice(1).toLowerCase()}`) || b.status}
                    </span>
                    {b.userId === session?.id && <span className="sd-you-tag">{t("studentDashboard.yourBookingTag")}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="sd-dispute-btn" onClick={() => {
                const myBooking = activeConflict.bookings.find(b => b.userId === session?.id);
                const sample = activeConflict.bookings[0];
                setFbFacility(myBooking?.facilityId || sample.facilityId);
                setFbBookingId(myBooking?.id || "");
                setFbComment(`Dispute regarding conflict at ${sample.facility?.name} on ${new Date(sample.startTime).toLocaleString(locale)}`);
                setShowFeedback(true);
                setShowConflictDetail(false);
              }}>{t("studentDashboard.reportDisputeBtn")}</button>
              <button className="sd-close-btn" onClick={() => setShowConflictDetail(false)}>{t("studentDashboard.closeBtn")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Medical Clearance Modal */}
      {showUploadMedical && (
        <div className="sd-modal-overlay" onClick={() => { if (!medUploading) setShowUploadMedical(false); }}>
          <div className="sd-modal" onClick={e => e.stopPropagation()}>
            <button className="sd-modal-close" onClick={() => { if (!medUploading) setShowUploadMedical(false); }}>✕</button>
            <h2 className="sd-modal-title">{t("studentDashboard.submitMedicalClearanceHeader")}</h2>
            <p className="sd-modal-sub">{t("studentDashboard.uploadCertificateSub")}</p>
            {medSuccess ? (
              <div className="sd-feedback-success" style={{ margin: 0, padding: 16 }}>{medSuccess}</div>
            ) : (
              <form onSubmit={handleUploadMedical} className="sd-feedback-form">
                {medError && <div className="sd-feedback-error">{medError}</div>}
                
                <label>{t("studentDashboard.docNameCol")}
                  {!selectedFile ? (
                    <div 
                      className={`sd-dropzone ${isDragOver ? "dragover" : ""}`}
                      onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={e => {
                        e.preventDefault();
                        setIsDragOver(false);
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          handleFileSelect(e.dataTransfer.files[0]);
                        }
                      }}
                      onClick={() => document.getElementById("clearance-file-input").click()}
                    >
                      <span className="sd-dropzone-icon">📁</span>
                      <span className="sd-dropzone-text">{t("studentDashboard.dragDropPrompt")}</span>
                      <span className="sd-dropzone-subtext">{t("studentDashboard.browseFilePrompt")}</span>
                      <span className="sd-dropzone-subtext" style={{ fontSize: '0.68rem', color: '#a0aec0' }}>{t("studentDashboard.fileFormatsPrompt")}</span>
                      <input 
                        id="clearance-file-input"
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                        style={{ display: "none" }}
                        onChange={e => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileSelect(e.target.files[0]);
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="sd-file-preview">
                      <div className="sd-file-info">
                        <span className="sd-file-icon">{selectedFile.name.endsWith(".pdf") ? "📄" : "🖼️"}</span>
                        <span className="sd-file-name" title={selectedFile.name}>{selectedFile.name}</span>
                        <span style={{ fontSize: '0.72rem', color: '#888' }}>({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                      </div>
                      <button 
                        type="button" 
                        className="sd-file-remove" 
                        onClick={() => { setSelectedFile(null); setMedForm(p => ({ ...p, documentName: "", documentUrl: "" })); }}
                        disabled={medUploading}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </label>

                {medUploading && uploadProgress > 0 && (
                  <div className="sd-progress-container">
                    <div className="sd-progress-label">
                      <span>{t("studentDashboard.simulatedUploadProgress")}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="sd-progress-bg">
                      <div className="sd-progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                )}

                <label>{t("studentDashboard.notesDescriptionLabel")}
                  <textarea 
                    className="sd-fb-input" 
                    rows={4} 
                    placeholder={t("studentDashboard.notesPlaceholder")} 
                    value={medForm.description} 
                    onChange={e => setMedForm(p => ({ ...p, description: e.target.value }))} 
                    required 
                  />
                </label>

                <button type="submit" className="sd-fb-submit" disabled={medUploading || (!selectedFile && !medForm.documentName)}>
                  {medUploading ? t("studentDashboard.uploadingAndSubmitting") : t("studentDashboard.submitForApprovalBtn")}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
