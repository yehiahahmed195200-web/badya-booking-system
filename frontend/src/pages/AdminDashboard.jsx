import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import "../AdminDashboard.css";
import { API_BASE } from "../config/api";
import ThemeToggle from "../components/ThemeToggle";
import AiReportModal from "../components/AiReportModal";

const API = API_BASE;
const FAIRNESS_API = import.meta.env.VITE_FAIRNESS_API_URL || API_BASE;
const COLORS = ["#1cb2bf", "#3b82f6", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6"];
const HAS_ADMIN_API = true;
const CHATBOT_URL = import.meta.env.VITE_CHATBOT_URL || "http://localhost:3333";

function StatCard({ icon, label, value, sub, color = "#1cb2bf", alert = false }) {
  return (
    <div className="ac-stat-card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="ac-stat-icon" style={{ background: color + "18", color }}>{icon}</div>
      <div className="ac-stat-body">
        <div className="ac-stat-value" style={{ color: alert && value > 0 ? "#ef4444" : undefined }}>
          {value}
          {alert && value > 0 && <span className="ac-alert-dot" />}
        </div>
        <div className="ac-stat-label">{label}</div>
        {sub && <div className="ac-stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

const getBookingDate = (booking) => {
  const raw = booking?.createdAt || booking?.startTime || booking?.endTime;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toLocalDayKey = (date) => {
  if (!date || Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getBookingFacilityId = (booking) => booking?.facility?.id ?? booking?.facilityId;

const getBookingUserId = (booking) => booking?.user?.id ?? booking?.userId;

export default function AdminDashboard({ session, onLogout }) {
  const [bookings, setBookings] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [rules, setRules] = useState(null);
  const [rulesForm, setRulesForm] = useState(null);
  const [savingRules, setSavingRules] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPage, setAuditPage] = useState(0);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditFilter, setAuditFilter] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [bookingSearch, setBookingSearch] = useState("");
  const [userAction, setUserAction] = useState({}); // { loading, error } per userId
  const [resolving, setResolving] = useState(null); // conflictId being resolved
  const [chatOpen, setChatOpen] = useState(false);

  // Medical Clearance states
  const [athletesCompliance, setAthletesCompliance] = useState([]);
  const [athletesLoading, setAthletesLoading] = useState(false);
  const [athleteHistory, setAthleteHistory] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [aiReportOpen, setAiReportOpen] = useState(false);
  const [showUploadOnBehalfModal, setShowUploadOnBehalfModal] = useState(false);
  const [complianceNote, setComplianceNote] = useState("");
  const [complianceStatusInput, setComplianceStatusInput] = useState("APPROVED");
  const [updatingCompliance, setUpdatingCompliance] = useState(false);
  const [complianceError, setComplianceError] = useState("");
  const [complianceSuccess, setComplianceSuccess] = useState("");
  const [medicalSearch, setMedicalSearch] = useState("");
  const [medicalFilter, setMedicalFilter] = useState("all");
  const [selectedRecordToReview, setSelectedRecordToReview] = useState(null);

  // Form for upload on behalf
  const [onBehalfForm, setOnBehalfForm] = useState({ documentName: "", description: "", documentUrl: "" });
  const [onBehalfUploading, setOnBehalfUploading] = useState(false);
  const [onBehalfFile, setOnBehalfFile] = useState(null);
  const [onBehalfProgress, setOnBehalfProgress] = useState(0);
  const [onBehalfDragOver, setOnBehalfDragOver] = useState(false);

  // Analytics states
  const [analyticsSummary, setAnalyticsSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [popularity, setPopularity] = useState([]);
  const [density, setDensity] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [fairnessData, setFairnessData] = useState(null);
  const [fairnessConfig, setFairnessConfig] = useState(null);
  const [fairnessConfigForm, setFairnessConfigForm] = useState(null);
  const [savingFairness, setSavingFairness] = useState(false);
  const [activeAttendanceView, setActiveAttendanceView] = useState("noshow");
  const [attendanceFacilityFilter, setAttendanceFacilityFilter] = useState("all");
  const [attendanceDateRange, setAttendanceDateRange] = useState("all");

  const navigate = useNavigate();

  const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  const headers = { Authorization: `Bearer ${token}` };

  const fetchAthletesCompliance = async () => {
    setAthletesLoading(true);
    try {
      const res = await fetch(`${API}/api/medical-records/staff/all-athletes`, { headers });
      if (res.ok) {
        setAthletesCompliance(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch athletes compliance summary:", e);
    } finally {
      setAthletesLoading(false);
    }
  };

  const fetchAthleteHistory = async (studentId) => {
    try {
      const res = await fetch(`${API}/api/medical-records/student/${studentId}`, { headers });
      if (res.ok) {
        setAthleteHistory(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch athlete medical history:", e);
    }
  };

  const handleUpdateCompliance = async (recordId) => {
    setUpdatingCompliance(true);
    setComplianceError("");
    setComplianceSuccess("");
    try {
      const res = await fetch(`${API}/api/medical-records/${recordId}/status`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          status: complianceStatusInput,
          note: complianceNote
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update clearance status.");
      
      setComplianceSuccess("Clearance document status updated successfully!");
      setComplianceNote("");
      if (selectedAthlete) {
        await fetchAthleteHistory(selectedAthlete.userId);
      }
      await fetchAthletesCompliance();
      setTimeout(() => {
        setShowComplianceModal(false);
        setSelectedRecordToReview(null);
        setComplianceSuccess("");
      }, 1500);
    } catch (e) {
      setComplianceError(e.message);
    } finally {
      setUpdatingCompliance(false);
    }
  };

  const handleOnBehalfFileSelect = (file) => {
    if (!file) return;
    setOnBehalfFile(file);
    setOnBehalfForm(p => ({
      ...p,
      documentName: file.name,
      documentUrl: `/uploads/staff_${Date.now()}_${file.name}`
    }));
  };

  const handleUploadOnBehalf = async (e) => {
    e.preventDefault();
    if (!selectedAthlete) return;
    if (!onBehalfFile && !onBehalfForm.documentName) {
      setComplianceError("Please select a file to upload.");
      return;
    }
    setOnBehalfUploading(true);
    setComplianceError("");
    setComplianceSuccess("");

    if (onBehalfFile) {
      for (let p = 0; p <= 100; p += 10) {
        setOnBehalfProgress(p);
        await new Promise(resolve => setTimeout(resolve, 80));
      }
    }

    try {
      const res = await fetch(`${API}/api/medical-records/student/${selectedAthlete.userId}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          documentName: onBehalfForm.documentName,
          description: onBehalfForm.description,
          documentUrl: onBehalfForm.documentUrl || `/uploads/${onBehalfForm.documentName}`
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to upload on behalf.");
      
      setComplianceSuccess("Clearance report successfully submitted and approved on athlete's behalf!");
      setOnBehalfForm({ documentName: "", description: "", documentUrl: "" });
      setOnBehalfFile(null);
      setOnBehalfProgress(0);
      await fetchAthleteHistory(selectedAthlete.userId);
      await fetchAthletesCompliance();
      setTimeout(() => {
        setShowUploadOnBehalfModal(false);
        setComplianceSuccess("");
      }, 2000);
    } catch (e) {
      setComplianceError(e.message);
      setOnBehalfProgress(0);
    } finally {
      setOnBehalfUploading(false);
    }
  };

  const fetchAuditLogs = async (page = 0, action = "") => {
    try {
      const params = new URLSearchParams({ page, size: 50 });
      if (action) params.append("action", action);
      const res = await fetch(`${API}/api/audit-logs/filter?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
        setAuditTotal(data.total || 0);
        setAuditPage(page);
      }
    } catch (e) { console.error("Failed to fetch audit logs:", e); }
  };

  const fetchAnalytics = async () => {
    try {
      const [sRes, tRes, pRes, dRes, lRes, fRes, fcRes] = await Promise.all([
        fetch(`${API}/api/analytics/summary`, { headers }),
        fetch(`${API}/api/analytics/trends`, { headers }),
        fetch(`${API}/api/analytics/popularity`, { headers }),
        fetch(`${API}/api/analytics/density`, { headers }),
        fetch(`${API}/api/analytics/leaderboard`, { headers }),
        fetch(`${FAIRNESS_API}/api/analytics/fairness`, { headers }),
        fetch(`${FAIRNESS_API}/api/admin/fairness-config`, { headers }),
      ]);
      if (sRes.ok) setAnalyticsSummary(await sRes.json());
      if (tRes.ok) setTrends(await tRes.json());
      if (pRes.ok) setPopularity(await pRes.json());
      if (dRes.ok) setDensity(await dRes.json());
      if (lRes.ok) setLeaderboard(await lRes.json());
      if (fRes.ok) setFairnessData(await fRes.json());
      if (fcRes.ok) {
        const fcData = await fcRes.json();
        setFairnessConfig(fcData);
        setFairnessConfigForm(fcData);
      } else {
        // Fallback to default config values if not implemented on active backend
        const demoConfig = {
          primeTimeStartHour: 17,
          primeTimeEndHour: 21,
          basketballQuotaPercent: 60.0,
          volleyballQuotaPercent: 40.0,
          cooldownPeriodHours: 24,
          maxWeeklyReservationsPerUser: 3,
          consecutiveSlotLimit: 2,
          teamOverlapThresholdPercent: 50.0,
          playerWeightCoeff: 0.4,
          unusedHoursWeightCoeff: 0.3,
          primeTimeDisadvantageCoeff: 0.3,
        };
        setFairnessConfig(demoConfig);
        setFairnessConfigForm(demoConfig);
      }
    } catch (e) { console.error("Failed to fetch analytics:", e); }
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [bRes, fRes, uRes, cRes, rRes] = await Promise.all([
        fetch(`${API}/api/bookings`, { headers }),
        fetch(`${API}/api/facilities`, { headers }),
        fetch(`${API}/api/users`, { headers }),
        fetch(`${API}/api/bookings/admin/conflicts`, { headers }),
        fetch(`${API}/api/admin/system-rules`, { headers }),
      ]);
      setBookings(bRes.ok ? await bRes.json() : []);
      setFacilities(fRes.ok ? await fRes.json() : []);
      setConflicts(cRes.ok ? await cRes.json() : []);
      const rulesData = rRes.ok ? await rRes.json() : null;
      setRules(rulesData);
      setRulesForm(rulesData);
      setUsers(uRes.ok ? await uRes.json() : []);
      // Fetch audit logs
      await fetchAuditLogs(0, auditFilter);
      // Fetch analytics
      await fetchAnalytics();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (activeTab === "medical") {
      fetchAthletesCompliance();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "attendance") return;
    const intervalId = setInterval(() => {
      fetchAll();
    }, 30000);
    return () => clearInterval(intervalId);
  }, [activeTab]);

  const saveRules = async () => {
    if (!rulesForm) return;
    setSavingRules(true);
    try {
      const res = await fetch(`${API}/api/admin/system-rules`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(rulesForm),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Failed to save rules");
        return;
      }
      setRules(data);
      setRulesForm(data);
      alert("System rules updated successfully");
    } catch (e) {
      alert("Failed to save rules");
      console.error(e);
    } finally {
      setSavingRules(false);
    }
  };

  const saveFairnessConfig = async () => {
    if (!fairnessConfigForm) return;
    setSavingFairness(true);
    try {
      const res = await fetch(`${API}/api/admin/fairness-config`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(fairnessConfigForm),
      });
      if (res.status === 404) {
        alert("Notice: Fairness Engine parameters are currently managed statically by the active Java backend. Parameters cannot be changed dynamically on this version.");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Failed to save fairness parameters");
        return;
      }
      setFairnessConfig(data);
      setFairnessConfigForm(data);
      alert("Fairness Engine parameters updated successfully");
    } catch (e) {
      alert("Failed to save fairness config");
      console.error(e);
    } finally {
      setSavingFairness(false);
    }
  };

  // Derived stats
  const today = toLocalDayKey(new Date());
  const todayBookings = bookings.filter(b => {
    const bookingDate = getBookingDate(b);
    return bookingDate && toLocalDayKey(bookingDate) === today;
  });
  const pending = bookings.filter(b => b.status === "PENDING" && !b.conflictId);
  const confirmed = bookings.filter(b => b.status === "CONFIRMED");
  const cancelled = bookings.filter(b => b.status === "CANCELLED");
  const bookingSearchQuery = bookingSearch.trim().toLowerCase();
  const filteredBookings = bookingSearchQuery
    ? bookings.filter((booking) => {
      const searchableText = [
        booking.id,
        booking.user?.fullName,
        booking.user?.studentId,
        booking.user?.email,
        booking.facility?.name,
        booking.facilityId,
        booking.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchableText.includes(bookingSearchQuery);
    })
    : bookings;
  const openFacilities = facilities.filter(f => {
    const active = f.active ?? f.isActive;
    return active !== false && (f.status ? f.status === "OPEN" : true);
  });
  const now = new Date();
  const attendanceInRange = (booking) => {
    if (attendanceDateRange === "all") return true;
    const date = new Date(booking.startTime || booking.createdAt || booking.endTime);
    if (Number.isNaN(date.getTime())) return false;
    const diff = now.getTime() - date.getTime();
    if (attendanceDateRange === "7d") return diff <= 7 * 24 * 60 * 60 * 1000;
    if (attendanceDateRange === "30d") return diff <= 30 * 24 * 60 * 60 * 1000;
    return true;
  };
  const attendanceFacilityMatch = (booking) => {
    if (attendanceFacilityFilter === "all") return true;
    return String(getBookingFacilityId(booking)) === String(attendanceFacilityFilter);
  };

  const noShowBookings = bookings
    .filter(b => b.attendanceStatus === "NO_SHOW")
    .filter(attendanceInRange)
    .filter(attendanceFacilityMatch)
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
    .slice(0, 20);
  const checkedInBookings = bookings.filter(
    b => b.attendanceStatus === "CHECKED_IN" || b.attendanceStatus === "CHECKED_OUT"
  );
  const totalWithAttendanceStatus = bookings.filter(
    b => b.attendanceStatus && b.attendanceStatus !== "NOT_CHECKED_IN"
  );
  const geofenceAlerts = bookings
    .filter(
      b =>
        typeof b.distanceFromFacility === "number" &&
        typeof b.facility?.geofencingRadius === "number" &&
        b.distanceFromFacility > b.facility.geofencingRadius
    )
    .filter(attendanceInRange)
    .filter(attendanceFacilityMatch)
    .sort((a, b) => {
      const excessA = (a.distanceFromFacility - a.facility.geofencingRadius) * 1000;
      const excessB = (b.distanceFromFacility - b.facility.geofencingRadius) * 1000;
      return excessB - excessA;
    })
    .slice(0, 20);
  const getPresenceStatus = (booking) => {
    if (booking.attendanceStatus !== "CHECKED_IN") return "unknown";
    if (typeof booking.distanceFromFacility !== "number") return "unknown";
    const allowed = typeof booking.facility?.geofencingRadius === "number"
      ? Math.min(booking.facility.geofencingRadius, 0.004)
      : 0.004;
    return booking.distanceFromFacility <= allowed ? "inside" : "outside";
  };
  const livePresenceBookings = bookings
    .filter((b) => b.attendanceStatus === "CHECKED_IN")
    .filter(attendanceInRange)
    .filter(attendanceFacilityMatch)
    .map((b) => ({
      ...b,
      presenceStatus: getPresenceStatus(b),
    }))
    .sort((a, b) => new Date(b.checkedInAt || b.startTime) - new Date(a.checkedInAt || a.startTime));
  const insideNowCount = livePresenceBookings.filter((b) => b.presenceStatus === "inside").length;
  const outsideNowCount = livePresenceBookings.filter((b) => b.presenceStatus === "outside").length;
  const highRiskStudents = noShowBookings.reduce((acc, b) => {
    const id = String(getBookingUserId(b) || "unknown");
    const current = acc[id] || {
      id,
      name: b.user?.fullName || "Unknown",
      studentId: b.user?.studentId || "—",
      noShows: 0,
      latest: b.startTime,
    };
    current.noShows += 1;
    if (new Date(b.startTime) > new Date(current.latest)) current.latest = b.startTime;
    acc[id] = current;
    return acc;
  }, {});
  const highRiskList = Object.values(highRiskStudents)
    .sort((a, b) => b.noShows - a.noShows || new Date(b.latest) - new Date(a.latest))
    .slice(0, 8);
  const attendanceStats = {
    totalBookings: bookings.length,
    noShowCount: noShowBookings.length,
    checkedInCount: checkedInBookings.length,
    noShowRate: totalWithAttendanceStatus.length
      ? ((noShowBookings.length / totalWithAttendanceStatus.length) * 100).toFixed(1)
      : "0.0",
    checkInRate: totalWithAttendanceStatus.length
      ? ((checkedInBookings.length / totalWithAttendanceStatus.length) * 100).toFixed(1)
      : "0.0",
  };

  const exportAttendanceCsv = () => {
    const source = activeAttendanceView === "geofence" ? geofenceAlerts : noShowBookings;
    const headersRow = activeAttendanceView === "geofence"
      ? ["Booking ID", "Student", "Student ID", "Facility", "Start Time", "Distance (m)", "Allowed (m)", "Exceeded (m)"]
      : ["Booking ID", "Student", "Student ID", "Facility", "Start Time", "Status"];
    const rows = source.map((b) => {
      if (activeAttendanceView === "geofence") {
        const distanceM = Math.round((b.distanceFromFacility || 0) * 1000);
        const allowedM = Math.min(Math.round((b.facility?.geofencingRadius ?? 0.004) * 1000), 4);
        return [
          b.id,
          b.user?.fullName || "Unknown",
          b.user?.studentId || "—",
          b.facility?.name || "—",
          new Date(b.startTime).toLocaleString("en-GB"),
          distanceM,
          allowedM,
          Math.max(0, distanceM - allowedM),
        ];
      }
      return [
        b.id,
        b.user?.fullName || "Unknown",
        b.user?.studentId || "—",
        b.facility?.name || "—",
        new Date(b.startTime).toLocaleString("en-GB"),
        b.attendanceStatus || "NO_SHOW",
      ];
    });
    const csv = [headersRow, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${activeAttendanceView}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Booking trend: last 7 days
  const trendData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString("en", { weekday: "short" });
    const dayKey = toLocalDayKey(d);
    const count = bookings.filter(b => {
      const bookingDate = getBookingDate(b);
      return bookingDate && toLocalDayKey(bookingDate) === dayKey;
    }).length;
    return { day: label, bookings: count };
  });

  // Facility usage
  const facilityUsage = facilities.map(f => ({
    name: f.name.length > 14 ? f.name.slice(0, 14) + "…" : f.name,
    bookings: bookings.filter(b => String(getBookingFacilityId(b)) === String(f.id)).length,
  })).sort((a, b) => b.bookings - a.bookings).slice(0, 6);

  // Status breakdown for pie
  const statusData = [
    { name: "Confirmed", value: confirmed.length },
    { name: "Pending", value: pending.length },
    { name: "Cancelled", value: cancelled.length },
    { name: "Rejected", value: bookings.filter(b => b.status === "REJECTED").length },
  ].filter(d => d.value > 0);

  const handleApprove = async (id) => {
    if (!HAS_ADMIN_API) {
      alert("Admin actions are not available on the current backend yet.");
      return;
    }
    await fetch(`${API}/api/bookings/admin/${id}/approve`, { method: "POST", headers });
    fetchAll();
  };
  const handleReject = async (id) => {
    if (!HAS_ADMIN_API) {
      alert("Admin actions are not available on the current backend yet.");
      return;
    }
    const reason = prompt("Reason for rejection:");
    if (!reason) return;
    await fetch(`${API}/api/bookings/admin/${id}/reject`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ reason })
    });
    fetchAll();
  };
  const handleResolve = async (conflictId, approvedId, rejectedId) => {
    if (!HAS_ADMIN_API) {
      alert("Conflict resolution API is not available on the current backend yet.");
      return;
    }
    setResolving(conflictId);
    try {
      const res = await fetch(`${API}/api/bookings/admin/conflicts/${conflictId}/resolve`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ approvedBookingId: approvedId, rejectedBookingId: rejectedId })
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Error: ${err.message}`);
      }
      await fetchAll();
    } finally { setResolving(null); }
  };

  const doUserAction = async (userId, action) => {
    if (!HAS_ADMIN_API) {
      alert("User disciplinary actions are not available on the current backend yet.");
      return;
    }
    setUserAction(p => ({ ...p, [userId]: { loading: true, error: null } }));
    try {
      let body = {};
      if (action === "warn") {
        const reason = prompt("Enter reason for warning:");
        if (!reason) { setUserAction(p => ({ ...p, [userId]: {} })); return; }
        body = { reason };
      } else if (action === "ban") {
        const reason = prompt("Enter reason for ban:");
        if (!reason) { setUserAction(p => ({ ...p, [userId]: {} })); return; }
        body = { reason };
      }
      const res = await fetch(`${API}/api/admin/users/${userId}/${action}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      await fetchAll();
      setUserAction(p => ({ ...p, [userId]: { success: true } }));
      setTimeout(() => setUserAction(p => ({ ...p, [userId]: {} })), 2000);
    } catch (e) {
      setUserAction(p => ({ ...p, [userId]: { error: e.message } }));
    }
  };

  const filteredUsers = users.filter(u =>
    u.fullName?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.studentId?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );



  return (
    <div className="ac-shell">
      {/* Sidebar */}
      <aside className="ac-sidebar">
        <div className="ac-sidebar-brand">
          <span className="ac-brand-icon">🏟️</span>
          <div>
            <div className="ac-brand-name">Badya Sports</div>
            <div className="ac-brand-role">Admin Portal</div>
          </div>
        </div>

        <nav className="ac-nav">
          {[
            { id: "overview", icon: "📊", label: "Overview" },
            { id: "analytics", icon: "📈", label: "Analytics" },
            { id: "bookings", icon: "📅", label: "Bookings", badge: pending.length },
            { id: "facilities", icon: "🏟️", label: "Facilities" },
            { id: "rules", icon: "⚙️", label: "Rules" },
            { id: "conflicts", icon: "⚔️", label: "Conflicts", badge: conflicts.length },
            { id: "users", icon: "👥", label: "Users", badge: users.filter(u => u.isBanned).length || 0 },
            { id: "attendance", icon: "📍", label: "Attendance", badge: attendanceStats.noShowCount || 0 },
            { id: "medical", icon: "⚕️", label: "Medical Clearance", badge: athletesCompliance.filter(a => a.complianceStatus === "PENDING_REVIEW").length || 0 },
            { id: "auditlog", icon: "📋", label: "Audit Log" },
          ].map(item => (
            <button
              key={item.id}
              className={`ac-nav-item ${activeTab === item.id ? "active" : ""}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="ac-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge > 0 && <span className="ac-nav-badge">{item.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="ac-sidebar-footer">
          <button className="ac-nav-item" onClick={() => navigate("/facilities")}>
            <span className="ac-nav-icon">⚙️</span> Manage Facilities
          </button>
          <button className="ac-nav-item danger" onClick={onLogout}>
            <span className="ac-nav-icon">🚪</span> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="ac-main">
        {/* Topbar */}
        <header className="ac-topbar">
          <div>
            <h1 className="ac-topbar-title">
              {activeTab === "overview" && "📊 Dashboard Overview"}
              {activeTab === "analytics" && "📈 Analytics & Reporting"}
              {activeTab === "bookings" && "📅 Booking Management"}
              {activeTab === "facilities" && "🏟️ Facility Status"}
              {activeTab === "rules" && "⚙️ Rules & System Configuration"}
              {activeTab === "conflicts" && "⚔️ Conflict Resolution"}
              {activeTab === "users" && "👥 User Management & Disciplinary"}
              {activeTab === "attendance" && "📍 Attendance & Geofencing"}
              {activeTab === "medical" && "⚕️ Athlete Medical Clearance"}
              {activeTab === "auditlog" && "📋 Conflict Audit Log"}
            </h1>
            <p className="ac-topbar-sub">Welcome back, {session?.fullName}</p>
          </div>
          <div className="ac-topbar-actions">
            <ThemeToggle />
            <button className="ac-refresh-btn" onClick={fetchAll}>↻ Refresh</button>
            <span className="ac-live-dot" /> <span style={{ fontSize: "0.8rem", color: "#10b981" }}>Live</span>
          </div>
        </header>

        <div className="ac-content">
          {loading ? (
            <div className="ac-loading">
              <div className="ac-spinner" />
              <p>Loading dashboard data...</p>
            </div>
          ) : (
            <>
              {/* OVERVIEW TAB */}
              {activeTab === "overview" && (
                <>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
                    <button 
                      onClick={() => setAiReportOpen(true)}
                      className="ac-btn"
                      style={{ 
                        background: "linear-gradient(135deg, #1cb2bf 0%, #1399a7 100%)", 
                        color: "#fff", 
                        border: "none", 
                        borderRadius: "10px", 
                        padding: "10px 18px", 
                        fontWeight: "700", 
                        cursor: "pointer", 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "6px",
                        width: "auto"
                      }}
                    >
                      🤖 Generate AI Audit Report
                    </button>
                  </div>
                  {/* KPI Row */}
                  <div className="ac-stats-grid">
                    <StatCard icon="📅" label="Total Bookings" value={analyticsSummary?.totalBookings ?? bookings.length} sub="All time" color="#1cb2bf" />
                    <StatCard icon="👥" label="Active Users" value={analyticsSummary?.activeUsers ?? users.length} sub="Last 30 days" color="#3b82f6" />
                    <StatCard icon="🏟️" label="Open Courts" value={analyticsSummary?.openCourts ?? openFacilities.length} sub={`of ${facilities.length}`} color="#10b981" />
                    <StatCard icon="⚔️" label="Pending Conflicts" value={analyticsSummary?.pendingConflicts ?? conflicts.length} sub="Needs action" color="#ef4444" alert />
                    <StatCard icon="⏳" label="Pending Apps" value={pending.length} sub="Awaiting review" color="#f59e0b" />
                    <StatCard icon="❌" label="Cancellations" value={cancelled.length} sub="All time" color="#8b5cf6" />
                  </div>

                  {/* Charts Row */}
                  <div className="ac-charts-row">
                    {/* Line Chart */}
                    <div className="ac-chart-card">
                      <h3 className="ac-chart-title">Booking Activity — Last 30 Days</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={trends.length > 0 ? trends.map(t => ({ day: t.date.slice(5), bookings: t.count })) : trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                          <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                          <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e1eaf5" }} />
                          <Line type="monotone" dataKey="bookings" stroke="#1cb2bf" strokeWidth={2.5} dot={false} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Pie Chart */}
                    <div className="ac-chart-card ac-chart-card--sm">
                      <h3 className="ac-chart-title">Booking Status</h3>
                      {statusData.length === 0 ? (
                        <p className="ac-empty">No booking data yet</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                              {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ borderRadius: 10 }} />
                            <Legend iconType="circle" iconSize={10} />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Bar Chart */}
                  <div className="ac-chart-card">
                    <h3 className="ac-chart-title">Bookings per Facility</h3>
                    {facilityUsage.every(f => f.bookings === 0) ? (
                      <p className="ac-empty">No bookings yet</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={facilityUsage} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                          <Tooltip contentStyle={{ borderRadius: 10 }} />
                          <Bar dataKey="bookings" fill="#1cb2bf" radius={[6, 6, 0, 0]}>
                            {facilityUsage.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* System Rules */}
                  {rules && (
                    <div className="ac-chart-card">
                      <h3 className="ac-chart-title">⚙️ Active System Rules</h3>
                      <div className="ac-rules-grid">
                        <div className="ac-rule-item"><span>Max Bookings / Day</span><strong>{rules.maxBookingsPerDay}</strong></div>
                        <div className="ac-rule-item"><span>Auto-Ban Threshold</span><strong>{rules.autoBanWarningThreshold} warnings</strong></div>
                        <div className="ac-rule-item"><span>Advance Booking Window</span><strong>{rules.advanceBookingWindowDays} days</strong></div>
                        <div className="ac-rule-item"><span>Duration Range</span><strong>{rules.minBookingDurationMins} - {rules.maxBookingDurationMins} mins</strong></div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ANALYTICS TAB */}
              {activeTab === "analytics" && (
                <>
                  {/* Fairness & Rotation Engine Dashboard (Transparency Analytics) */}
                  {fairnessData && (
                    <div className="ac-chart-card" style={{ marginBottom: 20, background: "linear-gradient(135deg, rgba(28, 178, 191, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)", border: "1px solid rgba(28, 178, 191, 0.2)" }}>
                      <h3 className="ac-chart-title" style={{ color: "#1cb2bf", display: "flex", alignItems: "center", gap: 8, margin: "0 0 16px 0" }}>
                        ⚖️ Smart Fairness & Rotation Panel (Basketball vs Volleyball shared court)
                      </h3>
                      <div className="ac-rules-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                        <div className="ac-rule-item" style={{ background: "var(--ac-card-bg, #fff)", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--ac-border, #e1eaf5)" }}>
                          <span>Shared Court Utilization</span>
                          <strong style={{ fontSize: "1.6rem", color: "#1cb2bf", display: "block", marginTop: 4 }}>{fairnessData.utilizationRate}%</strong>
                          <small style={{ color: "#888", display: "block", marginTop: 4 }}>Of 84 weekly open hours</small>
                        </div>
                        <div className="ac-rule-item" style={{ background: "var(--ac-card-bg, #fff)", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--ac-border, #e1eaf5)" }}>
                          <span>Current Under-served Sport</span>
                          <strong style={{ fontSize: "1.4rem", color: "#f59e0b", display: "block", marginTop: 4 }}>🏀 {fairnessData.currentPrioritySport}</strong>
                          <small style={{ color: "#888", display: "block", marginTop: 4 }}>Granted higher priority for bookings</small>
                        </div>
                        <div className="ac-rule-item" style={{ background: "var(--ac-card-bg, #fff)", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--ac-border, #e1eaf5)" }}>
                          <span>Prime Time Priority (5-9 PM)</span>
                          <strong style={{ fontSize: "1.4rem", color: "#3b82f6", display: "block", marginTop: 4 }}>🏐 {fairnessData.primeTimePrioritySport}</strong>
                          <small style={{ color: "#888", display: "block", marginTop: 4 }}>Rotated on weekly cycle (Week {fairnessData.weekNumber})</small>
                        </div>
                        <div className="ac-rule-item" style={{ background: "var(--ac-card-bg, #fff)", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--ac-border, #e1eaf5)" }}>
                          <span>Fairness Priority Score</span>
                          <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: "0.9rem", fontWeight: "bold" }}>
                            <div>🏀 Basket: <span style={{ color: "#f59e0b" }}>{fairnessData.fairnessScore?.Basketball}</span></div>
                            <div>🏐 Volley: <span style={{ color: "#3b82f6" }}>{fairnessData.fairnessScore?.Volleyball}</span></div>
                          </div>
                          <small style={{ color: "#888", display: "block", marginTop: 6 }}>Calculated dynamically in real-time</small>
                        </div>
                      </div>

                      {/* Quota Progress */}
                      <div style={{ marginTop: 20, background: "var(--ac-card-bg, #fff)", padding: 16, borderRadius: 8, border: "1px solid var(--ac-border, #e1eaf5)" }}>
                        <h4 style={{ margin: "0 0 12px 0", fontSize: "0.95rem", color: "var(--ac-text-primary, #1e293b)" }}>📅 Weekly Quota Progress Comparison</h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 6 }}>
                              <span style={{ fontWeight: 600 }}>🏀 Basketball (Quota: 60% of capacity)</span>
                              <strong>{fairnessData.bookedHours?.Basketball} hours booked ({fairnessData.quotaAchievement?.Basketball}%)</strong>
                            </div>
                            <div style={{ width: "100%", height: 10, background: "#f0f4f8", borderRadius: 5, overflow: "hidden" }}>
                              <div style={{ width: `${Math.min(100, fairnessData.quotaAchievement?.Basketball || 0)}%`, height: "100%", background: "#f59e0b", borderRadius: 5 }} />
                            </div>
                          </div>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 6 }}>
                              <span style={{ fontWeight: 600 }}>🏐 Volleyball (Quota: 40% of capacity)</span>
                              <strong>{fairnessData.bookedHours?.Volleyball} hours booked ({fairnessData.quotaAchievement?.Volleyball}%)</strong>
                            </div>
                            <div style={{ width: "100%", height: 10, background: "#f0f4f8", borderRadius: 5, overflow: "hidden" }}>
                              <div style={{ width: `${Math.min(100, fairnessData.quotaAchievement?.Volleyball || 0)}%`, height: "100%", background: "#3b82f6", borderRadius: 5 }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="ac-analytics-grid">
                    {/* Activity Trends */}
                    <div className="ac-chart-card">
                      <h3 className="ac-chart-title">📈 Booking Activity Trends</h3>
                      <div style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trends.map(t => ({ date: t.date, count: t.count }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(8)} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                            <Line type="monotone" dataKey="count" stroke="#1cb2bf" strokeWidth={3} dot={{ r: 3, fill: "#1cb2bf" }} activeDot={{ r: 5 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="ac-stat-sub" style={{ marginTop: 12 }}>Daily booking counts for the last 30 days.</p>
                    </div>

                    {/* Sport Popularity */}
                    <div className="ac-chart-card">
                      <h3 className="ac-chart-title">🏆 Sport Popularity</h3>
                      <div style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={popularity} layout="vertical" margin={{ left: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fontWeight: 700 }} width={80} />
                            <Tooltip cursor={{ fill: "#f0f4f8" }} contentStyle={{ borderRadius: 10 }} />
                            <Bar dataKey="count" fill="#3b82f6" radius={[0, 10, 10, 0]} barSize={20} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="ac-stat-sub" style={{ marginTop: 12 }}>Comparison of sports by total booking volume.</p>
                    </div>
                  </div>

                  <div className="ac-analytics-grid" style={{ marginTop: 20 }}>
                    {/* Booking Density Heatmap */}
                    <div className="ac-chart-card">
                      <h3 className="ac-chart-title">🔥 Booking Density Heatmap</h3>
                      <div className="ac-heatmap-container">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, dIdx) => (
                          <div key={day} className="ac-heatmap-row">
                            <div className="ac-heatmap-label">{day}</div>
                            <div className="ac-heatmap-cells">
                              {Array.from({ length: 24 }).map((_, hour) => {
                                const entry = density.find(x => x.dayIdx === dIdx && x.hour === hour);
                                const count = entry ? entry.count : 0;
                                // Color intensity based on count
                                const opacity = count === 0 ? 0.05 : Math.min(0.2 + (count * 0.15), 1);
                                const color = `rgba(28, 178, 191, ${opacity})`;
                                return (
                                  <div
                                    key={hour}
                                    className="ac-heatmap-cell"
                                    style={{ backgroundColor: color }}
                                    data-tip={`${day} ${hour}:00 — ${count} bookings`}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        <div className="ac-heatmap-hours">
                          {[0, 4, 8, 12, 16, 20].map(h => (
                            <div key={h} className="ac-heatmap-hour-label" style={{ marginLeft: h === 0 ? 0 : 54 }}>{h}h</div>
                          ))}
                        </div>
                      </div>
                      <p className="ac-stat-sub">Peak usage times by day of week and hour of day.</p>
                    </div>

                    {/* Leaderboard */}
                    <div className="ac-chart-card">
                      <h3 className="ac-chart-title">🎖️ User Activity Leaderboard</h3>
                      <div className="ac-leaderboard-list">
                        {leaderboard.length === 0 && <p className="ac-empty">No user activity recorded yet.</p>}
                        {leaderboard.map((user, idx) => (
                          <div key={user.id} className="ac-leaderboard-item">
                            <div className={`ac-rank ${idx < 3 ? `ac-rank--${idx + 1}` : ""}`}>{idx + 1}</div>
                            <div className="ac-leader-info">
                              <div className="ac-leader-name">{user.fullName}</div>
                              <div className="ac-leader-id">{user.studentId}</div>
                            </div>
                            <div className="ac-leader-stats">
                              <div className="ac-leader-count">{user.bookingCount}</div>
                              <div className="ac-leader-label">Bookings</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* RULES TAB */}
              {activeTab === "rules" && rulesForm && (
                <>
                  <div className="ac-chart-card">
                    <div className="ac-table-head">
                      <h3 className="ac-chart-title" style={{ margin: 0 }}>Booking Rules & Feature Toggles</h3>
                      <button className="ac-refresh-btn" onClick={saveRules} disabled={savingRules}>
                        {savingRules ? "Saving..." : "Save Rules"}
                      </button>
                    </div>

                    <div className="ac-rules-grid" style={{ marginBottom: 16 }}>
                      <label className="ac-rule-item">
                        <span>Max bookings per user/day</span>
                        <input type="number" min="1" value={rulesForm.maxBookingsPerUserPerDay ?? 1}
                          onChange={(e) => setRulesForm((p) => ({ ...p, maxBookingsPerUserPerDay: Number(e.target.value) }))}
                          style={{ width: 90 }} />
                      </label>
                      <label className="ac-rule-item">
                        <span>Auto-ban warning threshold</span>
                        <input type="number" min="0" value={rulesForm.autoBanWarningThreshold ?? 0}
                          onChange={(e) => setRulesForm((p) => ({ ...p, autoBanWarningThreshold: Number(e.target.value) }))}
                          style={{ width: 90 }} />
                      </label>
                      <label className="ac-rule-item">
                        <span>Advance booking window (days)</span>
                        <input type="number" min="1" value={rulesForm.advanceBookingWindowDays ?? 1}
                          onChange={(e) => setRulesForm((p) => ({ ...p, advanceBookingWindowDays: Number(e.target.value) }))}
                          style={{ width: 90 }} />
                      </label>
                      <label className="ac-rule-item">
                        <span>Min duration (minutes)</span>
                        <input type="number" min="1" value={rulesForm.minBookingDurationMins ?? 1}
                          onChange={(e) => setRulesForm((p) => ({ ...p, minBookingDurationMins: Number(e.target.value) }))}
                          style={{ width: 90 }} />
                      </label>
                      <label className="ac-rule-item">
                        <span>Max duration (minutes)</span>
                        <input type="number" min="1" value={rulesForm.maxBookingDurationMins ?? 1}
                          onChange={(e) => setRulesForm((p) => ({ ...p, maxBookingDurationMins: Number(e.target.value) }))}
                          style={{ width: 90 }} />
                      </label>
                      <label className="ac-rule-item">
                        <span>Priority score threshold</span>
                        <input type="number" min="0" value={rulesForm.priorityScoreThreshold ?? 0}
                          onChange={(e) => setRulesForm((p) => ({ ...p, priorityScoreThreshold: Number(e.target.value) }))}
                          style={{ width: 90 }} />
                      </label>
                      <label className="ac-rule-item">
                        <span>Priority early access (hours)</span>
                        <input type="number" min="0" value={rulesForm.priorityEarlyAccessHours ?? 0}
                          onChange={(e) => setRulesForm((p) => ({ ...p, priorityEarlyAccessHours: Number(e.target.value) }))}
                          style={{ width: 90 }} />
                      </label>
                    </div>

                    <div className="ac-rules-grid">
                      <label className="ac-rule-item">
                        <span>Enable priority booking rules</span>
                        <input type="checkbox" checked={!!rulesForm.priorityBookingEnabled}
                          onChange={(e) => setRulesForm((p) => ({ ...p, priorityBookingEnabled: e.target.checked }))} />
                      </label>
                      <label className="ac-rule-item">
                        <span>Allow back-to-back bookings</span>
                        <input type="checkbox" checked={!!rulesForm.allowBackToBackBookings}
                          onChange={(e) => setRulesForm((p) => ({ ...p, allowBackToBackBookings: e.target.checked }))} />
                      </label>
                      <label className="ac-rule-item">
                        <span>Enable email notifications</span>
                        <input type="checkbox" checked={!!rulesForm.globalEmailNotificationsEnabled}
                          onChange={(e) => setRulesForm((p) => ({ ...p, globalEmailNotificationsEnabled: e.target.checked }))} />
                      </label>
                    </div>
                  </div>

                  {/* Fairness Engine Parameters Config (Shared Multipurpose Court) */}
                  {fairnessConfigForm && (
                    <div className="ac-chart-card" style={{ marginTop: 20 }}>
                      <div className="ac-table-head">
                        <h3 className="ac-chart-title" style={{ margin: 0 }}>⚙️ Shared Multipurpose Court Fairness Configuration</h3>
                        <button className="ac-refresh-btn" onClick={saveFairnessConfig} disabled={savingFairness}>
                          {savingFairness ? "Saving..." : "Save Fairness Configuration"}
                        </button>
                      </div>

                      <div className="ac-rules-grid" style={{ marginBottom: 16 }}>
                        <label className="ac-rule-item">
                          <span>Basketball Quota (%)</span>
                          <input type="number" min="0" max="100" value={fairnessConfigForm.basketballQuotaPercent ?? 60}
                            onChange={(e) => setFairnessConfigForm((p) => ({ ...p, basketballQuotaPercent: Number(e.target.value) }))}
                            style={{ width: 90 }} />
                        </label>
                        <label className="ac-rule-item">
                          <span>Volleyball Quota (%)</span>
                          <input type="number" min="0" max="100" value={fairnessConfigForm.volleyballQuotaPercent ?? 40}
                            onChange={(e) => setFairnessConfigForm((p) => ({ ...p, volleyballQuotaPercent: Number(e.target.value) }))}
                            style={{ width: 90 }} />
                        </label>
                        <label className="ac-rule-item">
                          <span>Cooldown Period (hours)</span>
                          <input type="number" min="0" value={fairnessConfigForm.cooldownPeriodHours ?? 24}
                            onChange={(e) => setFairnessConfigForm((p) => ({ ...p, cooldownPeriodHours: Number(e.target.value) }))}
                            style={{ width: 90 }} />
                        </label>
                        <label className="ac-rule-item">
                          <span>Max Weekly Bookings / User</span>
                          <input type="number" min="1" value={fairnessConfigForm.maxWeeklyReservationsPerUser ?? 3}
                            onChange={(e) => setFairnessConfigForm((p) => ({ ...p, maxWeeklyReservationsPerUser: Number(e.target.value) }))}
                            style={{ width: 90 }} />
                        </label>
                        <label className="ac-rule-item">
                          <span>Max Consecutive Slots (hours)</span>
                          <input type="number" min="1" value={fairnessConfigForm.consecutiveSlotLimit ?? 2}
                            onChange={(e) => setFairnessConfigForm((p) => ({ ...p, consecutiveSlotLimit: Number(e.target.value) }))}
                            style={{ width: 90 }} />
                        </label>
                        <label className="ac-rule-item">
                          <span>Team Overlap Threshold (%)</span>
                          <input type="number" min="0" max="100" value={fairnessConfigForm.teamOverlapThresholdPercent ?? 50}
                            onChange={(e) => setFairnessConfigForm((p) => ({ ...p, teamOverlapThresholdPercent: Number(e.target.value) }))}
                            style={{ width: 90 }} />
                        </label>
                      </div>

                      <div className="ac-table-head" style={{ marginTop: 20, borderBottom: "1px solid var(--ac-border, #e1eaf5)", paddingBottom: 8 }}>
                        <h4 style={{ margin: 0 }}>🧠 Mathematical Priority Score Coefficients (Must sum to 1.0)</h4>
                      </div>
                      <div className="ac-rules-grid" style={{ marginTop: 12 }}>
                        <label className="ac-rule-item">
                          <span>Active Player Weight Coeff</span>
                          <input type="number" step="0.1" min="0" max="1" value={fairnessConfigForm.playerWeightCoeff ?? 0.4}
                            onChange={(e) => setFairnessConfigForm((p) => ({ ...p, playerWeightCoeff: Number(e.target.value) }))}
                            style={{ width: 90 }} />
                        </label>
                        <label className="ac-rule-item">
                          <span>Unused Hours Quota Coeff</span>
                          <input type="number" step="0.1" min="0" max="1" value={fairnessConfigForm.unusedHoursWeightCoeff ?? 0.3}
                            onChange={(e) => setFairnessConfigForm((p) => ({ ...p, unusedHoursWeightCoeff: Number(e.target.value) }))}
                            style={{ width: 90 }} />
                        </label>
                        <label className="ac-rule-item">
                          <span>Prime Time Disadvantage Coeff</span>
                          <input type="number" step="0.1" min="0" max="1" value={fairnessConfigForm.primeTimeDisadvantageCoeff ?? 0.3}
                            onChange={(e) => setFairnessConfigForm((p) => ({ ...p, primeTimeDisadvantageCoeff: Number(e.target.value) }))}
                            style={{ width: 90 }} />
                        </label>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* BOOKINGS TAB */}
              {activeTab === "bookings" && (
                <div className="ac-chart-card">
                  <div className="ac-table-head">
                    <h3 className="ac-chart-title" style={{ margin: 0 }}>All Bookings</h3>
                    <span className="ac-badge-neutral">
                      {bookingSearchQuery ? `${filteredBookings.length} shown / ${bookings.length} total` : `${bookings.length} total`}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
                    <input
                      className="ac-search"
                      type="search"
                      placeholder="🔍 Search by booking ID, student name, ID, email, or facility..."
                      value={bookingSearch}
                      onChange={(e) => setBookingSearch(e.target.value)}
                      style={{ maxWidth: 460, flex: 1 }}
                    />
                    {bookingSearch && (
                      <button
                        className="ac-refresh-btn"
                        type="button"
                        onClick={() => setBookingSearch("")}
                      >
                        Clear Search
                      </button>
                    )}
                  </div>
                  <div className="ac-table-wrap">
                    <table className="ac-table">
                      <thead>
                        <tr>
                          <th>User</th><th>Facility</th><th>Date & Time</th><th>Participants</th><th>Status</th><th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.length === 0 && <tr><td colSpan={6} className="ac-empty">No bookings yet</td></tr>}
                        {bookings.length > 0 && filteredBookings.length === 0 && (
                          <tr><td colSpan={6} className="ac-empty">No bookings match your search.</td></tr>
                        )}
                        {filteredBookings.map(b => (
                          <tr key={b.id}>
                            <td><strong>{b.user?.fullName || "—"}</strong><br /><small style={{ color: "#888" }}>{b.user?.studentId}</small></td>
                            <td>{b.facility?.name || "—"}</td>
                            <td>{new Date(b.startTime).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
                            <td style={{ textAlign: "center" }}>{b.participants}</td>
                            <td><span className={`ac-status-badge ac-status-${b.status.toLowerCase()}`}>{b.status}</span></td>
                            <td>
                              {b.status === "PENDING" && !b.conflictId && (
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button className="btn-approve" onClick={() => handleApprove(b.id)}>✓ Approve</button>
                                  <button className="btn-reject" onClick={() => handleReject(b.id)}>✕ Reject</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* FACILITIES TAB */}
              {activeTab === "facilities" && (
                <div className="ac-chart-card">
                  <div className="ac-table-head">
                    <h3 className="ac-chart-title" style={{ margin: 0 }}>Facility Status Overview</h3>
                    <button className="ac-refresh-btn" onClick={() => navigate("/facilities")}>⚙️ Manage</button>
                  </div>
                  <div className="ac-table-wrap">
                    <table className="ac-table">
                      <thead>
                        <tr><th>Facility</th><th>Category</th><th>Hours</th><th>Capacity</th><th>Availability</th><th>Total Bookings</th></tr>
                      </thead>
                      <tbody>
                        {facilities.map(f => {
                          const STATUS_COLOR = {
                            OPEN: "#10b981",
                            AVAILABLE: "#10b981",
                            MAINTENANCE: "#f59e0b",
                            TOURNAMENT: "#8b5cf6",
                            CLOSED: "#ef4444",
                            UNAVAILABLE: "#ef4444",
                          };
                          const active = f.active ?? f.isActive;
                          const availability = f.status || (active === false ? "UNAVAILABLE" : "AVAILABLE");
                          return (
                            <tr key={f.id}>
                              <td><strong>{f.name}</strong></td>
                              <td><span className="category-badge">{f.category}</span></td>
                              <td>{f.openTime} – {f.closeTime}</td>
                              <td>{f.minParticipants}–{f.maxParticipants} pax</td>
                              <td><span className="status-pill" style={{ background: STATUS_COLOR[availability] + "18", color: STATUS_COLOR[availability], border: `1px solid ${STATUS_COLOR[availability]}` }}>{availability}</span></td>
                              <td style={{ textAlign: "center" }}><strong>{bookings.filter(b => String(getBookingFacilityId(b)) === String(f.id)).length}</strong></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* CONFLICTS TAB */}
              {activeTab === "conflicts" && (
                <div className="ac-chart-card">
                  <div className="ac-table-head">
                    <h3 className="ac-chart-title" style={{ margin: 0 }}>⚔️ Active Conflicts — Admin Decision Required</h3>
                    <span style={{ background: conflicts.length > 0 ? "#fee2e2" : "#d1fae5", color: conflicts.length > 0 ? "#991b1b" : "#065f46", padding: "4px 14px", borderRadius: 20, fontSize: "0.82rem", fontWeight: 800 }}>
                      {conflicts.length > 0 ? `${conflicts.length} unresolved` : "All clear ✅"}
                    </span>
                  </div>

                  {conflicts.length === 0 ? (
                    <div className="ac-empty-state">
                      <div style={{ fontSize: "3rem" }}>✅</div>
                      <p>No active conflicts — the system is running smoothly.</p>
                    </div>
                  ) : conflicts.map(c => (
                    <div key={c.id} className="ac-conflict-card">
                      <div className="ac-conflict-header">
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span className="ac-conflict-badge">⚠️ CONFLICT</span>
                          <span style={{ color: "#ef4444", fontWeight: 700, fontSize: "0.85rem" }}>{c.id.slice(0, 12)}…</span>
                        </div>
                        <span style={{ color: "#9ab0c4", fontSize: "0.82rem" }}>
                          Detected: {new Date(c.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                        </span>
                      </div>

                      <p className="ac-conflict-desc">📍 {c.description}</p>

                      <div className="ac-conflict-info-box">
                        ℹ️ Select which booking to <strong>approve</strong>. The other will be automatically <strong>rejected</strong> and the user will be notified.
                      </div>

                      <div className="ac-conflict-options">
                        {c.bookings?.map((b, idx) => {
                          const other = c.bookings.find(x => x.id !== b.id);
                          const isResolving = resolving === c.id;
                          return (
                            <div key={b.id} className="ac-conflict-option">
                              <div className="ac-conflict-option-header">
                                <span className="ac-conflict-option-num">Option {idx + 1}</span>
                              </div>
                              <div className="ac-conflict-option-body">
                                <div style={{ fontWeight: 800, color: "#0d1b2a", fontSize: "1rem" }}>{b.user?.fullName}</div>
                                <div style={{ color: "#1cb2bf", fontSize: "0.82rem", fontWeight: 700 }}>{b.user?.studentId}</div>
                                <div style={{ fontSize: "0.85rem", color: "#5a6a80", marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                                  <span>📅 {new Date(b.startTime).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                                  <span>👥 {b.participants} participants</span>
                                  <span>🕐 Submitted: {new Date(b.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>
                                </div>
                              </div>
                              <button
                                className="ac-conflict-approve-btn"
                                disabled={isResolving || !other}
                                onClick={() => other && handleResolve(c.id, b.id, other.id)}
                              >
                                {isResolving ? "Processing…" : "✓ Approve This Booking"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* AUDIT LOG TAB — Advanced */}
              {activeTab === "auditlog" && (
                <div className="ac-chart-card">
                  <div className="ac-table-head">
                    <div>
                      <h3 className="ac-chart-title" style={{ margin: 0 }}>📋 Administrative Audit Log</h3>
                      <p style={{ margin: "8px 0 0", fontSize: "0.85rem", color: "#5a6a80" }}>Track all admin actions: approvals, rejections, conflicts, user discipline, facility changes</p>
                    </div>
                    <button
                      className="ac-refresh-btn"
                      onClick={() => {
                        const csv = [
                          ["Timestamp", "Admin", "Action", "Details", "IP Address"],
                          ...auditLogs.map(log => [
                            new Date(log.createdAt).toLocaleString("en-GB"),
                            log.admin?.fullName || "Unknown",
                            log.action,
                            log.details,
                            log.ipAddress
                          ])
                        ].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
                        a.click();
                      }}
                    >
                      📥 Export CSV
                    </button>
                  </div>

                  {/* Filter & Search */}
                  <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                    <select
                      value={auditFilter}
                      onChange={(e) => {
                        setAuditFilter(e.target.value);
                        fetchAuditLogs(0, e.target.value);
                      }}
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #e1eaf5",
                        borderRadius: 8,
                        fontSize: "0.9rem",
                        backgroundColor: "#fff",
                        cursor: "pointer"
                      }}
                    >
                      <option value="">All Actions</option>
                      <option value="BOOKING_APPROVED">✓ Booking Approved</option>
                      <option value="BOOKING_REJECTED">✕ Booking Rejected</option>
                      <option value="CONFLICT_RESOLVED">⚔️ Conflict Resolved</option>
                      <option value="USER_WARNED">⚠️ User Warned</option>
                      <option value="USER_BANNED">🚫 User Banned</option>
                      <option value="USER_UNBANNED">✓ User Unbanned</option>
                      <option value="FACILITY_CREATED">🏟️ Facility Created</option>
                      <option value="FACILITY_UPDATED">🔧 Facility Updated</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Search admin name or IP address..."
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: 200,
                        padding: "8px 12px",
                        border: "1px solid #e1eaf5",
                        borderRadius: 8,
                        fontSize: "0.9rem"
                      }}
                    />
                  </div>

                  {/* Logs Table */}
                  <div className="ac-table-wrap">
                    <table className="ac-table">
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Admin</th>
                          <th>Action</th>
                          <th>Details</th>
                          <th>IP Address</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.length === 0 && (
                          <tr><td colSpan={5} className="ac-empty">No audit logs yet. Admin actions will be recorded here.</td></tr>
                        )}
                        {auditLogs
                          .filter(log =>
                            !auditSearch ||
                            log.admin?.fullName?.toLowerCase().includes(auditSearch.toLowerCase()) ||
                            log.ipAddress?.includes(auditSearch)
                          )
                          .map(log => {
                            let details = {};
                            try { details = JSON.parse(log.details || "{}"); } catch { }

                            const actionColors = {
                              BOOKING_APPROVED: { bg: "#d1fae5", color: "#065f46", icon: "✅" },
                              BOOKING_REJECTED: { bg: "#fee2e2", color: "#991b1b", icon: "✕" },
                              CONFLICT_RESOLVED: { bg: "#dbeafe", color: "#1e40af", icon: "⚔️" },
                              USER_WARNED: { bg: "#fef3c7", color: "#92400e", icon: "⚠️" },
                              USER_BANNED: { bg: "#fee2e2", color: "#991b1b", icon: "🚫" },
                              USER_UNBANNED: { bg: "#d1fae5", color: "#065f46", icon: "✓" },
                              FACILITY_CREATED: { bg: "#e0e7ff", color: "#3730a3", icon: "➕" },
                              FACILITY_UPDATED: { bg: "#f3e8ff", color: "#6b21a8", icon: "🔧" },
                            };
                            const cfg = actionColors[log.action] || { bg: "#e5e7eb", color: "#374151", icon: "•" };

                            return (
                              <tr key={log.id}>
                                <td style={{ fontSize: "0.82rem", color: "#5a6a80", whiteSpace: "nowrap" }}>
                                  {new Date(log.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                                </td>
                                <td>
                                  <strong>{log.admin?.fullName || "Unknown Admin"}</strong>
                                  <div style={{ fontSize: "0.75rem", color: "#9ab0c4" }}>{log.admin?.studentId}</div>
                                </td>
                                <td>
                                  <span style={{ background: cfg.bg, color: cfg.color, padding: "4px 10px", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                                    {cfg.icon} {log.action.replace(/_/g, " ")}
                                  </span>
                                </td>
                                <td style={{ fontSize: "0.82rem", color: "#5a6a80", maxWidth: 250 }}>
                                  {Object.entries(details).map(([k, v]) => (
                                    <div key={k}>
                                      <strong>{k}:</strong> {String(v).slice(0, 30)}{String(v).length > 30 ? "…" : ""}
                                    </div>
                                  ))}
                                  {Object.keys(details).length === 0 && "—"}
                                </td>
                                <td style={{ fontSize: "0.75rem", color: "#9ab0c4", fontFamily: "monospace" }}>
                                  {log.ipAddress}
                                </td>
                              </tr>
                            );
                          })
                        }
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {auditTotal > 50 && (
                    <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
                      <button
                        disabled={auditPage === 0}
                        onClick={() => fetchAuditLogs(auditPage - 1, auditFilter)}
                        style={{
                          padding: "8px 14px",
                          border: "1px solid #e1eaf5",
                          borderRadius: 6,
                          cursor: auditPage === 0 ? "default" : "pointer",
                          opacity: auditPage === 0 ? 0.5 : 1,
                          backgroundColor: "#fff"
                        }}
                      >
                        ← Previous
                      </button>
                      <span style={{ padding: "8px 14px", color: "#5a6a80", fontSize: "0.9rem" }}>
                        Page {auditPage + 1} of {Math.ceil(auditTotal / 50)}
                      </span>
                      <button
                        disabled={(auditPage + 1) * 50 >= auditTotal}
                        onClick={() => fetchAuditLogs(auditPage + 1, auditFilter)}
                        style={{
                          padding: "8px 14px",
                          border: "1px solid #e1eaf5",
                          borderRadius: 6,
                          cursor: (auditPage + 1) * 50 >= auditTotal ? "default" : "pointer",
                          opacity: (auditPage + 1) * 50 >= auditTotal ? 0.5 : 1,
                          backgroundColor: "#fff"
                        }}
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* MEDICAL CLEARANCE TAB */}
              {activeTab === "medical" && (
                <div className="ac-chart-card">
                  {/* Summary Cards */}
                  <div className="ac-stats-grid" style={{ marginBottom: 20 }}>
                    <StatCard icon="👥" label="Total Athletes" value={athletesCompliance.length} color="#3b82f6" />
                    <StatCard icon="✅" label="Compliant Athletes" value={athletesCompliance.filter(a => a.complianceStatus === "COMPLIANT").length} color="#10b981" />
                    <StatCard icon="⏳" label="Pending Reviews" value={athletesCompliance.filter(a => a.complianceStatus === "PENDING_REVIEW").length} color="#f59e0b" alert />
                    <StatCard icon="❌" label="Non-Compliant" value={athletesCompliance.filter(a => a.complianceStatus === "NON_COMPLIANT").length} color="#ef4444" />
                  </div>

                  <div className="ac-table-head" style={{ marginBottom: 16 }}>
                    <div>
                      <h3 className="ac-chart-title" style={{ margin: 0 }}>Athlete Medical Compliance Manager</h3>
                      <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                        <span className="ac-badge-neutral">{athletesCompliance.length} athletes</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <select
                        value={medicalFilter}
                        onChange={(e) => setMedicalFilter(e.target.value)}
                        style={{
                          padding: "8px 12px",
                          border: "1px solid #e1eaf5",
                          borderRadius: 8,
                          fontSize: "0.9rem",
                          backgroundColor: "var(--ac-card-bg, #fff)"
                        }}
                      >
                        <option value="all">All Statuses</option>
                        <option value="COMPLIANT">Compliant Only</option>
                        <option value="PENDING_REVIEW">Pending Review Only</option>
                        <option value="NON_COMPLIANT">Non-Compliant Only</option>
                      </select>

                      <input
                        className="ac-search"
                        placeholder="🔍 Search athlete by name or ID..."
                        value={medicalSearch}
                        onChange={e => setMedicalSearch(e.target.value)}
                        style={{ margin: 0 }}
                      />
                    </div>
                  </div>

                  {athletesLoading ? (
                    <div className="ac-loading" style={{ padding: 40 }}>
                      <div className="ac-spinner" />
                      <p>Loading athlete compliance records...</p>
                    </div>
                  ) : (
                    <div className="ac-table-wrap">
                      <table className="ac-table">
                        <thead>
                          <tr>
                            <th>Student Athlete</th>
                            <th>Email Address</th>
                            <th>Total Documents</th>
                            <th>Last Submission</th>
                            <th>Compliance Status</th>
                            <th style={{ minWidth: 200 }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {athletesCompliance
                            .filter(a => {
                              const matchSearch = a.fullName?.toLowerCase().includes(medicalSearch.toLowerCase()) ||
                                a.studentId?.toLowerCase().includes(medicalSearch.toLowerCase());
                              const matchFilter = medicalFilter === "all" || a.complianceStatus === medicalFilter;
                              return matchSearch && matchFilter;
                            })
                            .map(a => {
                              const dateStr = a.lastUpdated ? new Date(a.lastUpdated).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' }) : "No submissions";
                              
                              let statusClass = "ac-status-pending";
                              let statusIcon = "⏳";
                              if (a.complianceStatus === "COMPLIANT") {
                                statusClass = "ac-status-confirmed";
                                statusIcon = "✅";
                              } else if (a.complianceStatus === "NON_COMPLIANT") {
                                statusClass = "ac-status-rejected";
                                statusIcon = "❌";
                              }

                              return (
                                <tr key={a.userId}>
                                  <td>
                                    <div style={{ fontWeight: 700 }}>{a.fullName}</div>
                                    <div style={{ fontSize: "0.8rem", color: "#888" }}>ID: {a.studentId || "Student"}</div>
                                  </td>
                                  <td style={{ fontSize: "0.85rem", color: "#5a6a80" }}>{a.email}</td>
                                  <td style={{ textAlign: "center", fontWeight: 700 }}>{a.recordsCount}</td>
                                  <td style={{ fontSize: "0.85rem", color: "#5a6a80" }}>{dateStr}</td>
                                  <td>
                                    <span className={`ac-status-badge ${statusClass}`}>
                                      {statusIcon} {a.complianceStatus.replace(/_/g, " ")}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="ac-action-row">
                                      <button
                                        className="ac-action-btn warn"
                                        onClick={() => {
                                          setSelectedAthlete(a);
                                          fetchAthleteHistory(a.userId);
                                          setShowHistoryModal(true);
                                        }}
                                        title="View History Timeline"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                      >
                                        🔍 View History
                                      </button>
                                      <button
                                        className="ac-action-btn unban"
                                        onClick={() => {
                                          setSelectedAthlete(a);
                                          setOnBehalfForm({ documentName: "", description: "", documentUrl: "" });
                                          setShowUploadOnBehalfModal(true);
                                        }}
                                        title="Upload Clearance Report"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#10b981', color: '#fff' }}
                                      >
                                        ➕ Upload Report
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          }
                          {athletesCompliance.filter(a => {
                            const matchSearch = a.fullName?.toLowerCase().includes(medicalSearch.toLowerCase()) ||
                              a.studentId?.toLowerCase().includes(medicalSearch.toLowerCase());
                            const matchFilter = medicalFilter === "all" || a.complianceStatus === medicalFilter;
                            return matchSearch && matchFilter;
                          }).length === 0 && (
                            <tr><td colSpan={6} className="ac-empty">No student athletes match your search or filter.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ATTENDANCE TAB */}
              {activeTab === "attendance" && (
                <div className="ac-chart-card">
                  <div className="ac-table-head" style={{ marginBottom: 16 }}>
                    <div>
                      <h3 className="ac-chart-title" style={{ margin: 0 }}>📍 Attendance & Geofencing</h3>
                      <p style={{ margin: "8px 0 0", fontSize: "0.85rem", color: "#5a6a80" }}>
                        Monitor no-shows, check-ins, and out-of-range attendance attempts.
                      </p>
                    </div>
                    <button className="ac-refresh-btn" onClick={exportAttendanceCsv}>
                      📥 Export Current View
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                    <select
                      value={attendanceFacilityFilter}
                      onChange={(e) => setAttendanceFacilityFilter(e.target.value)}
                      style={{ padding: "8px 10px", border: "1px solid #e1eaf5", borderRadius: 8, minWidth: 180 }}
                    >
                      <option value="all">All facilities</option>
                      {facilities.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>

                    <select
                      value={attendanceDateRange}
                      onChange={(e) => setAttendanceDateRange(e.target.value)}
                      style={{ padding: "8px 10px", border: "1px solid #e1eaf5", borderRadius: 8, minWidth: 140 }}
                    >
                      <option value="all">All dates</option>
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
                    </select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 20 }}>
                    <StatCard icon="📊" label="Total Bookings" value={attendanceStats.totalBookings} sub="All records" color="#0f766e" />
                    <StatCard icon="✅" label="Check-in Rate" value={`${attendanceStats.checkInRate}%`} sub={`${attendanceStats.checkedInCount} checked-in`} color="#10b981" />
                    <StatCard icon="⚠️" label="No-Show Rate" value={`${attendanceStats.noShowRate}%`} sub={`${attendanceStats.noShowCount} no-shows`} color="#ef4444" alert />
                    <StatCard icon="📍" label="Geofence Alerts" value={geofenceAlerts.length} sub="Out-of-range" color="#f59e0b" alert />
                    <StatCard icon="🟢" label="Inside Field Now" value={insideNowCount} sub={`${livePresenceBookings.length} checked-in`} color="#22c55e" />
                    <StatCard icon="🔴" label="Outside Field Now" value={outsideNowCount} sub="Need follow-up" color="#ef4444" alert />
                  </div>

                  <div className="ac-table-wrap" style={{ marginBottom: 14 }}>
                    <table className="ac-table">
                      <thead>
                        <tr>
                          <th colSpan={6}>🛰️ Live Presence Snapshot (Auto-refresh every 30s)</th>
                        </tr>
                        <tr>
                          <th>Student</th>
                          <th>Student ID</th>
                          <th>Facility</th>
                          <th>Checked-in At</th>
                          <th>Distance (m)</th>
                          <th>In Field?</th>
                        </tr>
                      </thead>
                      <tbody>
                        {livePresenceBookings.length === 0 && (
                          <tr><td colSpan={6} className="ac-empty">No students currently checked-in.</td></tr>
                        )}
                        {livePresenceBookings.slice(0, 20).map((b) => {
                          const distanceM = typeof b.distanceFromFacility === "number" ? Math.round(b.distanceFromFacility * 1000) : "—";
                          const inside = b.presenceStatus === "inside";
                          const outside = b.presenceStatus === "outside";
                          return (
                            <tr key={b.id}>
                              <td>{b.user?.fullName || "—"}</td>
                              <td>{b.user?.studentId || "—"}</td>
                              <td>{b.facility?.name || "—"}</td>
                              <td>{b.checkedInAt ? new Date(b.checkedInAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                              <td>{distanceM}</td>
                              <td>
                                {inside && <span className="ac-status-badge ac-status-confirmed">داخل الملعب</span>}
                                {outside && <span className="ac-status-badge ac-status-rejected">خارج الملعب</span>}
                                {!inside && !outside && <span className="ac-status-badge ac-status-pending">غير معروف</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ borderBottom: "1px solid #e1eaf5", marginBottom: 14, display: "flex", gap: 8 }}>
                    <button
                      className={`ac-refresh-btn ${activeAttendanceView === "noshow" ? "active" : ""}`}
                      onClick={() => setActiveAttendanceView("noshow")}
                    >
                      ⚠️ No-Shows ({noShowBookings.length})
                    </button>
                    <button
                      className={`ac-refresh-btn ${activeAttendanceView === "geofence" ? "active" : ""}`}
                      onClick={() => setActiveAttendanceView("geofence")}
                    >
                      📍 Geofence Violations ({geofenceAlerts.length})
                    </button>
                  </div>

                  <div className="ac-table-wrap" style={{ marginBottom: 14 }}>
                    <table className="ac-table">
                      <thead>
                        <tr>
                          <th colSpan={4}>🚨 High-Risk Students (No-show frequency)</th>
                        </tr>
                        <tr>
                          <th>Student</th>
                          <th>Student ID</th>
                          <th>No-shows</th>
                          <th>Latest</th>
                        </tr>
                      </thead>
                      <tbody>
                        {highRiskList.length === 0 && (
                          <tr><td colSpan={4} className="ac-empty">No repeated no-show pattern detected.</td></tr>
                        )}
                        {highRiskList.map((s) => (
                          <tr key={s.id}>
                            <td>{s.name}</td>
                            <td>{s.studentId}</td>
                            <td><strong style={{ color: s.noShows >= 2 ? "#ef4444" : "#92400e" }}>{s.noShows}</strong></td>
                            <td>{new Date(s.latest).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {activeAttendanceView === "noshow" && (
                    <div className="ac-table-wrap">
                      <table className="ac-table">
                        <thead>
                          <tr>
                            <th>Booking ID</th>
                            <th>Student</th>
                            <th>Facility</th>
                            <th>Start Time</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {noShowBookings.length === 0 && (
                            <tr><td colSpan={5} className="ac-empty">No no-show records.</td></tr>
                          )}
                          {noShowBookings.map(b => (
                            <tr key={b.id}>
                              <td>#{String(b.id).slice(-6)}</td>
                              <td>{b.user?.fullName || "—"}</td>
                              <td>{b.facility?.name || "—"}</td>
                              <td>{new Date(b.startTime).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
                              <td>
                                <span className="ac-status-badge ac-status-rejected">NO_SHOW</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeAttendanceView === "geofence" && (
                    <div className="ac-table-wrap">
                      <table className="ac-table">
                        <thead>
                          <tr>
                            <th>Booking ID</th>
                            <th>Student</th>
                            <th>Facility</th>
                            <th>Distance (m)</th>
                            <th>Allowed (m)</th>
                            <th>Exceeded (m)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {geofenceAlerts.length === 0 && (
                            <tr><td colSpan={6} className="ac-empty">No geofence violations.</td></tr>
                          )}
                          {geofenceAlerts.map(b => {
                            const distanceM = Math.round((b.distanceFromFacility || 0) * 1000);
                            const allowedM = Math.min(Math.round((b.facility?.geofencingRadius ?? 0.004) * 1000), 4);
                            return (
                              <tr key={b.id}>
                                <td>#{String(b.id).slice(-6)}</td>
                                <td>{b.user?.fullName || "—"}</td>
                                <td>{b.facility?.name || "—"}</td>
                                <td>{distanceM}</td>
                                <td>{allowedM}</td>
                                <td style={{ color: "#ef4444", fontWeight: 700 }}>{Math.max(0, distanceM - allowedM)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* USERS TAB */}
              {activeTab === "users" && (
                <div className="ac-chart-card">
                  <div className="ac-table-head" style={{ marginBottom: 16 }}>
                    <div>
                      <h3 className="ac-chart-title" style={{ margin: 0 }}>All Users</h3>
                      <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                        <span className="ac-badge-neutral">{users.length} total</span>
                        <span style={{ background: "#fef3c7", color: "#92400e", padding: "4px 12px", borderRadius: 20, fontSize: "0.82rem", fontWeight: 700 }}>
                          {users.filter(u => u.warnings > 0).length} warned
                        </span>
                        <span style={{ background: "#fee2e2", color: "#991b1b", padding: "4px 12px", borderRadius: 20, fontSize: "0.82rem", fontWeight: 700 }}>
                          {users.filter(u => u.isBanned).length} banned
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <button
                        className="ac-refresh-btn"
                        style={{
                          background: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
                          color: "#fff",
                          border: "none",
                          padding: "8px 16px",
                          borderRadius: 8,
                          fontWeight: "bold",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          boxShadow: "0 4px 6px -1px rgba(139, 92, 246, 0.2)"
                        }}
                        onClick={async () => {
                          if (window.confirm("Are you sure you want to replenish/reset ALL student credits back to their weekly default of 10?")) {
                            try {
                              const res = await fetch(`${API}/api/users/admin/reset-all-credits`, {
                                method: 'POST',
                                headers
                              });
                              const data = await res.json();
                              if (res.ok) {
                                alert(`Successfully reset credits for students! Updated count: ${data.updatedCount}`);
                                fetchAll();
                              } else {
                                alert(data.error || "Failed to reset credits.");
                              }
                            } catch (err) {
                              alert("Failed to reset credits: " + err.message);
                            }
                          }
                        }}
                      >
                        🔄 Reset All Credits to Default (10)
                      </button>
                      <input
                        className="ac-search"
                        placeholder="🔍 Search by name, ID, or email..."
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        style={{ margin: 0 }}
                      />
                    </div>
                  </div>

                  <div className="ac-table-wrap">
                    <table className="ac-table">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Warnings</th>
                          <th>Credits</th>
                          <th>Status</th>
                          <th>Device Status</th>
                          <th>Bookings</th>
                          <th style={{ minWidth: 260 }}>Disciplinary Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.length === 0 && (
                          <tr><td colSpan={9} className="ac-empty">No users found</td></tr>
                        )}
                        {filteredUsers.map(u => {
                          const ua = userAction[u.id] || {};
                          const userBookings = bookings.filter(b => String(getBookingUserId(b)) === String(u.id)).length;
                          return (
                            <tr key={u.id} className={u.isBanned ? "ac-row-banned" : ""}>
                              <td>
                                <div style={{ fontWeight: 700 }}>{u.fullName}</div>
                                <div style={{ fontSize: "0.8rem", color: "#888" }}>{u.studentId}</div>
                              </td>
                              <td style={{ fontSize: "0.85rem", color: "#5a6a80" }}>{u.email}</td>
                              <td>
                                <span className="ac-role-badge" data-role={u.role}>{u.role}</span>
                              </td>
                              <td>
                                <div className="ac-warnings-bar">
                                  <span className={`ac-warning-count ${u.warnings > 0 ? "has-warnings" : ""}`}>
                                    {u.warnings}
                                  </span>
                                  <div className="ac-warning-pips">
                                    {[0, 1, 2].map(i => (
                                      <div key={i} className={`ac-pip ${i < u.warnings ? "filled" : ""}`} />
                                    ))}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontWeight: 800, minWidth: 20, textAlign: 'center' }}>
                                    {u.credits !== undefined && u.credits !== null ? u.credits : 10}
                                  </span>
                                  <button
                                    onClick={async () => {
                                      const current = u.credits !== undefined && u.credits !== null ? u.credits : 10;
                                      const val = prompt(`Adjust credits for ${u.fullName}:\nEnter new credit balance (current: ${current}):`, current);
                                      if (val !== null) {
                                        const newCredits = parseInt(val, 10);
                                        if (isNaN(newCredits) || newCredits < 0) {
                                          alert("Please enter a valid positive number.");
                                          return;
                                        }
                                        try {
                                          const res = await fetch(`${API}/api/users/admin/${u.id}/adjust-credits`, {
                                            method: 'POST',
                                            headers: { ...headers, 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ credits: newCredits })
                                          });
                                          const data = await res.json();
                                          if (res.ok) {
                                            alert("Credits adjusted successfully!");
                                            fetchAll();
                                          } else {
                                            alert(data.error || "Failed to adjust credits.");
                                          }
                                        } catch (err) {
                                          alert("Failed to adjust credits: " + err.message);
                                        }
                                      }
                                    }}
                                    style={{
                                      background: '#f0f4f8',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: 6,
                                      padding: '2px 6px',
                                      fontSize: '0.75rem',
                                      cursor: 'pointer',
                                      fontWeight: 'bold'
                                    }}
                                    title="Adjust Credits"
                                  >
                                    ✏️ Adjust
                                  </button>
                                </div>
                              </td>
                              <td>
                                {u.isBanned ? (
                                  <span className="ac-status-badge ac-status-rejected">🔒 BANNED</span>
                                ) : (
                                  <span className="ac-status-badge ac-status-confirmed">✅ ACTIVE</span>
                                )}
                              </td>
                              <td>
                                {u.role === "STUDENT" ? (
                                  u.deviceChangeStatus === "PENDING" || u.deviceChangeStatus === "SUMMONED" ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                                      {u.deviceChangeStatus === "PENDING" ? (
                                        <span className="ac-status-badge" style={{ fontSize: '0.8rem', padding: '4px 8px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', fontWeight: 'bold', animation: 'pulse 2s infinite' }}>⚠️ Pending Device Request</span>
                                      ) : (
                                        <span className="ac-status-badge" style={{ fontSize: '0.8rem', padding: '4px 8px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: '#fff', fontWeight: 'bold' }}>📞 Student Summoned</span>
                                      )}
                                      <div style={{ display: 'flex', gap: 4 }}>
                                        <button
                                          onClick={async () => {
                                            if (window.confirm(`Are you sure you want to approve the device change request for student ${u.fullName}?\nTheir new device will be immediately bound.`)) {
                                              try {
                                                const res = await fetch(`${API}/api/users/admin/${u.id}/approve-device-change`, {
                                                  method: 'POST',
                                                  headers
                                                });
                                                if (res.ok) {
                                                  alert("Request approved successfully and new device activated!");
                                                  fetchAll();
                                                } else {
                                                  const data = await res.json();
                                                  alert(data.error || "Failed to approve request.");
                                                }
                                              } catch (err) {
                                                alert("Error: " + err.message);
                                              }
                                            }
                                          }}
                                          style={{ background: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: 4, padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold' }}
                                          title="Approve request and bind new device"
                                        >
                                          ✅ Approve
                                        </button>
                                        <button
                                          onClick={async () => {
                                            if (window.confirm(`Are you sure you want to reject the device change request for student ${u.fullName}?`)) {
                                              try {
                                                const res = await fetch(`${API}/api/users/admin/${u.id}/reject-device-change`, {
                                                  method: 'POST',
                                                  headers
                                                });
                                                if (res.ok) {
                                                  alert("Request rejected successfully!");
                                                  fetchAll();
                                                } else {
                                                  const data = await res.json();
                                                  alert(data.error || "Failed to reject request.");
                                                }
                                              } catch (err) {
                                                alert("Error: " + err.message);
                                              }
                                            }
                                          }}
                                          style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: 4, padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold' }}
                                          title="Reject device change request"
                                        >
                                          ❌ Reject
                                        </button>
                                      </div>
                                      {u.deviceChangeStatus === "PENDING" && (
                                        <button
                                          onClick={async () => {
                                            if (window.confirm(`Do you want to summon the student to the Athletic Office personally for verification?\nAn immediate summons email will be sent.`)) {
                                              try {
                                                const res = await fetch(`${API}/api/users/admin/${u.id}/summon-device-change`, {
                                                  method: 'POST',
                                                  headers
                                                });
                                                if (res.ok) {
                                                  alert("Summons email successfully sent to the student!");
                                                  fetchAll();
                                                } else {
                                                  const data = await res.json();
                                                  alert(data.error || "Failed to summon student.");
                                                }
                                              } catch (err) {
                                                alert("Error: " + err.message);
                                              }
                                            }
                                          }}
                                          style={{ background: '#dbeafe', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: 4, padding: '2px 8px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}
                                          title="Summon student personally"
                                        >
                                          📞 Summon Student
                                        </button>
                                      )}
                                    </div>
                                  ) : u.deviceId ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                                      <span className="ac-status-badge ac-status-confirmed" style={{ fontSize: '0.8rem', padding: '4px 8px' }}>📱 Bound</span>
                                      <button
                                        onClick={async () => {
                                          if (window.confirm(`Are you sure you want to unbind the device for student ${u.fullName}?\nThey will need to register their new device upon next login.`)) {
                                            try {
                                              const res = await fetch(`${API}/api/users/admin/${u.id}/reset-device`, {
                                                method: 'POST',
                                                headers
                                              });
                                              const data = await res.json();
                                              if (res.ok) {
                                                alert("Device unbound successfully!");
                                                fetchAll();
                                              } else {
                                                alert(data.error || "Failed to unbind device.");
                                              }
                                            } catch (err) {
                                              alert("Error unbinding device: " + err.message);
                                            }
                                          }
                                        }}
                                        style={{
                                          background: '#fee2e2',
                                          border: '1px solid #fca5a5',
                                          color: '#991b1b',
                                          borderRadius: 6,
                                          padding: '2px 8px',
                                          fontSize: '0.72rem',
                                          cursor: 'pointer',
                                          fontWeight: 'bold',
                                          width: 'auto',
                                          whiteSpace: 'nowrap'
                                        }}
                                        title="Unbind device"
                                      >
                                        🔄 Unbind Device
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="ac-status-badge ac-status-pending" style={{ fontSize: '0.8rem', background: '#f1f5f9', color: '#64748b' }}>Unbound</span>
                                  )
                                ) : (
                                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>—</span>
                                )}
                              </td>
                              <td style={{ textAlign: "center" }}>{userBookings}</td>
                              <td>
                                {ua.success && <div style={{ color: "#10b981", fontWeight: 700, fontSize: "0.85rem" }}>✓ Done</div>}
                                {ua.error && <div style={{ color: "#ef4444", fontSize: "0.8rem", marginBottom: 4 }}>⚠ {ua.error}</div>}
                                {!ua.success && (
                                  <div className="ac-action-row">
                                    <button
                                      className="ac-action-btn warn"
                                      disabled={ua.loading || u.isBanned}
                                      onClick={() => doUserAction(u.id, "warn")}
                                      title="Issue Warning"
                                    >
                                      {ua.loading ? "..." : "⚠️ Warn"}
                                    </button>
                                    {!u.isBanned ? (
                                      <button
                                        className="ac-action-btn ban"
                                        disabled={ua.loading}
                                        onClick={() => doUserAction(u.id, "ban")}
                                        title="Ban User"
                                      >
                                        🔒 Ban
                                      </button>
                                    ) : (
                                      <button
                                        className="ac-action-btn unban"
                                        disabled={ua.loading}
                                        onClick={() => doUserAction(u.id, "unban")}
                                        title="Remove Ban"
                                      >
                                        🔓 Unban
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* View Medical History Timeline Modal */}
      {showHistoryModal && selectedAthlete && (
        <div className="sd-modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="sd-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <button className="sd-modal-close" onClick={() => setShowHistoryModal(false)}>✕</button>
            <h2 className="sd-modal-title">⚕️ Clearance History: {selectedAthlete.fullName}</h2>
            <p className="sd-modal-sub">Compliance status and chronological records</p>
            
            <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '8px', margin: '16px 0' }}>
              {athleteHistory.length === 0 ? (
                <div className="sd-empty" style={{ padding: '24px 0' }}>
                  <h3>No documents submitted yet.</h3>
                  <p>This student does not have any recorded medical clearance submissions.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {athleteHistory.map(r => (
                    <div 
                      key={r.id} 
                      style={{ 
                        border: '1px solid #e2e8f0', 
                        borderRadius: 12, 
                        padding: 16, 
                        background: '#f8fafc',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '1rem', color: '#1e293b' }}>📄 {r.documentName}</strong>
                        <span className="sd-status-badge" style={{
                          background: r.status === "APPROVED" ? "#d1fae5" : r.status === "PENDING" ? "#fef3c7" : "#fee2e2",
                          color: r.status === "APPROVED" ? "#10b981" : r.status === "PENDING" ? "#f59e0b" : "#ef4444",
                          padding: "4px 10px",
                          borderRadius: 6,
                          fontWeight: 700,
                          fontSize: '0.8rem'
                        }}>
                          {r.status}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: 12, fontSize: '0.82rem', color: '#64748b' }}>
                        <span>📅 Submitted: {new Date(r.createdAt).toLocaleString()}</span>
                        <span>👤 By: {r.submittedBy}</span>
                      </div>

                      <p style={{ fontSize: '0.88rem', color: '#334155', background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #f1f5f9', margin: '4px 0' }}>
                        {r.description || "No notes provided."}
                      </p>

                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                        <a 
                          href={r.documentUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="sd-view-conflict"
                          style={{ textDecoration: 'none', display: 'inline-block', padding: '4px 12px', fontSize: '0.82rem' }}
                          onClick={(e) => {
                            e.preventDefault();
                            alert(`Downloading simulated file: ${r.documentName}\nPath: ${r.documentUrl}`);
                          }}
                        >
                          📥 Download Document
                        </a>

                        {r.status === "PENDING" && (
                          <button
                            className="ac-action-btn warn"
                            style={{ margin: 0, padding: '4px 12px', fontSize: '0.82rem' }}
                            onClick={() => {
                              setSelectedRecordToReview(r);
                              setComplianceStatusInput("APPROVED");
                              setComplianceNote("");
                              setShowComplianceModal(true);
                            }}
                          >
                            ⚖️ Review Document
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="sd-close-btn" onClick={() => setShowHistoryModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Compliance Approval / Rejection Review Modal */}
      {showComplianceModal && selectedRecordToReview && (
        <div className="sd-modal-overlay" onClick={() => setShowComplianceModal(false)}>
          <div className="sd-modal" onClick={e => e.stopPropagation()} style={{ zIndex: 3000 }}>
            <button className="sd-modal-close" onClick={() => setShowComplianceModal(false)}>✕</button>
            <h2 className="sd-modal-title">⚖️ Review Document</h2>
            <p className="sd-modal-sub">Verify clearance credentials for: {selectedRecordToReview.documentName}</p>
            
            {complianceSuccess ? (
              <div className="sd-feedback-success" style={{ margin: 0, padding: 16 }}>{complianceSuccess}</div>
            ) : (
              <div className="sd-feedback-form">
                {complianceError && <div className="sd-feedback-error">{complianceError}</div>}
                
                <label>Clearance decision
                  <select 
                    className="sd-fb-input" 
                    value={complianceStatusInput} 
                    onChange={e => setComplianceStatusInput(e.target.value)}
                  >
                    <option value="APPROVED">APPROVE clearance document ✅</option>
                    <option value="REJECTED">REJECT clearance document ❌</option>
                  </select>
                </label>

                <label>Review Note / Reason
                  <textarea 
                    className="sd-fb-input" 
                    rows={4} 
                    placeholder="Enter approval details or rejection reasons..." 
                    value={complianceNote} 
                    onChange={e => setComplianceNote(e.target.value)} 
                  />
                </label>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                  <button 
                    className="sd-close-btn" 
                    onClick={() => setShowComplianceModal(false)}
                    disabled={updatingCompliance}
                  >
                    Cancel
                  </button>
                  <button 
                    className="sd-fb-submit" 
                    style={{ margin: 0, width: 'auto', padding: '8px 16px' }}
                    onClick={() => handleUpdateCompliance(selectedRecordToReview.id)}
                    disabled={updatingCompliance}
                  >
                    {updatingCompliance ? "Submitting decision..." : "Submit Review Decision"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Medical clearance on Behalf Modal */}
      {showUploadOnBehalfModal && selectedAthlete && (
        <div className="sd-modal-overlay" onClick={() => { if (!onBehalfUploading) setShowUploadOnBehalfModal(false); }}>
          <div className="sd-modal" onClick={e => e.stopPropagation()}>
            <button className="sd-modal-close" onClick={() => { if (!onBehalfUploading) setShowUploadOnBehalfModal(false); }}>✕</button>
            <h2 className="sd-modal-title">⚕️ Upload clearance on Behalf</h2>
            <p className="sd-modal-sub">Submit physician document directly for: {selectedAthlete.fullName}</p>
            
            {complianceSuccess ? (
              <div className="sd-feedback-success" style={{ margin: 0, padding: 16 }}>{complianceSuccess}</div>
            ) : (
              <form onSubmit={handleUploadOnBehalf} className="sd-feedback-form">
                {complianceError && <div className="sd-feedback-error">{complianceError}</div>}
                
                <label>Clearance Certificate (PDF or Image)
                  {!onBehalfFile ? (
                    <div 
                      className={`sd-dropzone ${onBehalfDragOver ? "dragover" : ""}`}
                      onDragOver={e => { e.preventDefault(); setOnBehalfDragOver(true); }}
                      onDragLeave={() => setOnBehalfDragOver(false)}
                      onDrop={e => {
                        e.preventDefault();
                        setOnBehalfDragOver(false);
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          handleOnBehalfFileSelect(e.dataTransfer.files[0]);
                        }
                      }}
                      onClick={() => document.getElementById("admin-clearance-file-input").click()}
                    >
                      <span className="sd-dropzone-icon">📁</span>
                      <span className="sd-dropzone-text">Drag & drop physician clearance here</span>
                      <span className="sd-dropzone-subtext">or click to browse from your device</span>
                      <span className="sd-dropzone-subtext" style={{ fontSize: '0.68rem', color: '#a0aec0' }}>Supports PDF, PNG, JPG (Max 5MB)</span>
                      <input 
                        id="admin-clearance-file-input"
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                        style={{ display: "none" }}
                        onChange={e => {
                          if (e.target.files && e.target.files[0]) {
                            handleOnBehalfFileSelect(e.target.files[0]);
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="sd-file-preview">
                      <div className="sd-file-info">
                        <span className="sd-file-icon">{onBehalfFile.name.endsWith(".pdf") ? "📄" : "🖼️"}</span>
                        <span className="sd-file-name" title={onBehalfFile.name}>{onBehalfFile.name}</span>
                        <span style={{ fontSize: '0.72rem', color: '#888' }}>({(onBehalfFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                      </div>
                      <button 
                        type="button" 
                        className="sd-file-remove" 
                        onClick={() => { setOnBehalfFile(null); setOnBehalfForm(p => ({ ...p, documentName: "", documentUrl: "" })); }}
                        disabled={onBehalfUploading}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </label>

                {onBehalfUploading && onBehalfProgress > 0 && (
                  <div className="sd-progress-container">
                    <div className="sd-progress-label">
                      <span>Simulating secure upload...</span>
                      <span>{onBehalfProgress}%</span>
                    </div>
                    <div className="sd-progress-bg">
                      <div className="sd-progress-fill" style={{ width: `${onBehalfProgress}%` }}></div>
                    </div>
                  </div>
                )}

                <label>Compliance / Diagnosis Notes
                  <textarea 
                    className="sd-fb-input" 
                    rows={4} 
                    placeholder="Enter diagnostic details, clear for specific sports, or physical fitness summary..." 
                    value={onBehalfForm.description} 
                    onChange={e => setOnBehalfForm(p => ({ ...p, description: e.target.value }))} 
                    required 
                  />
                </label>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                  <button 
                    type="button" 
                    className="sd-close-btn" 
                    onClick={() => { if (!onBehalfUploading) setShowUploadOnBehalfModal(false); }}
                    disabled={onBehalfUploading}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="sd-fb-submit" 
                    style={{ margin: 0, width: 'auto', padding: '8px 16px' }}
                    disabled={onBehalfUploading || (!onBehalfFile && !onBehalfForm.documentName)}
                  >
                    {onBehalfUploading ? "Uploading..." : "Upload & Clear Athlete"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <AiReportModal
        isOpen={aiReportOpen}
        onClose={() => setAiReportOpen(false)}
        bookings={bookings}
        users={users}
        facilities={facilities}
        rules={rules}
        analyticsSummary={analyticsSummary}
        API_BASE={API}
        token={localStorage.getItem("token") || ""}
        onRefreshData={fetchAll}
      />

    </div>
  );
}
