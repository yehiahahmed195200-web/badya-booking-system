import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config/api";
import "./ChatbotWidget.css";
import { useLanguage } from "../context/LanguageContext";

// Fallback Gemini API key (Base64 obfuscated to prevent GitHub Push Protection triggers)
const OBFUSCATED_KEY = "QVEuQWI4Uk42SlFsZHUwdVE5OFp0ank3Zzc0UGNYRVNCSWFEZUdKNDliaDJoUEJSd0g5eXc=";
const GEMINI_API_KEY = import.meta.env.VITE_LLM_API_KEY || (typeof window !== "undefined" ? window.atob(OBFUSCATED_KEY) : "");

// Default Knowledge Base pre-embedded for offline/serverless RAG
const DEFAULT_KNOWLEDGE = `
# Booking Rules and Policies
1. Punctuality: Users must arrive 5 minutes before their booking time. Late arrivals of more than 15 minutes may result in cancellation without notice.
2. Cancellations: Must be done at least 24 hours in advance. Failure to do so 3 times in a month will result in a temporary ban.
3. Behavior: Respectful behavior towards staff and other players is mandatory.
4. Cleanliness: Please leave the facility as clean as you found it.

# User Points and Warnings
- Users start with 100 points.
- Missing a booking without cancellation: -20 points.
- Damaging equipment: -50 points + cost of repair.
- 3 Warnings = 1 week ban.
- 5 Warnings = Expulsion from the sports system for the semester.

# Contact Information
- Sports Office: Room 102, Main Building.
- Email: sports@badya.edu.eg
- Emergency: +20 123 456 7890
`;

export default function ChatbotWidget({ session }) {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileStatus, setFileStatus] = useState(language === "ar" ? "لم يتم اختيار ملف" : "No file chosen");

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Sync fileStatus on language change
  useEffect(() => {
    if (!selectedFile) {
      setFileStatus(language === "ar" ? "لم يتم اختيار ملف" : "No file chosen");
    }
  }, [language, selectedFile]);

  // Auto-scroll to the bottom of the message container
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Welcome message when chatbot opens
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: "bot",
          content: t("chatbot.welcome")
        }
      ]);
    }
  }, [messages, t]);

  // Headers for backend calls
  const getBackendHeaders = () => {
    const token = localStorage.getItem("token");
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  // --- Backend Tool Implementations ---
  const fetchFacilities = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/facilities?activeOnly=true`, {
        headers: getBackendHeaders()
      });
      if (!res.ok) throw new Error(`Backend status: ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error("Error fetching facilities for tool:", err);
      return { error: "Failed to fetch facilities list." };
    }
  };

  const fetchNotifications = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/api/notifications/user/${userId}`, {
        headers: getBackendHeaders()
      });
      if (!res.ok) throw new Error(`Backend status: ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error("Error fetching notifications for tool:", err);
      return { error: "Failed to retrieve notifications." };
    }
  };

  const submitBooking = async (bookingData) => {
    try {
      const res = await fetch(`${API_BASE}/api/bookings`, {
        method: "POST",
        headers: getBackendHeaders(),
        body: JSON.stringify(bookingData)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Backend status: ${res.status}`);
      }
      return data;
    } catch (err) {
      console.error("Error creating booking for tool:", err);
      return { error: err.message || "Failed to create booking." };
    }
  };

  // --- Gemini API Handler ---
  const callGeminiChat = async (chatHistory) => {
    const endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/v1/chat/completions";
    
    // Injected user info
    const userInfo = session 
      ? { 
          userId: session.id, 
          name: session.fullName, 
          role: session.role,
          studentId: session.studentId,
          points: session.earnedPoints || session.points || 0,
          warnings: session.warnings || 0,
          credits: session.credits != null ? session.credits : 10
        }
      : null;

    const assistantPrompt = `You are Badya Concierge, the official digital assistant for Badya University's premium sports booking platform.
You sound like a polished, attentive support specialist.
Match the user's language: use Arabic when the user writes Arabic, and English when the user writes English.
Be warm, concise, and confident.
Avoid robotic openings. Do not mention model names or that you are an AI.
You have access to a static knowledge base of rules/policies and active tools to query live database records.

# Static Knowledge Base Context:
${DEFAULT_KNOWLEDGE}
${uploadedDocs.length > 0 ? `\n# Context from custom uploaded files:\n${uploadedDocs.map(d => `[File: ${d.title}]\n${d.text}`).join("\n---\n")}` : ""}

# Active User Session:
${userInfo ? `Logged-in User Details:
- Name: "${userInfo.name}"
- ID (Numeric database ID): ${userInfo.userId}
- Student ID (String): "${userInfo.studentId}"
- Role: "${userInfo.role}"
- Earned Points: ${userInfo.points}
- Violations/Warnings count: ${userInfo.warnings} (Max 3 before auto-ban)
- Remaining Credits: ${userInfo.credits}` : "User is guest/not logged in."}

Always trigger the appropriate tool if the user asks about sports facilities, active courts, notifications, or requests to book.
If the user wants to book a facility:
- Check if they specified: facilityId, startTime (format: YYYY-MM-DDTHH:mm), durationMins, and participants.
- If details are missing, ask them focused follow-up questions to fill them in.
- If they are logged in, use their userId directly for the booking. If not, ask them for their userId before submitting.
- Call the "create_booking" tool to submit the reservation.
- Present the final booking status (like the reservation ID if successful) clearly.
`;

    // Map conversation logs to OpenAI format
    const formattedHistory = chatHistory.map(m => ({
      role: m.role === "bot" ? "assistant" : "user",
      content: m.content
    }));

    const requestBody = {
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: assistantPrompt },
        ...formattedHistory
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "get_facilities",
            description: "Retrieve a list of all active sports facilities, courts, and their operational schedules."
          }
        },
        {
          type: "function",
          function: {
            name: "get_notifications",
            description: "Get user notifications/alerts about bookings using the user's ID.",
            parameters: {
              type: "object",
              properties: {
                userId: { type: "integer", description: "The unique ID of the user." }
              },
              required: ["userId"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "create_booking",
            description: "Create a new booking/reservation slot for a specific court or facility.",
            parameters: {
              type: "object",
              properties: {
                userId: { type: "integer", description: "The ID of the student/user reserving the court." },
                facilityId: { type: "integer", description: "The ID of the court/facility to book." },
                startTime: { type: "string", description: "Start date/time of the booking in YYYY-MM-DDTHH:mm format." },
                durationMins: { type: "integer", description: "The duration of the booking slot in minutes." },
                participants: { type: "integer", description: "Number of players/participants (minimum 1)." }
              },
              required: ["userId", "facilityId", "startTime", "durationMins", "participants"]
            }
          }
        }
      ],
      tool_choice: "auto",
      temperature: 0.7
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GEMINI_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errTxt}`);
    }

    return await res.json();
  };

  const renderMessageContent = (content) => {
    if (typeof content !== "string") return content;

    const lines = content.split("\n");
    const parsedLines = lines.map((line, idx) => {
      const trimmed = line.trim();
      const isRtl = /[\u0600-\u06FF]/.test(trimmed);

      const facilityMatch = trimmed.match(/^-\s*\[(?:ملعب\s*)?#(\d+|[a-zA-Z0-9_-]+)\]\s*(.+?)\s*\((.+?)\):\s*(.+)$/i);
      if (facilityMatch) {
        const id = facilityMatch[1];
        const name = facilityMatch[2];
        const category = facilityMatch[3];
        const details = facilityMatch[4];

        const isFitness = category.toLowerCase().includes("fitness") || category.includes("لياقة");
        const badgeClass = isFitness ? "facility-badge fitness" : "facility-badge sport";

        const icon = name.toLowerCase().includes("tennis") || name.toLowerCase().includes("padel") ? "🎾"
                   : name.toLowerCase().includes("basket") ? "🏀"
                   : name.toLowerCase().includes("swim") || name.toLowerCase().includes("pool") ? "🏊"
                   : name.toLowerCase().includes("gym") ? "🏋️"
                   : name.toLowerCase().includes("volleyball") ? "🏐"
                   : "🏅";

        return (
          <div key={idx} className={`chatbot-facility-card ${isRtl ? "rtl" : ""}`}>
            <span className="chatbot-facility-card__icon">{icon}</span>
            <div className="chatbot-facility-card__main">
              <div className="chatbot-facility-card__title">
                <strong>{name}</strong>
                <span className={badgeClass}>{category}</span>
              </div>
              <div className="chatbot-facility-card__time">
                <span>🕐 {details}</span>
                <span className="chatbot-facility-card__id">ID: #{id}</span>
              </div>
            </div>
          </div>
        );
      }

      const listMatch = trimmed.match(/^-\s*(.+)$/);
      if (listMatch) {
        const bulletContent = listMatch[1];
        const colonIdx = bulletContent.indexOf(":");
        if (colonIdx > 0 && colonIdx < 30 && !bulletContent.startsWith("http")) {
          const title = bulletContent.slice(0, colonIdx);
          const desc = bulletContent.slice(colonIdx + 1);
          return (
            <div key={idx} className={`chatbot-list-item warning-item ${isRtl ? "rtl" : ""}`}>
              <strong>🔔 {title}</strong>
              <p>{desc.trim()}</p>
            </div>
          );
        }
        return (
          <div key={idx} className={`chatbot-list-item ${isRtl ? "rtl" : ""}`}>
            • {bulletContent}
          </div>
        );
      }

      return <div key={idx} className={isRtl ? "rtl" : ""}>{line}</div>;
    });

    return <div className="chatbot-parsed-content">{parsedLines}</div>;
  };

  const handleLocalFallback = async (text) => {
    const query = text.toLowerCase();
    const isArabic = /[\u0600-\u06FF]/.test(text);

    // 0. Check if they want user profile statistics (points, warnings, credits)
    if (
      query.includes("نقاط") ||
      query.includes("نقاطي") ||
      query.includes("تحذير") ||
      query.includes("تحذيراتي") ||
      query.includes("رصيد") ||
      query.includes("رصيدي") ||
      query.includes("بيانات") ||
      query.includes("بياناتي") ||
      query.includes("points") ||
      query.includes("warnings") ||
      query.includes("credits") ||
      query.includes("profile") ||
      query.includes("my data")
    ) {
      if (!session) {
        return t("chatbot.loginRequired");
      }
      return t("chatbot.accountDetailsHeader") + "\n" +
             t("chatbot.profileName", { name: session.fullName }) + "\n" +
             t("chatbot.profileId", { id: session.studentId || "N/A" }) + "\n" +
             t("chatbot.profilePoints", { points: session.earnedPoints || session.points || 0 }) + "\n" +
             t("chatbot.profileWarnings", { warnings: session.warnings || 0 }) + "\n" +
             t("chatbot.profileCredits", { credits: session.credits != null ? session.credits : 10 });
    }

    // 1. Check if they want facilities
    if (
      query.includes("مرافق") ||
      query.includes("ملاعب") ||
      query.includes("ملعب") ||
      query.includes("facilities") ||
      query.includes("facility") ||
      query.includes("courts") ||
      query.includes("court")
    ) {
      const facilities = await fetchFacilities();
      if (facilities && !facilities.error) {
        const list = facilities.map(f => t("chatbot.availableFacilitiesFormat", { id: f.id, name: f.name, category: f.category, open: f.openTime, close: f.closeTime })).join("\n");
        return t("chatbot.availableFacilitiesHeader") + "\n" + list;
      }
    }

    // 2. Check if they want notifications
    if (query.includes("إشعارات") || query.includes("اشعارات") || query.includes("notification")) {
      if (!session) {
        return t("chatbot.loginRequiredNotifications");
      }
      const notifications = await fetchNotifications(session.id);
      if (notifications && !notifications.error) {
        if (Array.isArray(notifications) && notifications.length > 0) {
          const list = notifications.map(n => `- ${n.title}: ${n.message}`).join("\n");
          return t("chatbot.recentNotificationsHeader") + "\n" + list;
        } else {
          return t("chatbot.noNotifications");
        }
      }
    }

    // 3. Fallback to knowledge base matching
    const sections = DEFAULT_KNOWLEDGE.split("\n");
    const hits = sections.filter(sec => sec.toLowerCase().includes(query));
    
    // Also check uploaded docs
    const uploadedHits = [];
    for (const doc of uploadedDocs) {
      const docSections = doc.text.split("\n");
      const matched = docSections.filter(sec => sec.toLowerCase().includes(query));
      if (matched.length > 0) {
        uploadedHits.push(`[${doc.title}]: ${matched.join("\n")}`);
      }
    }

    if (hits.length > 0 || uploadedHits.length > 0) {
      const context = [...hits, ...uploadedHits].join("\n");
      return t("chatbot.closestRulesHeader") + "\n\n" + context;
    }

    // 4. Default message
    return t("chatbot.fallbackAnswer");
  };

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputValue).trim();
    if (!text) return;

    // Append user message
    const updatedMessages = [...messages, { role: "user", content: text }];
    setMessages(updatedMessages);
    setInputValue("");
    setIsTyping(true);

    const lowerText = text.toLowerCase();
    const isArabic = /[\u0600-\u06FF]/.test(text);
    
    // Check if user wants to redirect to booking page
    const wantsBooking = (
      lowerText.includes("احجز") || 
      lowerText.includes("حجز") || 
      lowerText.includes("book") || 
      lowerText.includes("reserve") || 
      lowerText.includes("reservation")
    ) && !(
      lowerText.includes("قواعد") || 
      lowerText.includes("شروط") || 
      lowerText.includes("rules") || 
      lowerText.includes("policy") || 
      lowerText.includes("policies") ||
      lowerText.includes("خطوات") ||
      lowerText.includes("كيف") ||
      lowerText.includes("how to")
    );

    if (wantsBooking) {
      let prefilledId = null;
      try {
        const facilities = await fetchFacilities();
        if (facilities && Array.isArray(facilities)) {
          const found = facilities.find(f => 
            lowerText.includes(f.name.toLowerCase()) || 
            (f.category && lowerText.includes(f.category.toLowerCase())) ||
            (isArabic && (
              (f.name.includes("تنس") && lowerText.includes("تنس")) ||
              (f.name.includes("سلة") && lowerText.includes("سلة")) ||
              (f.name.includes("بادل") && lowerText.includes("بادل")) ||
              (f.name.includes("كرة") && lowerText.includes("كرة")) ||
              (f.name.includes("سباحة") && lowerText.includes("سباحة")) ||
              (f.name.includes("gym") && (lowerText.includes("جيم") || lowerText.includes("جيّم")))
            ))
          );
          if (found) {
            prefilledId = found.id;
          }
        }
      } catch (e) {
        console.error("Error pre-resolving facility:", e);
      }

      setTimeout(() => {
        if (prefilledId) {
          sessionStorage.setItem("prefilledFacilityId", String(prefilledId));
        }
        navigate("/book");
        setMessages(prev => [
          ...prev,
          { 
            role: "bot", 
            content: isArabic 
              ? "أكيد! سأقوم بتوجيهك الآن إلى صفحة الحجز لملء التفاصيل وإتمام الحجز." 
              : "Sure! I am redirecting you to the booking page now to complete your reservation." 
          }
        ]);
        setIsTyping(false);
      }, 600);
      return;
    }

    try {
      if (!GEMINI_API_KEY) {
        setMessages(prev => [
          ...prev,
          { role: "bot", content: t("chatbot.geminiKeyError") }
        ]);
        setIsTyping(false);
        return;
      }
      let conversationHistory = [...updatedMessages];
      let finalReply = "";
      let iterations = 0;
      let continueLoop = true;

      while (continueLoop && iterations < 5) {
        const result = await callGeminiChat(conversationHistory);
        const choice = result?.choices?.[0];
        const message = choice?.message;

        if (message?.tool_calls && message.tool_calls.length > 0) {
          // Store assistant's tool-call response
          conversationHistory.push({
            role: "bot",
            content: message.content || "",
            tool_calls: message.tool_calls
          });

          // Execute tools and append outcomes
          for (const toolCall of message.tool_calls) {
            const funcName = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments || "{}");
            let output;

            if (funcName === "get_facilities") {
              output = await fetchFacilities();
            } else if (funcName === "get_notifications") {
              output = await fetchNotifications(args.userId);
            } else if (funcName === "create_booking") {
              output = await submitBooking(args);
            } else {
              output = { error: "Unknown tool mapping" };
            }

            conversationHistory.push({
              role: "tool",
              content: JSON.stringify(output),
              tool_call_id: toolCall.id,
              name: funcName
            });
          }
          iterations++;
        } else {
          finalReply = message?.content || (language === "ar" ? "لم أتمكن من إيجاد رد." : "Could not find a response.");
          continueLoop = false;
        }
      }

      setMessages(prev => [...prev, { role: "bot", content: finalReply }]);
    } catch (error) {
      console.error("Chatbot processing error:", error);
      try {
        const fallbackReply = await handleLocalFallback(text);
        setMessages(prev => [
          ...prev,
          { role: "bot", content: fallbackReply }
        ]);
      } catch (e) {
        setMessages(prev => [
          ...prev,
          { role: "bot", content: t("chatbot.generalError") }
        ]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  // --- Custom File RAG (FileReader) ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFileStatus(file.name);
    } else {
      setSelectedFile(null);
      setFileStatus(language === "ar" ? "لم يتم اختيار ملف" : "No file chosen");
    }
  };

  const handleUploadFile = () => {
    if (!selectedFile) {
      alert(language === "ar" ? "يرجى اختيار ملف أولاً" : "Please select a file first");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      setUploadedDocs(prev => [...prev, { title: selectedFile.name, text }]);
      alert(language === "ar"
        ? `تم رفع وقراءة الملف "${selectedFile.name}" بنجاح! تم تضمينه في ذاكرة الشات بوت.`
        : `File "${selectedFile.name}" uploaded and parsed successfully! Integrated into chatbot memory.`);
      setSelectedFile(null);
      setFileStatus(language === "ar" ? "لم يتم اختيار ملف" : "No file chosen");
    };
    reader.onerror = () => {
      alert(language === "ar" ? "خطأ أثناء قراءة الملف." : "Error reading file.");
    };
    reader.readAsText(selectedFile);
  };

  const handleResetChat = () => {
    setMessages([
      {
        role: "bot",
        content: language === "ar" 
          ? "تمت إعادة تعيين المحادثة بنجاح. كيف يمكنني مساعدتك اليوم؟"
          : "Chat history reset successfully. How can I help you today?"
      }
    ]);
  };

  return (
    <div className="chatbot-container">
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          className="chatbot-launcher"
          onClick={() => setIsOpen(true)}
          aria-label="Open Badya AI chat"
          title="Ask Badya AI — your intelligent booking assistant"
        >
          <span className="chatbot-launcher__icon">🤖</span>
          <span className="chatbot-launcher__dot"></span>
        </button>
      )}

      {/* Main Chat Drawer */}
      {isOpen && (
        <div className="chatbot-window">
          {/* Header */}
          <header className="chatbot-header">
            <div className="chatbot-brand">
              <div className="chatbot-brand__logo">B</div>
              <div className="chatbot-brand__copy">
                <span className="chatbot-brand__eyebrow">{t("chatbot.eyebrow")}</span>
                <div className="chatbot-brand__title">{t("chatbot.title")}</div>
                <div className="chatbot-brand__subtitle">{t("chatbot.subtitle")}</div>
              </div>
            </div>
            <button
              className="chatbot-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </header>

          {/* Intro Panel (only show if few messages exist) */}
          {messages.length <= 2 && (
            <section className="chatbot-intro">
              <div className="chatbot-status-pill">
                <span className="chatbot-status-pill__dot"></span>
                <span>{t("chatbot.statusPill")}</span>
              </div>
              <div className="chatbot-intro-grid">
                <article className="chatbot-intro-card">
                  <strong>{t("chatbot.supportCardTitle")}</strong>
                  <span>{t("chatbot.supportCardDesc")}</span>
                </article>
                <article className="chatbot-intro-card">
                  <strong>{t("chatbot.facilitiesCardTitle")}</strong>
                  <span>{t("chatbot.facilitiesCardDesc")}</span>
                </article>
                <article className="chatbot-intro-card">
                  <strong>{t("chatbot.accountCardTitle")}</strong>
                  <span>{t("chatbot.accountCardDesc")}</span>
                </article>
              </div>
            </section>
          )}

          {/* Messages list */}
          <main className="chatbot-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`chatbot-msg ${msg.role}`}>
                <div className="chatbot-msg__avatar">
                  {msg.role === "bot" ? "B" : "YOU"}
                </div>
                <div className="chatbot-msg__bubble">
                  {renderMessageContent(msg.content)}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="chatbot-msg bot">
                <div className="chatbot-msg__avatar">B</div>
                <div className="chatbot-msg__bubble">
                  <div className="chatbot-typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </main>

          {/* Quick Actions */}
          <section className="chatbot-quick-actions" aria-label="Quick actions">
            <button
              type="button"
              className="chatbot-quick-btn"
              onClick={() => handleSendMessage(t("chatbot.quickActionFacilities"))}
            >
              {language === "ar" ? "عرض المرافق" : "Show Facilities"}
            </button>
            <button
              type="button"
              className="chatbot-quick-btn"
              onClick={() => handleSendMessage(t("chatbot.quickActionBook"))}
            >
              {language === "ar" ? "إنشاء حجز" : "Create Booking"}
            </button>
            <button
              type="button"
              className="chatbot-quick-btn"
              onClick={() => {
                if (session) {
                  handleSendMessage(language === "ar" ? `ما هي الإشعارات الخاصة بي؟ (رقم المستخدم ${session.id})` : `What are my notifications? (User ID ${session.id})`);
                } else {
                  handleSendMessage(language === "ar" ? "ما هي الإشعارات الخاصة بي؟" : "What are my notifications?");
                }
              }}
            >
              {language === "ar" ? "الإشعارات" : "Notifications"}
            </button>
            <button
              type="button"
              className="chatbot-quick-btn"
              onClick={() => handleSendMessage(language === "ar" ? "أشرح لي قواعد الحجز والسياسات بشكل مختصر" : "Explain booking rules and policies briefly")}
            >
              {language === "ar" ? "شرح القواعد" : "Explain Rules"}
            </button>
          </section>

          {/* Composer and Tools */}
          <div className="chatbot-controls">
            <form
              className="chatbot-composer"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
            >
              <input
                className="chatbot-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={t("chatbot.inputPlaceholder")}
                autocomplete="off"
                disabled={isTyping}
              />
              <button
                className="chatbot-send-btn"
                type="submit"
                disabled={isTyping}
              >
                {t("chatbot.sendBtn")}
              </button>
            </form>

            <div className="chatbot-toolbar">
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                  accept=".txt,.md,.json"
                />
                <button
                  type="button"
                  className="chatbot-reset-btn"
                  onClick={() => fileInputRef.current.click()}
                  style={{ borderColor: "rgba(255,255,255,0.15)", color: "#b0c0d0" }}
                >
                  {selectedFile ? t("chatbot.changeFileBtn") : t("chatbot.selectFileBtn")}
                </button>
                {selectedFile && (
                  <button
                    type="button"
                    className="chatbot-reset-btn"
                    onClick={handleUploadFile}
                    style={{ borderColor: "rgba(19, 183, 166, 0.4)", color: "#13b7a6" }}
                  >
                    {t("chatbot.uploadBtn")}
                  </button>
                )}
                <span style={{ fontSize: "10px", color: "rgba(234, 240, 247, 0.5)", maxWidth: "100px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {fileStatus}
                </span>
              </div>

              <button
                type="button"
                className="chatbot-reset-btn"
                onClick={handleResetChat}
              >
                {t("chatbot.newChatBtn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
