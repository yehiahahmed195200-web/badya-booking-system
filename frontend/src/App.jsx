import React, { useEffect, useState, lazy, Suspense } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import "./App.css";
import { useLanguage } from "./context/LanguageContext";

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
import ChatbotWidget from "./components/ChatbotWidget";

import TermsPage from "./pages/TermsPage";

async function fetchJson(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    return [];
  }
  return response.json();
}

export default function App() {
  const { language, toggleLanguage, t } = useLanguage();
  const [form, setForm] = useState({ email: "admin@badya.edu", password: "Admin@123" });
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [session, setSession] = useState(null);
  const [metrics, setMetrics] = useState({ facilities: 0, bookings: 0, users: 0 });
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const isDashboardRoute = ["/dashboard", "/book", "/facilities", "/live"].some(path => location.pathname === path || location.pathname.startsWith(path + "/"));
  const hideNavbar = isDashboardRoute || location.pathname === "/login";

  // Register modal state
  const [showRegister, setShowRegister] = useState(false);
  const [regForm, setRegForm] = useState({ fullName: "", email: "", studentId: "", barcode: "", password: "", confirmPassword: "" });
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  // Mandatory Terms & Conditions accept modal states
  const [blockingTermsAcceptCheckbox, setBlockingTermsAcceptCheckbox] = useState(false);
  const [termsSubmitLoading, setTermsSubmitLoading] = useState(false);

  useEffect(() => {
    // Generate device UUID if not present
    let deviceId = localStorage.getItem("device_uuid");
    if (!deviceId) {
      deviceId = "dev-" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem("device_uuid", deviceId);
    }
  }, []);

  useEffect(() => {
    const handleOpenNotifications = () => setNotificationDrawerOpen(true);
    window.addEventListener('open-notifications', handleOpenNotifications);
    return () => window.removeEventListener('open-notifications', handleOpenNotifications);
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
        return data;
      }
      setSession(data.user);
      localStorage.setItem("token", data.token);
      setMessage(`Welcome ${data.user.fullName} (${data.user.role})`);
      setErrorMessage("");
      navigate("/dashboard", { replace: true });
      return data;
    } catch (error) {
      const isNetworkError = error instanceof TypeError;
      setErrorMessage(
        isNetworkError
          ? "Unable to connect to server. Make sure backend is running on http://localhost:8080"
          : (error.message || "Login failed")
      );
      setMessage("");
      throw error;
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
            <button className="btn btn-outline" onClick={() => navigate("/terms")} style={{ border: '2px solid var(--brand)', color: 'var(--brand)' }}>Terms & Conditions</button>
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
      return (
        <StudentDashboard 
          session={session} 
          onLogout={onLogout} 
          toggleNotifications={() => setNotificationDrawerOpen(!notificationDrawerOpen)} 
        />
      );
    }
    if (session.role === "ADMIN" || session.role === "MANAGER") {
      return (
        <AdminDashboard 
          session={session} 
          onLogout={onLogout} 
          toggleNotifications={() => setNotificationDrawerOpen(!notificationDrawerOpen)} 
        />
      );
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

  const LiveRoute = () => {
    if (!session) return <Navigate to="/login" replace />;
    if (session.role !== "ADMIN" && session.role !== "MANAGER") return <Navigate to="/dashboard" replace />;
    return <LiveDashboard session={session} />;
  };

  return (
    <NotificationProvider token={session ? localStorage.getItem('token') : null}>
      <div className="site-shell">
        <NotificationCenter isOpen={notificationDrawerOpen} onClose={() => setNotificationDrawerOpen(false)} />
        {!hideNavbar && (
          <header className="site-nav" id="brand">
            <div className="nav-inner">
              <nav className="nav-links">
                <Link to="/terms">{t("navbar.terms")}</Link>
                <a href="/#about">{t("navbar.about")}</a>
                <a href="/#contact">{t("navbar.contact")}</a>
                {!session && <Link to="/login">{t("navbar.login")}</Link>}
              </nav>
              <div className="brand-wrap">
                <div className="brand">{t("login.title")}</div>
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
        )}

      <main className={`page-content ${isDashboardRoute ? "dashboard-layout" : ""}`}>
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
          <Route path="/live" element={<LiveRoute />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Badya AI Chatbot - Available on all pages */}
      <ChatbotWidget session={session} />



      {/* Register Modal — lives outside Routes so it never unmounts during navigation */}
      {showRegister && (
        <div className="modal-overlay" onClick={() => setShowRegister(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t("login.createAccount")}</h2>
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
                  {t("login.fullName")}
                  <input className="login-input" type="text" required placeholder={t("login.fullNamePlaceholder")}
                    value={regForm.fullName} onChange={e => setRegForm(p => ({ ...p, fullName: e.target.value }))} />
                </label>
                <label className="login-label">
                  {t("login.fullName").includes("الاسم") ? "الرقم الجامعي" : "Student ID"}
                  <input className="login-input" type="text" required placeholder={t("login.studentIdPlaceholder")}
                    value={regForm.studentId} onChange={e => setRegForm(p => ({ ...p, studentId: e.target.value }))} />
                </label>
                <label className="login-label">
                  {t("login.email")}
                  <input className="login-input" type="email" required placeholder={t("login.emailPlaceholder")}
                    value={regForm.email} onChange={e => setRegForm(p => ({ ...p, email: e.target.value }))} />
                </label>
                <label className="login-label">
                  {t("login.password")}
                  <input className="login-input" type="password" required placeholder="Min. 6 characters"
                    value={regForm.password} onChange={e => setRegForm(p => ({ ...p, password: e.target.value }))} />
                </label>
                <label className="login-label">
                  {t("login.confirmPassword")}
                  <input className="login-input" type="password" required placeholder="Repeat password"
                    value={regForm.confirmPassword} onChange={e => setRegForm(p => ({ ...p, confirmPassword: e.target.value }))} />
                </label>
                <button type="submit" className="login-primary" disabled={regLoading}>
                  {regLoading ? t("common.loading") : t("login.submitRegister")}
                  {!regLoading && <span aria-hidden="true">→</span>}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
      
      {/* Floating Language Toggle Button */}
      <button 
        onClick={toggleLanguage} 
        style={{
          position: "fixed",
          bottom: "20px",
          left: "20px",
          zIndex: 1000,
          background: "linear-gradient(135deg, #1cb2bf, #0d8b96)",
          color: "#fff",
          border: "none",
          borderRadius: "50%",
          width: "50px",
          height: "50px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 12px rgba(13, 139, 150, 0.3)",
          cursor: "pointer",
          fontWeight: "bold",
          fontSize: "0.85rem",
          transition: "transform 0.2s ease"
        }}
        title={language === "en" ? "تحويل للعربية" : "Switch to English"}
        onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.1)"}
        onMouseOut={(e) => e.currentTarget.style.transform = "scale(1.0)"}
      >
        {language === "en" ? "عربي" : "EN"}
      </button>

      {/* Mandatory Terms & Conditions Acceptance Guard Modal */}
      {session && session.role === "STUDENT" && (!session.termsAccepted || session.termsAcceptedVersion !== "1.0") && location.pathname !== "/terms" && location.pathname !== "/login" && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-card" style={{ maxWidth: "550px", border: "1px solid rgba(18, 173, 190, 0.3)" }}>
            <div className="modal-header">
              <h2>{language === "ar" ? "📢 تحديث هام: الشروط والأحكام" : "📢 Mandatory Terms Acceptance"}</h2>
            </div>
            <div className="modal-body" style={{ padding: "20px 24px", color: "#e2e8f0" }}>
              <p style={{ lineHeight: "1.6", marginBottom: "20px" }}>
                {language === "ar" 
                  ? "قامت إدارة جامعة باديا بتحديث شروط وقوانين استخدام المنشآت الرياضية (الإصدار 1.0). لضمان حجز الملاعب بالعدل وتجنب المخالفات، يجب على جميع الطلاب قراءة الشروط والموافقة عليها قبل استخدام بوابة الحجز."
                  : "Badya University Administration has updated the terms, conditions, and regulations for booking sports facilities (Version 1.0). To ensure fair booking opportunities and safe usage, all students are required to read and accept the updated terms to proceed."}
              </p>
              
              <div style={{ textAlign: "center", marginBottom: "24px" }}>
                <button 
                  className="btn btn-outline" 
                  onClick={() => navigate("/terms")}
                  style={{ minWidth: "220px", padding: "12px 20px", border: "2px dashed var(--brand)", color: "var(--brand)" }}
                >
                  📖 {language === "ar" ? "قراءة الشروط والأحكام كاملة" : "Read Terms & Conditions"}
                </button>
              </div>

              <label className="bk-terms-label" style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer", userSelect: "none" }}>
                <input 
                  type="checkbox" 
                  checked={blockingTermsAcceptCheckbox} 
                  onChange={(e) => setBlockingTermsAcceptCheckbox(e.target.checked)} 
                  style={{ width: "18px", height: "18px", marginTop: "3px" }}
                />
                <span style={{ fontSize: "0.95rem", color: "#cbd5e1" }}>
                  {language === "ar" 
                    ? "أقر بأنني قد قرأت وأوافق تماماً على الالتزام بجميع القوانين والجزاءات الموضحة في لائحة الشروط والأحكام."
                    : "I acknowledge that I have read and agree to comply with all rules, violations, and penalty policies detailed in the Terms & Conditions."}
                </span>
              </label>
            </div>
            
            <div className="modal-footer" style={{ padding: "16px 24px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", justifyContent: "flex-end" }}>
              <button 
                className="btn btn-solid" 
                disabled={!blockingTermsAcceptCheckbox || termsSubmitLoading}
                onClick={async () => {
                  setTermsSubmitLoading(true);
                  try {
                    const res = await fetch(`${API_BASE}/api/users/me/accept-terms`, {
                      method: "POST",
                      headers: { 
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${localStorage.getItem("token")}`
                      }
                    });
                    if (!res.ok) throw new Error("Failed to accept terms");
                    const data = await res.json();
                    
                    // Update session state in app
                    setSession(prev => ({
                      ...prev,
                      termsAccepted: true,
                      termsAcceptedVersion: "1.0"
                    }));
                  } catch (err) {
                    alert(language === "ar" ? "حدث خطأ أثناء حفظ موافقتك. يرجى المحاولة لاحقاً." : "Error saving agreement. Please try again.");
                  } finally {
                    setTermsSubmitLoading(false);
                  }
                }}
                style={{ 
                  background: blockingTermsAcceptCheckbox ? "var(--brand)" : "rgba(255, 255, 255, 0.05)",
                  color: blockingTermsAcceptCheckbox ? "#fff" : "rgba(255, 255, 255, 0.3)",
                  minWidth: "160px",
                  padding: "12px 24px"
                }}
              >
                {termsSubmitLoading 
                  ? (language === "ar" ? "جاري الحفظ..." : "Saving...") 
                  : (language === "ar" ? "تأكيد ومتابعة ←" : "Accept & Continue →")}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </NotificationProvider>
  );
}
