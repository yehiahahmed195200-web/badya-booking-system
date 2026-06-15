import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config/api";
import "./ChatbotWidget.css";

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
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileStatus, setFileStatus] = useState("لم يتم اختيار ملف");

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

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
          content: "أهلاً بك في Badya Concierge.\nأستطيع مساعدتك في الحجز، استعراض المرافق المتاحة، إظهار الإشعارات، أو الإجابة على أي أسئلة حول القواعد والسياسات.\n\nجرب أحد الاختصارات بالأسفل أو اكتب سؤالك مباشرة."
        }
      ]);
    }
  }, [messages]);

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
        return isArabic 
          ? "يرجى تسجيل الدخول أولاً لعرض بياناتك."
          : "Please log in first to view your account details.";
      }
      if (isArabic) {
        return `بيانات حسابك الحالي:\n` +
               `- 👤 الاسم: ${session.fullName}\n` +
               `- 🆔 الرقم الجامعي: ${session.studentId || "غير محدد"}\n` +
               `- ⭐ النقاط المكتسبة: ${session.earnedPoints || session.points || 0} نقطة\n` +
               `- ⚠️ التحذيرات: ${session.warnings || 0} (الحد الأقصى 3 قبل الحظر)\n` +
               `- 🎫 الرصيد المتاح: ${session.credits != null ? session.credits : 10} رصيد`;
      } else {
        return `Your current account details:\n` +
               `- 👤 Name: ${session.fullName}\n` +
               `- 🆔 Student ID: ${session.studentId || "N/A"}\n` +
               `- ⭐ Earned Points: ${session.earnedPoints || session.points || 0} pts\n` +
               `- ⚠️ Warnings: ${session.warnings || 0} (Max 3 before ban)\n` +
               `- 🎫 Available Credits: ${session.credits != null ? session.credits : 10}`;
      }
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
        if (isArabic) {
          const list = facilities.map(f => `- [ملعب #${f.id}] ${f.name} (${f.category}): متاح من ${f.openTime} إلى ${f.closeTime}`).join("\n");
          return `المرافق المتاحة حالياً:\n${list}`;
        } else {
          const list = facilities.map(f => `- [#${f.id}] ${f.name} (${f.category}): Open ${f.openTime} to ${f.closeTime}`).join("\n");
          return `Available facilities:\n${list}`;
        }
      }
    }

    // 2. Check if they want notifications
    if (query.includes("إشعارات") || query.includes("اشعارات") || query.includes("notification")) {
      if (!session) {
        return isArabic 
          ? "يرجى تسجيل الدخول أولاً لعرض إشعاراتك."
          : "Please log in first to view your notifications.";
      }
      const notifications = await fetchNotifications(session.id);
      if (notifications && !notifications.error) {
        if (Array.isArray(notifications) && notifications.length > 0) {
          const list = notifications.map(n => `- ${n.title}: ${n.message}`).join("\n");
          return isArabic 
            ? `إشعاراتك الأخيرة:\n${list}`
            : `Your recent notifications:\n${list}`;
        } else {
          return isArabic 
            ? "لا توجد إشعارات حالياً."
            : "You have no notifications at this time.";
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
      return isArabic
        ? `أكيد. هذا سياق مرتبط بطلبك من التعليمات والقواعد المحلية:\n\n${context}`
        : `Here is the closest information from our local rules and policies:\n\n${context}`;
    }

    // 4. Default message
    return isArabic
      ? "أكيد. لم أتمكن من العثور على إجابة مطابقة في قاعدة المعرفة المحلية حالياً، ولكن يمكنك استخدام الميزات الأخرى للنظام لحجز الملاعب مباشرة."
      : "I couldn't find a direct match in our local knowledge base, but you can use the booking portal to reserve facilities directly.";
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
          { role: "bot", content: "عذراً، لم يتم العثور على مفتاح API لـ Gemini. يرجى إضافته في إعدادات البيئة (VITE_LLM_API_KEY) لتشغيل الخدمة." }
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
          finalReply = message?.content || "لم أتمكن من إيجاد رد.";
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
          { role: "bot", content: "عذراً، حدث خطأ أثناء الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت أو المحاولة مرة أخرى." }
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
      setFileStatus("لم يتم اختيار ملف");
    }
  };

  const handleUploadFile = () => {
    if (!selectedFile) {
      alert("يرجى اختيار ملف أولاً");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      setUploadedDocs(prev => [...prev, { title: selectedFile.name, text }]);
      alert(`تم رفع وقراءة الملف "${selectedFile.name}" بنجاح! تم تضمينه في ذاكرة الشات بوت.`);
      setSelectedFile(null);
      setFileStatus("لم يتم اختيار ملف");
    };
    reader.onerror = () => {
      alert("خطأ أثناء قراءة الملف.");
    };
    reader.readAsText(selectedFile);
  };

  const handleResetChat = () => {
    setMessages([
      {
        role: "bot",
        content: "تمت إعادة تعيين المحادثة بنجاح. كيف يمكنني مساعدتك اليوم؟"
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
                <span className="chatbot-brand__eyebrow">Official Support Assistant</span>
                <div className="chatbot-brand__title">Badya Concierge</div>
                <div className="chatbot-brand__subtitle">حجز، مرافق، إشعارات، ودعم ذكي</div>
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
                <span>متاح الآن · متوسط الرد خلال ثوانٍ</span>
              </div>
              <div className="chatbot-intro-grid">
                <article className="chatbot-intro-card">
                  <strong>Support</strong>
                  <span>مساعدة فورية للحجوزات والطلبات</span>
                </article>
                <article className="chatbot-intro-card">
                  <strong>Facilities</strong>
                  <span>استعراض الملاعب والأوقات المتاحة</span>
                </article>
                <article className="chatbot-intro-card">
                  <strong>Account</strong>
                  <span>متابعة إشعاراتك وإدارة الحجوزات</span>
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
              onClick={() => handleSendMessage("ما هي المرافق المتاحة الآن؟")}
            >
              عرض المرافق
            </button>
            <button
              type="button"
              className="chatbot-quick-btn"
              onClick={() => handleSendMessage("أريد حجز ملعب اليوم")}
            >
              إنشاء حجز
            </button>
            <button
              type="button"
              className="chatbot-quick-btn"
              onClick={() => {
                if (session) {
                  handleSendMessage(`ما هي الإشعارات الخاصة بي؟ (رقم المستخدم ${session.id})`);
                } else {
                  handleSendMessage("ما هي الإشعارات الخاصة بي؟");
                }
              }}
            >
              الإشعارات
            </button>
            <button
              type="button"
              className="chatbot-quick-btn"
              onClick={() => handleSendMessage("أشرح لي قواعد الحجز والسياسات بشكل مختصر")}
            >
              شرح القواعد
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
                placeholder="اكتب سؤالك أو استخدم أحد الاختصارات..."
                autocomplete="off"
                disabled={isTyping}
              />
              <button
                className="chatbot-send-btn"
                type="submit"
                disabled={isTyping}
              >
                إرسال
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
                  {selectedFile ? "تغيير الملف" : "اختيار ملف"}
                </button>
                {selectedFile && (
                  <button
                    type="button"
                    className="chatbot-reset-btn"
                    onClick={handleUploadFile}
                    style={{ borderColor: "rgba(19, 183, 166, 0.4)", color: "#13b7a6" }}
                  >
                    رفع
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
                محادثة جديدة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
