import { useState, useEffect, useRef } from "react";
import { API_BASE } from "../config/api";
import { useLanguage } from "../context/LanguageContext";

export default function LoginPage({ onLoginSubmit, onStudentLoginSuccess, errorMessage, message, onOpenRegister }) {
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState("student"); // "student" or "staff"
  
  // Staff form states
  const [staffEmail, setStaffEmail] = useState("admin@badya.edu");
  const [staffPassword, setStaffPassword] = useState("Admin@123");

  // Student form states
  const [studentIdInput, setStudentIdInput] = useState("");
  const [studentStep, setStudentStep] = useState("studentId"); // "card", "studentId", "device_locked"
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [deviceLockedState, setDeviceLockedState] = useState(null);

  // Loading and helper states
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [localSuccess, setLocalSuccess] = useState("");

  // Check if there's a remembered student ID on mount
  useEffect(() => {
    const rememberedId = localStorage.getItem("remembered_student_id");
    const rememberedName = localStorage.getItem("remembered_student_name");
    if (rememberedId && activeTab === "student") {
      setStudentStep("card");
      setSelectedStudentId(rememberedId);
      setStudentName(rememberedName || "Student");
    }
  }, [activeTab]);

  // Format timer
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Staff manual login submit
  function handleStaffSubmit(e) {
    e.preventDefault();
    onLoginSubmit({ email: staffEmail, password: staffPassword });
  }

  // Student Step 1: Initiate Student Login (Passwordless check or OTP trigger)
  async function handleStudentInit(e, forceId = null) {
    if (e) e.preventDefault();
    setLocalError("");
    setLocalSuccess("");
    setLoading(true);

    const targetId = forceId || studentIdInput;
    if (!targetId || targetId.trim() === "") {
      setLocalError("Please enter your Student ID first.");
      setLoading(false);
      return;
    }

    const deviceId = localStorage.getItem("device_uuid");

    try {
      const response = await fetch(`${API_BASE}/api/auth/student-login-init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: targetId.trim(), deviceId }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (data.status === "DEVICE_LOCKED") {
          setDeviceLockedState({
            studentId: targetId.trim(),
            message: data.message,
            pendingRequest: data.pendingRequest || false
          });
          setStudentStep("device_locked");
          setLoading(false);
          return;
        }
        throw new Error(data.message || "Failed to verify Student ID.");
      }

      if (data.status === "PASSWORDLESS_SUCCESS") {
        setLocalSuccess("Device recognized! Logging you in...");
        setTimeout(() => {
          onStudentLoginSuccess(data.user, data.token);
          setLoading(false);
        }, 1200);
      }
    } catch (err) {
      setLocalError(err.message);
      setLoading(false);
    }
  }

  // Handle student sending device change request to Admin
  async function handleSendDeviceRequest() {
    if (!deviceLockedState) return;
    setLocalError("");
    setLocalSuccess("");
    setLoading(true);

    const deviceId = localStorage.getItem("device_uuid");

    try {
      const response = await fetch(`${API_BASE}/api/auth/student-device-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: deviceLockedState.studentId, deviceId }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to submit device change request.");
      }

      setLocalSuccess("🎉 Device change request submitted successfully!");
      setDeviceLockedState(prev => ({
        ...prev,
        pendingRequest: true,
        message: "This account is already linked to another device. You have a pending device change request that is currently under review by the administration."
      }));
      setLoading(false);
    } catch (err) {
      setLocalError(err.message);
      setLoading(false);
    }
  }



  // Get initials for avatar badge
  const getInitials = (name) => {
    if (!name) return "S";
    return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
  };

  return (
    <section className="login-hero">
      <style>{`
        .login-tabs {
          display: flex;
          background: rgba(10, 22, 38, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 14px;
          padding: 4px;
          margin-bottom: 22px;
          gap: 4px;
        }
        .login-tab-btn {
          flex: 1;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          font-weight: 700;
          font-size: 0.95rem;
          padding: 10px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.25s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .login-tab-btn.active {
          background: linear-gradient(135deg, #1cb2bf 0%, #1399a7 100%);
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(28, 178, 191, 0.3);
        }
        @media (max-width: 768px) {
          .login-tabs {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
          .login-tab-btn {
            width: 100%;
            white-space: normal;
            min-height: 80px;
            padding: 8px 4px;
            font-size: 0.85rem;
            line-height: 1.25;
          }
        }
        .student-quick-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 14px 10px;
        }
        .avatar-circle {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(28, 178, 191, 0.15) 0%, rgba(28, 178, 191, 0.35) 100%);
          border: 2px solid #2dd4dc;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.85rem;
          font-weight: 800;
          color: #2dd4dc;
          margin-bottom: 16px;
          position: relative;
          box-shadow: 0 0 20px rgba(45, 212, 220, 0.2);
        }
        .avatar-circle::before {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 1px dashed rgba(45, 212, 220, 0.4);
          animation: spin-avatar 12s linear infinite;
        }
        @keyframes spin-avatar {
          100% { transform: rotate(360deg); }
        }
        .pulse-login-btn {
          animation: pulse-login 2s infinite;
        }
        @keyframes pulse-login {
          0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(255, 255, 255, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
        }
        .otp-badge {
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.3);
          color: #f59e0b;
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 0.85rem;
          line-height: 1.5;
          margin-bottom: 18px;
          text-align: right;
          direction: rtl;
        }
        .otp-countdown {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 0.88rem;
          color: rgba(255, 255, 255, 0.7);
          margin-top: 14px;
          font-weight: 700;
        }
        .otp-countdown span {
          color: #ff5e5e;
        }
        .text-arabic {
          direction: rtl;
          text-align: right;
        }
        .back-link {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.88rem;
          cursor: pointer;
          text-decoration: underline;
          padding: 0;
          margin-top: 12px;
          width: auto;
          display: inline-block;
        }
        .back-link:hover {
          color: #ffffff;
        }
      `}</style>

      <div className="login-hero-overlay" />
      <div className="login-hero-content">
        <div className="login-header">
          <h1>{activeTab === "student" ? (language === "en" ? "Student Portal" : "بوابة الطلاب") : (language === "en" ? "Staff Portal" : "بوابة الموظفين")}</h1>
          <p>
            {activeTab === "student"
              ? (language === "en" ? "Quick and secure entry to Badya University athletic facilities" : "دخول سريع وآمن للمنشآت الرياضية بجامعة باديا")
              : (language === "en" ? "Staff and administrative access to manage facilities and bookings" : "دخول الموظفين والمسؤولين لإدارة الملاعب والحجوزات")}
          </p>
        </div>

        <main className="login-layout" id="layout">
          <section className="login-card" id="login-section">
            
            {/* Tabs Header */}
            <div className="login-tabs">
              <button
                type="button"
                className={`login-tab-btn ${activeTab === "student" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("student");
                  setLocalError("");
                  setLocalSuccess("");
                }}
              >
                🎓 {language === "en" ? "Students" : "الطلاب"}
              </button>
              <button
                type="button"
                className={`login-tab-btn ${activeTab === "staff" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("staff");
                  setLocalError("");
                  setLocalSuccess("");
                }}
              >
                👥 {language === "en" ? "Staff / Coaches" : "الموظفون / المدربون"}
              </button>
            </div>

            {/* TAB 1: STUDENT LOGIN FLOW */}
            {activeTab === "student" && (
              <div>
                
                {/* SCREEN A: QUICK CARD (Recognized Device) */}
                {studentStep === "card" && (
                  <div className="student-quick-card">
                    <div className="avatar-circle">
                      {getInitials(studentName)}
                    </div>
                    <h3 style={{ margin: "0 0 4px", fontSize: "1.35rem" }}>
                      {language === "en" ? `Welcome back, ${studentName} 👋` : `مرحباً بك مجدداً، ${studentName} 👋`}
                    </h3>
                    <p style={{ margin: "0 0 20px", color: "rgba(255, 255, 255, 0.7)", fontSize: "0.9rem" }}>
                      {language === "en" ? "Student ID:" : "الرقم الجامعي:"} <strong style={{ color: "#2dd4dc" }}>{selectedStudentId}</strong>
                    </p>

                    <p style={{ fontSize: "0.85rem", color: "rgba(255, 255, 255, 0.6)", background: "rgba(255,255,255,0.04)", padding: "10px 12px", borderRadius: 12, marginBottom: 16, textAlign: "center", lineHeight: "1.5" }}>
                      {language === "en"
                        ? "🔒 This device is registered and secured to your account. You will be logged in with a single click."
                        : "🔒 هذا الجهاز مسجل ومؤمن لحسابك. سيتم تسجيل دخولك بنقرة واحدة."}
                    </p>

                    <button
                      type="button"
                      className="login-primary pulse-login-btn"
                      onClick={(e) => handleStudentInit(e, selectedStudentId)}
                      disabled={loading}
                    >
                      {loading ? t("common.loading") : (language === "en" ? "⚡ Quick & Secure Entry" : "⚡ دخول سريع وآمن")}
                    </button>

                    <button
                      type="button"
                      className="back-link"
                      onClick={() => {
                        setStudentStep("studentId");
                        setLocalError("");
                        setLocalSuccess("");
                      }}
                    >
                      {language === "en" ? "Login with another Student ID" : "الدخول برقم جامعي آخر"}
                    </button>
                  </div>
                )}

                {/* SCREEN B: ENTER STUDENT ID */}
                {studentStep === "studentId" && (
                  <form onSubmit={(e) => handleStudentInit(e)} className="login-form">
                    <label className="login-label">
                      {language === "en" ? "Student ID" : "الرقم الجامعي"}
                      <input
                        className="login-input"
                        type="text"
                        value={studentIdInput}
                        onChange={e => setStudentIdInput(e.target.value)}
                        placeholder={t("login.studentIdPlaceholder")}
                        required
                        autoFocus
                        style={{ direction: "ltr", textAlign: "center" }}
                      />
                    </label>

                    <p style={{ fontSize: "0.82rem", color: "rgba(255, 255, 255, 0.7)", margin: "0 0 10px" }}>
                      {language === "en"
                        ? "💡 Enter your Student ID. Upon your first login, this device will be automatically registered and locked to your account. You will not be able to log in from any other device without contacting the University Administration."
                        : "💡 أدخل الرقم الجامعي الخاص بك. عند تسجيل دخولك الأول، سيتم تسجيل هذا الجهاز تلقائياً وقفله على حسابك. لن تتمكن من تسجيل الدخول من أي جهاز آخر دون مراجعة إدارة الجامعة."}
                    </p>

                    <button type="submit" className="login-primary" disabled={loading}>
                      {loading ? (language === "en" ? "Verifying..." : "جاري التحقق...") : (language === "en" ? "Continue" : "متابعة")}
                      {!loading && <span aria-hidden="true">→</span>}
                    </button>
                  </form>
                )}



                {/* SCREEN D: DEVICE LOCKED / REQUEST CHANGE */}
                {studentStep === "device_locked" && deviceLockedState && (
                  <div className="login-form" style={{ textAlign: "center", padding: "10px 0" }}>
                    <div style={{ fontSize: "3.5rem", marginBottom: "15px" }}>🔒📱</div>
                    
                    <h3 style={{ color: "#ff5e5e", margin: "0 0 12px", fontSize: "1.25rem", fontWeight: "bold" }}>
                      {language === "en" ? "Account Linked to Another Device!" : "الحساب مرتبط بجهاز آخر!"}
                    </h3>
                    
                    <p style={{ fontSize: "0.9rem", color: "rgba(255, 255, 255, 0.85)", lineHeight: "1.6", background: "rgba(255, 255, 255, 0.05)", padding: "12px", borderRadius: "8px", marginBottom: "20px" }}>
                      {deviceLockedState.message}
                    </p>

                    {deviceLockedState.pendingRequest ? (
                      <div style={{ background: "rgba(45, 212, 220, 0.08)", border: "1px solid rgba(45, 212, 220, 0.2)", borderRadius: "8px", padding: "12px", color: "#2dd4dc", fontSize: "0.85rem", marginBottom: "20px" }}>
                        ⏳ <strong>{language === "en" ? "Pending Review:" : "قيد المراجعة:"}</strong> {language === "en" ? "Your request to transfer the account to this device has been submitted successfully and is currently under review by the Athletic Administration." : "تم تقديم طلب نقل الحساب لهذا الجهاز بنجاح وهو قيد المراجعة حالياً من قبل الإدارة الرياضية."}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="login-primary"
                        onClick={handleSendDeviceRequest}
                        disabled={loading}
                        style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", border: "none", color: "#000", fontWeight: "bold" }}
                      >
                        {loading ? (language === "en" ? "Submitting..." : "جاري التقديم...") : (language === "en" ? "🚀 Submit Device Change Request" : "🚀 تقديم طلب تغيير الجهاز")}
                      </button>
                    )}

                    <button
                      type="button"
                      className="back-link"
                      onClick={() => {
                        setStudentStep("studentId");
                        setLocalError("");
                        setLocalSuccess("");
                      }}
                      style={{ marginTop: "15px", display: "inline-block" }}
                    >
                      {t("common.back")}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: STAFF LOGIN (EMAIL + PASSWORD) */}
            {activeTab === "staff" && (
              <form onSubmit={handleStaffSubmit} className="login-form">
                <label className="login-label">
                  {t("login.email")}
                  <input
                    className="login-input"
                    type="email"
                    value={staffEmail}
                    onChange={e => setStaffEmail(e.target.value)}
                    placeholder="admin@badya.edu"
                    required
                    autoComplete="email"
                  />
                </label>

                <label className="login-label">
                  {t("login.password")}
                  <input
                    className="login-input"
                    type="password"
                    value={staffPassword}
                    onChange={e => setStaffPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                </label>

                <button type="button" className="login-forgot">{language === "en" ? "Forgot password?" : "نسيت كلمة المرور؟"}</button>

                <button type="submit" className="login-primary">
                  {language === "en" ? "Sign In (Staff Portal)" : "تسجيل الدخول (بوابة الموظفين)"}
                  <span aria-hidden="true">→</span>
                </button>
              </form>
            )}

            {/* Error & Success Messages */}
            {(localError || errorMessage) && (
              <p className="login-error">{localError || errorMessage}</p>
            )}
            {(localSuccess || (message && !errorMessage)) && !localError && (
              <p className="login-message">{localSuccess || message}</p>
            )}

            {/* Divider and Register (Students only) */}
            {activeTab === "student" && studentStep === "studentId" && (
              <>
                <div className="login-divider">{t("login.noAccount")}</div>
                <button
                  type="button"
                  className="login-secondary"
                  onClick={onOpenRegister}
                >
                  {t("login.createAccount")}
                </button>
              </>
            )}

          </section>
        </main>
      </div>
    </section>
  );
}
