import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import "./App.css";

import LoginPage from "./pages/LoginPage";
import StudentDashboard from "./pages/StudentDashboard";
import BookingPage from "./pages/BookingPage";
import AdminDashboard from "./pages/AdminDashboard";
import FacilitiesPage from "./pages/FacilitiesPage";
import LiveDashboard from "./pages/LiveDashboard";
import NotificationBell from "./components/NotificationBell";
import NotificationCenter from "./components/NotificationCenter";
import { NotificationProvider } from "./contexts/NotificationContext";
import { API_BASE } from "./config/api";

async function fetchJson(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    return [];
  }
  return response.json();
}

export default function App() {
  const [form, setForm] = useState({ email: "admin@badya.edu", password: "Admin@123" });
  const [message, setMessage] = useState("Use demo account and click Sign In");
  const [errorMessage, setErrorMessage] = useState("");
  const [session, setSession] = useState(null);
  const [metrics, setMetrics] = useState({ facilities: 0, bookings: 0, users: 0 });
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);

  const navigate = useNavigate();

  // Register modal state
  const [showRegister, setShowRegister] = useState(false);
  const [regForm, setRegForm] = useState({ fullName: "", email: "", studentId: "", barcode: "", password: "", confirmPassword: "" });
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  useEffect(() => {
    // Generate device UUID if not present
    let deviceId = localStorage.getItem("device_uuid");
    if (!deviceId) {
      deviceId = "dev-" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem("device_uuid", deviceId);
    }

    function handleMessage(event) {
      if (event.data?.type === "badya-chat-close") {
        setChatbotOpen(false);
      }
      if (event.data?.type === "badya-chat-state") {
        setChatbotOpen(event.data.open);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  function onStudentLoginSuccess(user, token) {
    setSession(user);
    localStorage.setItem("token", token);
    localStorage.setItem("remembered_student_id", user.studentId);
    localStorage.setItem("remembered_student_name", user.fullName);
    setMessage(`مرحباً بك مجدداً ${user.fullName}`);
    setErrorMessage("");
    navigate("/dashboard", { replace: true });
  }



  async function onRegisterSubmit(e) {
    e.preventDefault();
    setRegError(""); setRegSuccess("");
    if (regForm.password !== regForm.confirmPassword) {
      setRegError("Passwords do not match"); return;
    }
    if (regForm.password.length < 6) {
      setRegError("Password must be at least 6 characters"); return;
    }
    setRegLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: regForm.fullName,
          email: regForm.email,
          studentId: regForm.studentId,
          barcode: regForm.studentId,
          password: regForm.password,
          role: "STUDENT"
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed");
      setRegSuccess("Account created! You can now sign in.");
      setTimeout(() => { setShowRegister(false); setForm({ email: regForm.email, password: regForm.password }); }, 2000);
    } catch (err) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  }

  async function onLoginSubmit({ email, password }) {
    setErrorMessage("");
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.message || "Login failed");
        setMessage("");
        return;
      }
      setSession(data.user);
      localStorage.setItem("token", data.token);
      setMessage(`Welcome ${data.user.fullName} (${data.user.role})`);
      setErrorMessage("");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      const isNetworkError = error instanceof TypeError;
      setErrorMessage(
        isNetworkError
          ? "Unable to connect to server. Make sure backend is running on http://localhost:8080"
          : (error.message || "Login failed")
      );
      setMessage("");
    }
  }

  function onLogout() {
    setSession(null);
    localStorage.removeItem("token");
    setMetrics({ facilities: 0, bookings: 0, users: 0 });
    setMessage("Logged out successfully");
    setErrorMessage("");
    navigate("/");
  }

  function roleTitle(role) {
    if (role === "ADMIN") return "Admin Dashboard";
    if (role === "COACH") return "Coach Dashboard";
    return "Student Dashboard";
  }

  function roleDescription(role) {
    if (role === "ADMIN") {
      return "Manage facilities, monitor bookings, and maintain operational control.";
    }
    if (role === "COACH") {
      return "Track student activity, review usage, and support academic advising sessions.";
    }
    return "View your booking progress and continue scheduling your advising sessions.";
  }

  const HomePage = () => (
    <>
      <section className="hero" id="about">
        <div className="hero-overlay" />
        <div className="hero-content">
          <h1 className="hero-title">Badya Sports Facility Booking System</h1>
          <p>Book courts and sports facilities quickly and easily</p>
          <div className="hero-actions">
            <button className="btn btn-outline" onClick={() => navigate("/login")}>Login</button>
            <button className="btn btn-solid" onClick={() => navigate("/login")}>Get Started</button>
          </div>
        </div>
      </section>

      <section className="contact-intro" id="contact">
        <h2>Contact Us</h2>
        <p>We're here to help. Feel free to contact us for any inquiries or feedback.</p>
      </section>

      <main className="layout" id="layout">
        <section className="panel info-panel">
          <h2>Contact Details</h2>
          <p>Email: advising@badyauni.edu</p>
          <p>Phone: +20 100 000 0000</p>
          <p>Working Hours: 9:00 AM - 4:00 PM</p>
        </section>
      </main>
    </>
  );


  const DashboardPage = () => {
    if (!session) return <Navigate to="/login" replace />;
    if (session.role === "STUDENT") {
      return <StudentDashboard session={session} onLogout={onLogout} />;
    }
    if (session.role === "ADMIN" || session.role === "MANAGER") {
      return <AdminDashboard session={session} onLogout={onLogout} />;
    }
    // Simple placeholder for Coach until implemented
    return (
      <section className="dashboard-section panel">
        <div className="dashboard-head">
          <h2>{roleTitle(session.role)}</h2>
          <button className="btn btn-outline" onClick={onLogout}>Logout</button>
        </div>
        <p>{roleDescription(session.role)}</p>
      </section>
    );
  };

  const FacilitiesRoute = () => {
    if (!session) return <Navigate to="/login" replace />;
    if (session.role !== "ADMIN" && session.role !== "MANAGER") return <Navigate to="/dashboard" replace />;
    return <FacilitiesPage session={session} />;
  };

  const BookingRoute = () => {
    if (!session) return <Navigate to="/login" replace />;
    return <BookingPage session={session} />;
  };

  return (
    <NotificationProvider token={session ? localStorage.getItem('token') : null}>
      <div className="site-shell">
        <NotificationCenter isOpen={notificationDrawerOpen} onClose={() => setNotificationDrawerOpen(false)} />
        <header className="site-nav" id="brand">
        <div className="nav-inner">
          <nav className="nav-links">
            <a href="/#about">About Us</a>
            <a href="/#contact">Contact Us</a>
            <Link to="/live" style={{ color: "#818cf8", fontWeight: "bold" }}>📡 Live Feed</Link>
            <Link to="/login">Login</Link>
          </nav>
          <div className="brand-wrap">
            {session && (
              <NotificationBell onClick={() => setNotificationDrawerOpen(!notificationDrawerOpen)} />
            )}
            <div className="brand">Badya University</div>
            <img
              className="brand-logo"
              src="/badya-logo.png"
              alt="Badya University logo"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          </div>
        </div>
      </header>

      <main className="page-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={
            <LoginPage
              onLoginSubmit={onLoginSubmit}
              onStudentLoginSuccess={onStudentLoginSuccess}
              errorMessage={errorMessage}
              message={message}
              onOpenRegister={() => { setShowRegister(true); setRegError(""); setRegSuccess(""); }}
            />
          } />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/book" element={<BookingRoute />} />
          <Route path="/facilities" element={<FacilitiesRoute />} />
          <Route path="/live" element={<LiveDashboard session={session} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Badya AI Chatbot - Available on all pages */}
      {chatbotOpen ? (
        <iframe
          id="chatbot-widget"
          src={`http://localhost:3333/?embedded=1${localStorage.getItem("token") ? `&token=${localStorage.getItem("token")}` : ""}`}
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            width: "min(420px, calc(100vw - 40px))",
            height: "min(620px, calc(100vh - 40px))",
            border: "none",
            borderRadius: "18px",
            boxShadow: "0 18px 50px rgba(0,0,0,0.24)",
            zIndex: 2000,
            pointerEvents: "auto"
          }}
          title="Badya AI — Intelligent Booking Assistant"
          allow="camera; microphone"
        />
      ) : (
        <button
          type="button"
          className="chatbot-launcher"
          onClick={() => setChatbotOpen(true)}
          aria-label="Open Badya AI chat"
          title="Ask Badya AI — your intelligent booking assistant"
        >
          <span className="chatbot-launcher__icon" aria-hidden="true">🤖</span>
          <span className="sr-only">Open Badya AI chat</span>
        </button>
      )}



      {/* Register Modal — lives outside Routes so it never unmounts during navigation */}
      {showRegister && (
        <div className="modal-overlay" onClick={() => setShowRegister(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Account</h2>
              <button className="modal-close" onClick={() => setShowRegister(false)}>✕</button>
            </div>
            {regSuccess ? (
              <div className="success-banner" style={{ padding: '24px', margin: 0 }}>
                <h3>🎉 {regSuccess}</h3>
              </div>
            ) : (
              <form onSubmit={onRegisterSubmit} className="login-form">
                {regError && <div className="login-error">{regError}</div>}
                <label className="login-label">
                  Full Name
                  <input className="login-input" type="text" required placeholder="Ahmed Mohamed"
                    value={regForm.fullName} onChange={e => setRegForm(p => ({ ...p, fullName: e.target.value }))} />
                </label>
                <label className="login-label">
                  Student ID
                  <input className="login-input" type="text" required placeholder="STD-2024-001"
                    value={regForm.studentId} onChange={e => setRegForm(p => ({ ...p, studentId: e.target.value }))} />
                </label>
                <label className="login-label">
                  Email Address
                  <input className="login-input" type="email" required placeholder="name@badya.edu"
                    value={regForm.email} onChange={e => setRegForm(p => ({ ...p, email: e.target.value }))} />
                </label>
                <label className="login-label">
                  Password
                  <input className="login-input" type="password" required placeholder="Min. 6 characters"
                    value={regForm.password} onChange={e => setRegForm(p => ({ ...p, password: e.target.value }))} />
                </label>
                <label className="login-label">
                  Confirm Password
                  <input className="login-input" type="password" required placeholder="Repeat password"
                    value={regForm.confirmPassword} onChange={e => setRegForm(p => ({ ...p, confirmPassword: e.target.value }))} />
                </label>
                <button type="submit" className="login-primary" disabled={regLoading}>
                  {regLoading ? "Creating..." : "Create Account"}
                  {!regLoading && <span aria-hidden="true">→</span>}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
      </div>
    </NotificationProvider>
  );
}
