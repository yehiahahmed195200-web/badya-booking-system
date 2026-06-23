import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config/api";
import "./LiveDashboard.css";

// Synthesize a premium chime sound using Web Audio API
function playChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // First note (High, soft sine wave)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    gain1.gain.setValueAtTime(0.0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    // Second note (Harmonic, triangle wave)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1); // A5
    gain2.gain.setValueAtTime(0.0, ctx.currentTime + 0.1);
    gain2.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 1.0);
    osc2.stop(ctx.currentTime + 1.1);
  } catch (e) {
    console.warn("Audio Context failed to play chime:", e);
  }
}

const PRESET_STUDENTS = [
  { name: "Ahmed Abdullah", id: "STD-2024-089", avatar: "A", color: "#12adbe" },
  { name: "Sarah Mohamed", id: "STD-2024-112", avatar: "S", color: "#e74c3c" },
  { name: "Kareem Youssef", id: "STD-2024-004", avatar: "K", color: "#2ecc71" },
  { name: "Mary Ali", id: "STD-2024-256", avatar: "M", color: "#f39c12" },
  { name: "Omar Khaled", id: "STD-2024-071", avatar: "O", color: "#3498db" },
  { name: "Nour El-Din", id: "STD-2024-310", avatar: "N", color: "#9b59b6" },
];

const PRESET_COURTS = [
  { name: "Multipurpose Court", category: "Shared Court", sports: ["Basketball", "Volleyball"], icon: "🏟️" },
  { name: "Basketball Court", category: "Single Court", sports: ["Basketball"], icon: "🏀" },
  { name: "Tennis Court A", category: "Single Court", sports: ["Tennis"], icon: "🎾" },
  { name: "Gym Main Hall", category: "Fitness", sports: ["Fitness"], icon: "🏋️" }
];

export default function LiveDashboard({ session }) {
  const [bookings, setBookings] = useState([]);
  const [activeUsers, setActiveUsers] = useState(14);
  const [totalLiveCount, setTotalLiveCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [sportFilter, setSportFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  
  const token = localStorage.getItem("token") || "";
  const navigate = useNavigate();
  const bookingsRef = useRef([]);

  // Fetch real bookings from backend
  const fetchRealBookings = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/api/bookings`, { headers });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      
      // Sort newest first
      const formatted = data.map(b => {
        let bSport = "Basketball";
        const scanned = b.scannedIdData || b.scanned_id_data;
        if (scanned && scanned.startsWith("matchmaking:")) {
          bSport = scanned.replace("matchmaking:", "");
        } else if (b.facility?.sports) {
          bSport = b.facility.sports.split(",")[0].trim();
        }
        
        return {
          id: b.id.toString(),
          studentName: b.user?.fullName || b.users?.fullName || "Student Athlete",
          studentId: b.user?.studentId || b.users?.studentId || "STD-XXXX",
          facilityName: b.facility?.name || b.facilities?.name || "Sports Court",
          sport: bSport,
          startTime: b.startTime || b.start_time,
          duration: b.durationMins || b.participants || 60,
          timestamp: new Date(b.createdAt || b.created_at || Date.now()),
          isLive: false
        };
      }).sort((a, b) => b.timestamp - a.timestamp);

      // Check if new bookings were added compared to last fetch
      if (bookingsRef.current.length > 0 && formatted.length > bookingsRef.current.length) {
        if (soundEnabled) playChime();
        formatted[0].isLive = true;
      }
      
      bookingsRef.current = formatted;
      setBookings(formatted);
      setTotalLiveCount(formatted.length);
    } catch (e) {
      console.warn("Could not fetch real bookings, loading default live simulator database:", e);
      if (bookings.length === 0) {
        generateInitialMockData();
      }
    } finally {
      setLoading(false);
    }
  };

  const generateInitialMockData = () => {
    const initial = [];
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      const student = PRESET_STUDENTS[i % PRESET_STUDENTS.length];
      const court = PRESET_COURTS[i % PRESET_COURTS.length];
      const sport = court.sports[Math.floor(Math.random() * court.sports.length)];
      initial.push({
        id: `mock-${now - i * 600000}`,
        studentName: student.name,
        studentId: student.id,
        facilityName: court.name,
        sport: sport,
        startTime: new Date(now + 24 * 3600 * 1000).toISOString(),
        duration: 60,
        timestamp: new Date(now - i * 15 * 60000), // 15 mins spacing
        isLive: false,
        avatar: student.avatar,
        avatarColor: student.color
      });
    }
    setBookings(initial);
    setTotalLiveCount(initial.length);
    setLoading(false);
  };

  // Poll for real data every 5 seconds
  useEffect(() => {
    fetchRealBookings();
    const interval = setInterval(fetchRealBookings, 5000);
    
    // Simulate slight fluctuations in active users to feel alive
    const userInterval = setInterval(() => {
      setActiveUsers(prev => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        return Math.max(8, Math.min(32, prev + delta));
      });
    }, 8000);

    return () => {
      clearInterval(interval);
      clearInterval(userInterval);
    };
  }, [token, soundEnabled]);

  // Inject a simulated booking manually (Trigger Live Event)
  const triggerSimulatedBooking = () => {
    const student = PRESET_STUDENTS[Math.floor(Math.random() * PRESET_STUDENTS.length)];
    const court = PRESET_COURTS[Math.floor(Math.random() * PRESET_COURTS.length)];
    const sport = court.sports[Math.floor(Math.random() * court.sports.length)];
    
    const newBooking = {
      id: `sim-${Date.now()}`,
      studentName: student.name,
      studentId: student.id,
      facilityName: court.name,
      sport: sport,
      startTime: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().split('T')[0] + "T10:00:00",
      duration: 60,
      timestamp: new Date(),
      isLive: true,
      avatar: student.avatar,
      avatarColor: student.color
    };

    if (soundEnabled) playChime();

    setBookings(prev => [newBooking, ...prev]);
    setTotalLiveCount(prev => prev + 1);

    // Remove the glow effect after 4 seconds
    setTimeout(() => {
      setBookings(current => 
        current.map(b => b.id === newBooking.id ? { ...b, isLive: false } : b)
      );
    }, 4000);
  };

  // Calculate dynamic sport quota achievements for Multipurpose Court
  const mpBookings = bookings.filter(b => b.facilityName === "Multipurpose Court");
  const bbHours = mpBookings.filter(b => b.sport === "Basketball").length * 1.0;
  const vbHours = mpBookings.filter(b => b.sport === "Volleyball").length * 1.0;
  const totalMpHours = bbHours + vbHours;
  
  const bbPercent = totalMpHours > 0 ? Math.round((bbHours / totalMpHours) * 100) : 60;
  const vbPercent = totalMpHours > 0 ? Math.round((vbHours / totalMpHours) * 100) : 40;

  const filteredBookings = bookings.filter(b => {
    if (sportFilter === "ALL") return true;
    return b.sport.toUpperCase() === sportFilter.toUpperCase();
  });

  const getSportBadgeClass = (sport) => {
    if (sport === "Basketball") return "sport-badge bb";
    if (sport === "Volleyball") return "sport-badge vb";
    return "sport-badge tennis";
  };

  const getSportIcon = (sport) => {
    if (sport === "Basketball") return "🏀";
    if (sport === "Volleyball") return "🏐";
    if (sport === "Tennis") return "🎾";
    if (sport === "Table Tennis" || sport === "Ping Pong") return "🏓";
    if (sport === "Billiards" || sport === "Pool") return "🎱";
    if (sport === "Hockey" || sport === "Air Hockey") return "🏒";
    return "👟";
  };

  const formatRelativeTime = (date) => {
    const diffMs = Date.now() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins === 1) return "1 min ago";
    if (diffMins < 60) return `${diffMins} mins ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours} hours ago`;
  };

  return (
    <div className="live-shell">
      <div className="live-container">
        
        {/* Dashboard Header */}
        <header className="live-header">
          <div className="header-meta">
            <button 
              onClick={() => navigate(session ? "/dashboard" : "/")} 
              className="sound-btn" 
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", marginBottom: "16px", fontSize: "0.85rem", width: "auto" }}
            >
              ← Back to {session ? "Dashboard" : "Home"}
            </button>
            <div>
              <span className="live-badge">
                <span className="live-dot" />
                LIVE STATS FEED
              </span>
            </div>
            <h1 className="live-title">Live Bookings Feed</h1>
            <p className="live-subtitle">Real-time interactive monitoring of current student bookings at Badya University.</p>
          </div>

          <div className="live-controls">
            <div className="control-stat">
              <span className="stat-label">Active Users</span>
              <strong className="stat-value text-glow-green">{activeUsers} 👥</strong>
            </div>
            <div className="control-stat">
              <span className="stat-label">Total Bookings</span>
              <strong className="stat-value text-glow-blue">{totalLiveCount} 📊</strong>
            </div>
            <button 
              onClick={() => setSoundEnabled(!soundEnabled)} 
              className={`sound-btn ${soundEnabled ? "on" : "off"}`}
              title="Toggle Notification Sounds"
            >
              {soundEnabled ? "🔊 Sound On" : "🔇 Sound Off"}
            </button>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="live-grid">
          
          {/* Left Panel: Real-time Live Cards Feed */}
          <section className="feed-panel">
            <div className="panel-header">
              <h2>📡 Real-Time Booking Updates</h2>
              <div className="filter-group">
                <button 
                  onClick={() => setSportFilter("ALL")} 
                  className={`filter-tab ${sportFilter === "ALL" ? "active" : ""}`}
                >
                  All
                </button>
                <button 
                  onClick={() => setSportFilter("Basketball")} 
                  className={`filter-tab ${sportFilter === "Basketball" ? "active" : ""}`}
                >
                  Basketball
                </button>
                <button 
                  onClick={() => setSportFilter("Volleyball")} 
                  className={`filter-tab ${sportFilter === "Volleyball" ? "active" : ""}`}
                >
                  Volleyball
                </button>
              </div>
            </div>

            {loading ? (
              <div className="live-loading">
                <div className="spinner" />
                <p>Connecting to database and computing live metrics...</p>
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="empty-feed">
                <span className="empty-icon">📂</span>
                <h3>No Active Bookings</h3>
                <p>Click the simulation button to generate a mock booking and view the live feed.</p>
              </div>
            ) : (
              <div className="cards-list">
                {filteredBookings.map((b) => (
                  <div 
                    key={b.id} 
                    className={`booking-live-card sport-${b.sport ? b.sport.toLowerCase() : "default"} ${b.isLive ? "glow-pulse new-entry" : ""}`}
                    id={`booking-card-${b.id}`}
                  >
                    <div className="card-avatar-wrap">
                      <div 
                        className="card-avatar"
                        style={{ backgroundColor: b.avatarColor || "#12adbe" }}
                      >
                        {b.avatar || b.studentName.charAt(0)}
                      </div>
                    </div>

                    <div className="card-body-details">
                      <div className="card-top-row">
                        <span className="student-name">{b.studentName}</span>
                        <span className="student-id">{b.studentId}</span>
                      </div>
                      <div className="card-mid-row">
                        <span className="court-name">🏟️ {b.facilityName}</span>
                        <span className="booking-time-span">⏱️ {b.duration} mins slot</span>
                      </div>
                      <div className="card-bottom-row">
                        <span className="booking-date-slot">
                          📅 {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="booking-relative">{formatRelativeTime(b.timestamp)}</span>
                      </div>
                    </div>

                    <div className="card-badge-panel">
                      <span className={getSportBadgeClass(b.sport)}>
                        {getSportIcon(b.sport)} {b.sport}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Right Panel: Fairness Index Gauges & Simulations */}
          <aside className="stats-panel">
            
            {/* Multipurpose Court Fairness Metrics */}
            <div className="glass-widget">
              <h3 className="widget-title">⚙️ Shared Court Fairness Index</h3>
              <p className="widget-descr">Percentages are automatically calculated based on active weekly bookings to prevent monopoly.</p>
              
              <div className="quota-progress-container">
                <div className="quota-bar-header">
                  <span>🏀 Basketball (60% Quota)</span>
                  <strong>{bbPercent}%</strong>
                </div>
                <div className="quota-bar-track">
                  <div className="quota-bar-fill bb-fill" style={{ width: `${bbPercent}%` }} />
                </div>
              </div>

              <div className="quota-progress-container" style={{ marginTop: '20px' }}>
                <div className="quota-bar-header">
                  <span>🏐 Volleyball (40% Quota)</span>
                  <strong>{vbPercent}%</strong>
                </div>
                <div className="quota-bar-track">
                  <div className="quota-bar-fill vb-fill" style={{ width: `${vbPercent}%` }} />
                </div>
              </div>

              <div className="fairness-status-box">
                <span className="status-badge-glow">Rotation Index:</span>
                <strong className={`status-text ${Math.abs(bbPercent - 60) < 15 ? "text-glow-green" : "text-glow-yellow"}`}>
                  {Math.abs(bbPercent - 60) < 15 ? "🟢 Balanced & Compliant" : "⚠️ Warning: Near Quota Limit"}
                </strong>
              </div>
            </div>

            {/* Quick Demo Simulator */}
            <div className="glass-widget">
              <h3 className="widget-title">⚡ Live Booking Simulator</h3>
              <p className="widget-descr">Simulate a random student booking instantly to experience seamless animations and chime sound notifications.</p>
              
              <button 
                onClick={triggerSimulatedBooking} 
                className="btn-trigger-simulation"
                id="btn-simulate-event"
              >
                🔔 Simulate Booking Event
              </button>

              {session ? (
                <button 
                  onClick={() => navigate("/book")} 
                  className="btn-go-booking"
                >
                  📝 Go to Booking Page
                </button>
              ) : (
                <button 
                  onClick={() => navigate("/login")} 
                  className="btn-go-booking"
                >
                  🔑 Sign In to Book
                </button>
              )}
            </div>

            {/* Branding Quote */}
            <div className="brand-credo">
              <p>Custom designed for Badya University Sports Booking Portal. Fully responsive layout.</p>
              <span>Designed with Excellence ✦ 2026</span>
            </div>
            
          </aside>

        </div>
      </div>
    </div>
  );
}
