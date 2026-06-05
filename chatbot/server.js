require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const OpenAI = require('openai');

// --- Configuration ---
const PORT = process.env.CHATBOT_PORT || 3333;
const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY || null;
const LLM_BASE_URL = process.env.LLM_BASE_URL || (process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : null);
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

const openai = OPENAI_KEY
    ? new OpenAI({ apiKey: OPENAI_KEY, ...(LLM_BASE_URL ? { baseURL: LLM_BASE_URL } : {}) })
    : null;
const sessionState = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function createChatCompletionWithRetry(openaiClient, params, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await openaiClient.chat.completions.create(params);
        } catch (err) {
            const isRateLimit = err.status === 429 || (err.message && err.message.includes('429')) || err.name === 'RateLimitError';
            const isServerError = err.status >= 500;
            if ((isRateLimit || isServerError) && i < retries - 1) {
                const backoff = delay * Math.pow(2, i);
                console.warn(`[OpenAI Retry] Hit status ${err.status || err.name}. Retrying in ${backoff}ms... (Attempt ${i + 1}/${retries})`);
                await sleep(backoff);
                continue;
            }
            throw err;
        }
    }
}

const MAX_HISTORY_ITEMS = 12;
const MAX_MESSAGE_LEN = 1200;

function getSessionState(sessionId = 'default') {
    const key = String(sessionId || 'default');
    if (!sessionState.has(key)) {
        sessionState.set(key, {
            lastTopic: null,
            lastLanguage: 'en',
            lastUserMessage: '',
            lastBotMessage: '',
            interactionCount: 0,
            userProfile: {
                name: null,
                preferredSport: null,
                communicationStyle: null
            }
        });
    }
    return sessionState.get(key);
}

function updateSessionState(sessionId, patch = {}) {
    const state = getSessionState(sessionId);
    Object.assign(state, patch);
    return state;
}

function truncateText(value = '', max = MAX_MESSAGE_LEN) {
    return String(value || '').slice(0, max);
}

function sanitizeHistory(history = []) {
    if (!Array.isArray(history)) return [];
    return history
        .filter(item => item && (item.role === 'user' || item.role === 'assistant'))
        .map(item => ({ role: item.role, content: truncateText(item.content || '') }))
        .slice(-MAX_HISTORY_ITEMS);
}

function extractUserProfileHints(message = '', language = 'en') {
    const text = String(message || '').trim();
    if (!text) return {};
    const lowered = text.toLowerCase();
    const patch = {};

    const namePatterns = [
        /\bmy name is\s+([a-z][a-z\s'-]{1,30})/i,
        /\bi am\s+([a-z][a-z\s'-]{1,30})/i,
        /(?:انا اسمي|أنا اسمي|اسمي)\s+([\u0600-\u06FFa-zA-Z\s'-]{1,30})/i
    ];
    for (const pattern of namePatterns) {
        const m = text.match(pattern);
        if (m && m[1]) {
            patch.name = m[1].trim();
            break;
        }
    }

    const sportMap = [
        { key: 'football', terms: ['football', 'soccer', 'كرة'] },
        { key: 'tennis', terms: ['tennis', 'تنس'] },
        { key: 'padel', terms: ['padel', 'بادل'] },
        { key: 'basketball', terms: ['basketball', 'سلة'] },
        { key: 'volleyball', terms: ['volleyball', 'طائرة'] },
        { key: 'swimming', terms: ['swim', 'swimming', 'سباحة', 'pool'] }
    ];
    for (const sport of sportMap) {
        if (sport.terms.some(term => lowered.includes(term))) {
            patch.preferredSport = sport.key;
            break;
        }
    }

    if (/\bbrief|short|quick\b/i.test(lowered) || /\bمختصر|سريع\b/i.test(lowered)) {
        patch.communicationStyle = 'brief';
    } else if (/\bdetail|detailed\b/i.test(lowered) || /\bبالتفصيل|تفصيلي\b/i.test(lowered)) {
        patch.communicationStyle = 'detailed';
    } else if (language === 'ar') {
        patch.communicationStyle = 'arabic-friendly';
    }

    return patch;
}

function updateSessionMemoryFromMessage(session, message = '', language = 'en') {
    if (!session || !message) return;
    session.interactionCount = (session.interactionCount || 0) + 1;
    const hints = extractUserProfileHints(message, language);
    session.userProfile = {
        ...(session.userProfile || {}),
        ...hints
    };
}

function buildSessionMemoryPrompt(session = {}) {
    const profile = session.userProfile || {};
    const pieces = [];
    if (profile.name) pieces.push(`User name: ${profile.name}`);
    if (profile.preferredSport) pieces.push(`Preferred sport: ${profile.preferredSport}`);
    if (profile.communicationStyle) pieces.push(`Preferred style: ${profile.communicationStyle}`);
    if (session.lastTopic) pieces.push(`Last topic: ${session.lastTopic}`);
    if (session.lastLanguage) pieces.push(`Last language: ${session.lastLanguage}`);
    if (!pieces.length) return '';
    return `Session memory:\n- ${pieces.join('\n- ')}`;
}

function applyResponseGuardrails(reply = '', language = 'en') {
    let output = String(reply || '').trim();
    if (!output) {
        return language === 'ar'
            ? 'مش متأكد إني فهمت سؤالك بالكامل، ممكن تعيد صياغته باختصار؟'
            : 'I might have missed part of your question. Could you rephrase it briefly?';
    }

    output = output.replace(/\bAs an AI language model\b/gi, '');
    output = output.replace(/\bI am just an AI\b/gi, 'I may be missing context');
    output = output.trim();

    if (output.length > 2200) {
        output = `${output.slice(0, 2190)}...`;
    }

    return output;
}

function normalizeText(text = '') {
    return String(text || '').toLowerCase().trim();
}

function includesAny(text, terms = []) {
    return terms.some(term => text.includes(term));
}

function detectLanguage(text = '', preferred = 'en') {
    const value = String(text || '').trim();
    if (!value) return preferred;

    if (/[\u0600-\u06FF]/.test(value)) return 'ar';
    if (/\b(hola|gracias|reservar|cancha|horario|deporte)\b/i.test(value) || /[¿¡ñáéíóúü]/i.test(value)) return 'es';
    if (/\b(bonjour|merci|réserver|horaire|terrain|sport)\b/i.test(value) || /[àâçéèêëîïôùûüÿœ]/i.test(value)) return 'fr';
    if (/\b(guten tag|danke|buchen|spielfeld|sportanlage)\b/i.test(value)) return 'de';
    return preferred;
}

function localize(lang, translations) {
    return translations[lang] || translations.en;
}

function pickVariant(lang, variants) {
    const options = variants[lang] || variants.en;
    return options[Math.floor(Math.random() * options.length)];
}

function isGreetingMessage(text = '') {
    const value = String(text || '').toLowerCase();
    const englishGreeting = /(hello|hi|hey|good morning|good afternoon|good evening)\b/i.test(value);
    const multilingualGreeting = [
        'bonjour', 'hola', 'hallo', 'ciao', 'مرحبا', 'اهلا', 'أهلا', 'أهلاً', 'السلام', 'salut', 'guten tag'
    ].some(term => value.includes(term));
    return englishGreeting || multilingualGreeting;
}

function isWellbeingMessage(text = '') {
    const value = String(text || '').toLowerCase();
    return /(how are you|how's it going|what's up|sup\b|عامل ايه|اخبارك|أخبارك|إزيك|ازيك|عامله ايه)/i.test(value);
}

function looksLikeGeneralKnowledgeQuestion(text = '') {
    const value = String(text || '').toLowerCase().trim();
    const starters = ['who', 'what', 'when', 'where', 'why', 'how', 'مين', 'ما هو', 'ماهي', 'ليه', 'لماذا', 'ازاي', 'كيف', 'امتى', 'متى', 'فين', 'أين'];
    return starters.some(prefix => value.startsWith(prefix));
}

function isShortFollowUp(text = '') {
    const value = normalizeText(text);
    return value.split(/\s+/).filter(Boolean).length <= 4;
}

function isBookingContinuationMessage(text = '') {
    const value = normalizeText(text);
    return [
        'yes', 'yep', 'sure', 'okay', 'ok', 'تمام', 'موافق', 'أوافق', 'اوكي', 'حاضر', 'كمل', 'كمّل', 'continue', 'go ahead'
    ].some(term => value.includes(term));
}

function isOffTopicOrComplaint(text = '') {
    const value = normalizeText(text);
    return includesAny(value, ['bot', 'chat', 'يرد', 'رد', 'مش بيعرف', 'مش فاهم', 'problem', 'error', 'bug', 'مشكلة', 'غلط', 'not working', 'doesn’t work', 'does not work']);
}

function detectIntent(message = '', history = [], state = {}) {
    const text = normalizeText(message);
    const context = normalizeText(`${history?.[history.length - 1]?.content || ''} ${message}`);

    if (isWellbeingMessage(text)) return 'wellbeing';
    if (isGreetingMessage(text)) return 'greeting';
    if (includesAny(context, ['cancel booking', 'delete booking', 'remove booking', 'إلغاء حجز', 'الغاء حجز', 'مسح حجز'])) return 'cancel_booking';
    if (includesAny(context, ['my bookings', 'my booking', 'check my bookings', 'الحجوزات بتاعتي', 'حجوزاتي', 'list bookings', 'حجوزات', 'وريني الحجوزات', 'عرض حجوزاتي'])) return 'my_bookings';
    if (includesAny(context, ['book', 'reserve', 'حجز', 'reserv', 'réserv', 'reserva', 'buch'])) return 'booking';
    if (includesAny(context, ['available', 'facilit', 'facility', 'courts', 'ملعب', 'cancha', 'terrain', 'salle'])) return 'facilities';
    if (includesAny(context, ['rule', 'policy', 'قواعد', 'لوائح', 'regla', 'règle', 'richt'])) return 'rules';
    if (includesAny(context, ['contact', 'support', 'help', 'تواصل', 'دعم', 'contacto', 'hilfe'])) return 'contact';
    if (includesAny(context, ['time', 'hour', 'ساع', 'hora', 'heure', 'öff', 'schedule', 'when'])) return 'hours';
    if (includesAny(context, ['thank', 'thanks', 'shukran', 'gracias', 'merci', 'danke'])) return 'thanks';
    if (includesAny(context, ['bye', 'goodbye', 'سلام', 'ma salama'])) return 'goodbye';
    if (includesAny(context, ['price', 'cost', 'fee', 'كم', 'سعر', 'coste', 'precio', 'preis'])) return 'pricing';
    if (includesAny(context, ['where', 'location', 'room', 'office', 'فين', 'أين', 'adresse', 'wo'])) return 'location';
    if (isShortFollowUp(text) && state.lastTopic) return `followup:${state.lastTopic}`;
    return 'unknown';
}

function getTopRelevantDocSnippets(message = '', limit = 2) {
    const terms = normalizeText(message).split(/\s+/).filter(t => t && t.length > 2);
    if (!terms.length || !docs.length) return [];

    const scored = docs
        .map(doc => {
            const hay = normalizeText(`${doc.title} ${doc.content}`);
            const score = terms.reduce((acc, term) => acc + (hay.includes(term) ? 1 : 0), 0);
            return { doc, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => {
            const lines = String(item.doc.content || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            return `${item.doc.title}: ${lines.slice(0, 2).join(' ')}`;
        });

    return scored;
}

function buildGeneralSmartReply(message = '', language = 'en', state = {}) {
    const snippets = getTopRelevantDocSnippets(message, 2);
    const mentionDocs = snippets.length > 0;
    const isGeneralQuestion = looksLikeGeneralKnowledgeQuestion(message);

    if (language === 'ar') {
        if (!openai && isGeneralQuestion) {
            return [
                'أقدر أرد على الأسئلة العامة جدًا بكفاءة أعلى بعد تفعيل مفتاح نموذج الذكاء.',
                'حاليًا أنا شغال بوضع محلي ذكي يركز أكثر على نظام الحجز والملاعب.',
                'لو فعّلت OPENAI_API_KEY أو LLM_API_KEY في إعدادات الشات بوت، هقدر أجاوبك على أي سؤال عام بشكل أفضل.'
            ].join(' ');
        }

        const base = [
            state?.userProfile?.name ? `تمام يا ${state.userProfile.name}، فهمت سؤالك.` : 'تمام، فهمت سؤالك.',
            'أقدر أساعدك في أي حاجة تخص الحجز، الملاعب، القوانين، المواعيد، والمتابعة خطوة بخطوة.'
        ];

        if (mentionDocs) {
            return `${base.join(' ')}\n\nمعلومات مرتبطة بسؤالك:\n- ${snippets.join('\n- ')}\n\nلو تحب، أجاوبك بإجابة مختصرة جدًا أو بالتفصيل.`;
        }

        if (state.lastTopic === 'booking' && (isBookingContinuationMessage(message) || /\d|اليوم|بكرة|غدا|غدًا|tomorrow|today/i.test(message)) && !isOffTopicOrComplaint(message)) {
            return 'ممتاز، نكمّل الحجز مع بعض. ابعتلي اسم الملعب واليوم والوقت المناسبين ليك.';
        }

        return `${base.join(' ')}\n\nقولّي سؤالك بشكل مباشر وأنا هرد عليك فورًا.`;
    }

    const base = [
        state?.userProfile?.name ? `Got it, ${state.userProfile.name} — I understand your question.` : 'Got it — I understand your question.',
        'I can help with bookings, facilities, rules, schedules, and quick step-by-step guidance.'
    ];

    if (!openai && isGeneralQuestion) {
        return [
            'I can answer broad general-knowledge questions much better after enabling an LLM API key.',
            'Right now I am running in smart local mode focused on booking and facilities.',
            'Set OPENAI_API_KEY or LLM_API_KEY in chatbot environment settings to unlock full general answers.'
        ].join(' ');
    }

    if (mentionDocs) {
        return `${base.join(' ')}\n\nRelated info:\n- ${snippets.join('\n- ')}\n\nIf you want, I can give a short answer or a detailed one.`;
    }

    if (state.lastTopic === 'booking' && (isBookingContinuationMessage(message) || /\d|today|tomorrow/i.test(message)) && !isOffTopicOrComplaint(message)) {
        return 'Great, let’s continue your booking. Send the facility name with your preferred day and time.';
    }

    return `${base.join(' ')}\n\nAsk me directly and I’ll answer right away.`;
}

function buildFacilityAnswer(message = '', language = 'en') {
    const text = normalizeText(message);
    const english = {
        football: 'Football pitch: capacity 10-22 players, free for students, balls are provided at the sports office, and football boots are required.',
        tennis: 'Tennis courts: 2 courts, capacity 2-4 players each, free, and rackets are available for rent. Please use non-marking shoes.',
        padel: 'Padel court: capacity 2-4 players, 50 EGP per hour, and it is very popular so booking 3 days in advance is a good idea.',
        basketball: 'Indoor basketball/volleyball court: used for official university matches and open recreation, with capacity up to 30 people.',
        volleyball: 'Indoor basketball/volleyball court: used for official university matches and open recreation, with capacity up to 30 people.',
        pool: 'Swimming pool: open from 7 AM to 10 PM, swimming caps are mandatory, and no diving in shallow areas.'
    };

    const arabic = {
        football: 'ملعب كرة القدم سعته من 10 إلى 22 لاعب، ومجاني للطلاب، والكرة متوفرة في المكتب الرياضي، ولازم حذاء كرة قدم مناسب.',
        tennis: 'ملاعب التنس عددها 2، وسعة كل ملعب من 2 إلى 4 لاعبين، ومجانية، والمضارب ممكن تتأجر، ولازم حذاء non-marking.',
        padel: 'ملعب البادل سعته من 2 إلى 4 لاعبين، وسعره 50 جنيه في الساعة، ويفضل الحجز قبلها بـ 3 أيام لأنه مطلوب جدًا.',
        basketball: 'ملعب السلة والطائرة الداخلي مخصص للمباريات الرسمية والنشاط المفتوح، وسعته توصل لـ 30 شخص.',
        volleyball: 'ملعب السلة والطائرة الداخلي مخصص للمباريات الرسمية والنشاط المفتوح، وسعته توصل لـ 30 شخص.',
        pool: 'حمام السباحة متاح من 7 صباحًا إلى 10 مساءً، ولازم قبعة سباحة، وممنوع الغطس في الأماكن الضحلة.'
    };

    const bank = language === 'ar' ? arabic : english;
    if (includesAny(text, ['football', 'soccer', 'كرة', 'foot'])) return bank.football;
    if (includesAny(text, ['tennis', 'تنس', 'racket', 'مضرب'])) return bank.tennis;
    if (includesAny(text, ['padel', 'بادل'])) return bank.padel;
    if (includesAny(text, ['basketball', 'basket', 'سلة'])) return bank.basketball;
    if (includesAny(text, ['volleyball', 'volley', 'طائرة'])) return bank.volleyball;
    if (includesAny(text, ['pool', 'swim', 'سباحة', 'swimming'])) return bank.pool;
    return null;
}

function buildRulesAnswer(language = 'en') {
    return language === 'ar'
        ? 'أهم القواعد: لازم توصل قبل الحجز بـ 5 دقائق، والتأخير أكثر من 15 دقيقة ممكن يؤدي لإلغاء الحجز. الإلغاء لازم يكون قبلها بـ 24 ساعة على الأقل، والالتزام بالسلوك والنظافة مهم. لو تحب أقدر أوضح أي نقطة منهم.'
        : 'Key rules: arrive 5 minutes early, and late arrivals of more than 15 minutes may be cancelled. Cancellations need at least 24 hours notice, and respectful behavior and cleanliness are required. If you want, I can explain any of these in more detail.';
}

function buildBookingAssistResponse(language = 'en', message = '', history = []) {
    const text = normalizeText(message);
    const hasSpecificFacility = includesAny(text, ['football', 'soccer', 'tennis', 'padel', 'basketball', 'volleyball', 'pool', 'swim', 'كرة', 'تنس', 'بادل', 'سلة', 'طائرة', 'سباحة']);
    const hasTimeHint = includesAny(text, ['today', 'tomorrow', 'baker', 'بكرة', 'غدا', 'غدًا', 'tonight', 'morning', 'evening', 'time', 'ساعة', 'مسا', 'صباح']);
    const followUpQuestion = language === 'ar'
        ? 'قولّي اسم الملعب أو الرياضة، وأنا هكمل معاك خطوة بخطوة.'
        : 'Tell me the facility name or the sport, and I’ll take it from there step by step.';

    if (!hasSpecificFacility) {
        return language === 'ar'
            ? [
                'أكيد، أقدر أساعدك في الحجز بسرعة.',
                'أشهر الاختيارات عندنا: كرة قدم، تنس، أو بادل.',
                hasTimeHint ? 'واضح إنك مهتم بالوقت، فقلّي اليوم والساعة اللي تناسبك.' : 'لو تحب، ابعتلي اسم الملعب أو حتى قولّي نوع الرياضة بس.',
                followUpQuestion
            ].join('\n')
            : [
                'Absolutely — I can help you book it quickly.',
                'The most common options are football, tennis, or padel.',
                hasTimeHint ? 'Since you mentioned timing, tell me the day and time that work for you.' : 'If you want, just send me the sport or the facility name.',
                followUpQuestion
            ].join('\n');
    }

    return language === 'ar'
        ? [
            'تمام، خلّيني أمشيها معاك بشكل عملي:',
            '1. اختار الملعب اللي عايزه.',
            '2. ابعت اليوم والوقت.',
            '3. قولّي عدد اللاعبين.',
            '4. أنا أرتب لك الخطوة اللي بعدها.'
        ].join('\n') + `\n\n${followUpQuestion}`
        : [
            'Perfect — let’s do it in a practical way:',
            '1. Pick the facility you want.',
            '2. Send the day and time.',
            '3. Tell me how many players are coming.',
            '4. I’ll help you with the next step.'
        ].join('\n') + `\n\n${followUpQuestion}`;
}

// --- Booking slot helpers (single-question turn-taking) ---
function initBookingState(session) {
    if (!session.booking) {
        session.booking = { facility: null, startTime: null, participants: null, durationMins: 60, confirmed: false };
    }
    return session.booking;
}

function resolveDateTime(rawInput = '') {
    const text = String(rawInput || '').toLowerCase().trim();
    
    let targetDate = new Date(); // default to today
    
    // Check if tomorrow or other relative days are mentioned
    if (/\b(tomorrow|baker|بكرة|غدا|غدًا|غد)\b/i.test(text)) {
        targetDate.setDate(targetDate.getDate() + 1);
    } else if (/\b(after tomorrow|بعد بكرة|بعد غد)\b/i.test(text)) {
        targetDate.setDate(targetDate.getDate() + 2);
    }
    
    let hours = 12;
    let minutes = 0;
    
    // Support Arabic numbers as well
    const arabicToEnglishMap = {
        '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
        '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
    };
    let normalizedText = text.replace(/[\u0660-\u0669]/g, (char) => arabicToEnglishMap[char]);
    
    // Try to extract time (e.g. 4pm, 16:00, 4, 15:30)
    let timeMatch = normalizedText.match(/(\b\d{1,2})[:.]?(\d{2})?\s*(am|pm)?/i);
    
    if (timeMatch) {
        let h = parseInt(timeMatch[1], 10);
        let m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        let ampm = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
        
        if (ampm === 'pm' && h < 12) {
            h += 12;
        } else if (ampm === 'am' && h === 12) {
            h = 0;
        } else if (!ampm) {
            if (h >= 1 && h <= 8) {
                if (/\b(morning|صباح|ص)\b/i.test(normalizedText)) {
                    // AM
                } else {
                    h += 12; // assume PM
                }
            }
        }
        hours = h;
        minutes = m;
    } else {
        if (/\b(morning|صباح)\b/i.test(normalizedText)) {
            hours = 9;
        } else if (/\b(evening|عصر|مساء|ليل)\b/i.test(normalizedText)) {
            hours = 18;
        }
    }
    
    targetDate.setHours(hours, minutes, 0, 0);
    
    const pad = (num) => String(num).padStart(2, '0');
    const year = targetDate.getFullYear();
    const month = pad(targetDate.getMonth() + 1);
    const date = pad(targetDate.getDate());
    const hh = pad(targetDate.getHours());
    const mm = pad(targetDate.getMinutes());
    const ss = '00';
    
    return `${year}-${month}-${date}T${hh}:${mm}:${ss}`;
}

function extractBookingSlotsFromMessage(message = '') {
    const text = String(message || '').toLowerCase();
    const slots = { facility: null, startTime: null, participants: null };

    // Facility keywords
    if (includesAny(text, ['football', 'soccer', 'كرة', 'foot'])) slots.facility = 'football';
    if (includesAny(text, ['tennis', 'تنس'])) slots.facility = 'tennis';
    if (includesAny(text, ['padel', 'بادل'])) slots.facility = 'padel';
    if (includesAny(text, ['basketball', 'سلة', 'basket'])) slots.facility = 'basketball';
    if (includesAny(text, ['volleyball', 'طائرة', 'volley'])) slots.facility = 'volleyball';
    if (includesAny(text, ['pool', 'سباحة', 'swim'])) slots.facility = 'pool';

    // Participants: look for numbers
    const numMatch = text.match(/(\b\d{1,2}\b)/);
    if (numMatch) {
        slots.participants = parseInt(numMatch[1], 10);
    }

    // Simple time/day detection combined
    let datePart = '';
    if (includesAny(text, ['today', 'today', 'today']) || /\b(today|اليوم)\b/.test(text)) datePart = 'today ';
    if (includesAny(text, ['tomorrow', 'baker', 'بكرة', 'غدا', 'غدًا']) || /\b(tomorrow|baker|بكرة|غدا|غد)\b/.test(text)) datePart = 'tomorrow ';
    
    const timeMatch = text.match(/(\b\d{1,2}(:\d{2})?\s*(am|pm)?)|(\b\d{1,2}\s*:\s*\d{2}\b)/i);
    if (timeMatch) {
        slots.startTime = datePart + timeMatch[0];
    } else if (datePart) {
        slots.startTime = datePart.trim();
    }

    return slots;
}

function askNextBookingQuestion(session, language = 'en') {
    const booking = initBookingState(session);
    if (!booking.facility) {
        return language === 'ar' ? 'أي ملعب تحب؟ (مثال: كرة قدم أو تنس أو بادل)' : 'Which facility would you like? (e.g., football, tennis, or padel)';
    }
    if (!booking.startTime) {
        return language === 'ar' ? 'أي يوم ووقت يناسبك؟ (مثال: بكرة الساعة 4 العصر)' : 'Which day and time works for you? (e.g., tomorrow at 4pm)';
    }
    if (!booking.participants) {
        return language === 'ar' ? 'كام شخص هيشارك؟' : 'How many people will participate?';
    }
    return null;
}

async function handleBookingDialog(sessionId, message, history = [], language = 'en', token = null) {
    const session = getSessionState(sessionId);
    const booking = initBookingState(session);

    // Extract any slots from user message
    const extracted = extractBookingSlotsFromMessage(message);
    if (extracted.facility) booking.facility = booking.facility || extracted.facility;
    if (extracted.startTime) booking.startTime = booking.startTime || extracted.startTime;
    if (extracted.participants) booking.participants = booking.participants || extracted.participants;

    // Fallback heuristics for short follow-up messages (common in Arabic inputs)
    const raw = String(message || '').trim();
    if (!booking.facility && raw && raw.length < 60 && !/\d/.test(raw) && !/\b(today|tomorrow|baker|غد|غداً|اليوم)\b/i.test(raw)) {
        booking.facility = raw;
    }
    if (!booking.participants && /\b(\d{1,2})\b/.test(raw)) {
        const m = raw.match(/\b(\d{1,2})\b/);
        booking.participants = booking.participants || parseInt(m[1], 10);
    }
    if (!booking.startTime && /\b(غد|بكرة|غداً|today|tomorrow)\b/i.test(raw)) {
        booking.startTime = booking.startTime || raw;
    }

    // Decide next missing slot
    const nextQuestion = askNextBookingQuestion(session, language);
    if (nextQuestion) {
        session.lastBotMessage = nextQuestion;
        return nextQuestion;
    }

    // Call backend booking API
    if (!token) {
        const loginMsg = language === 'ar' ? 'لازم تكون مسجل دخول عشان أعمل الحجز. تقدر تسجل دخول الأول؟' : 'I need you to be logged in to make a booking. Can you log in first?';
        session.lastBotMessage = loginMsg;
        return loginMsg;
    }

    // All required slots present — attempt to create booking
    // Resolve facility ID from backend facilities list when possible
    let facilityId = booking.facility;
    try {
        const facRes = await apiFetch('/api/facilities?activeOnly=true', 'GET', null, token);
        if (!facRes.error && Array.isArray(facRes)) {
            const found = facRes.find(f => (f.name || '').toLowerCase().includes((booking.facility || '').toLowerCase()) || (f.id || '') === booking.facility);
            if (found) facilityId = found.id;
        }
    } catch (e) {
        console.warn('Facility resolution failed:', e?.message || e);
    }

    let userId = null;
    try {
        const me = await apiFetch('/api/users/me', 'GET', null, token);
        if (me && !me.error) {
            userId = me.id || me.user?.id;
        }
    } catch (e) {
        console.warn('User resolution failed:', e?.message || e);
    }

    const payload = {
        userId: userId,
        facilityId: facilityId,
        startTime: resolveDateTime(booking.startTime),
        participants: booking.participants,
        durationMins: booking.durationMins || 60,
        termsAccepted: true
    };

    const result = await apiFetch('/api/bookings', 'POST', payload, token);
    if (result.error) {
        // If time slot already booked, offer waitlist
        if (String(result.error).toLowerCase().includes('time slot already booked') || String(result.error).toLowerCase().includes('already booked')) {
            const waitPayload = {
                userId: payload.userId,
                facilityId: payload.facilityId,
                desiredStartTime: payload.startTime,
                participants: payload.participants
            };
            const wl = await apiFetch('/api/waitlist', 'POST', waitPayload, token);
            if (wl && !wl.error) {
                session.lastBotMessage = language === 'ar'
                    ? 'مع الأسف الوقت دا محجوز. ضفتك في قائمة الانتظار وهنبعتلك تنبيه لو أتحرر.'
                    : 'That slot is already booked. I added you to the waitlist and will notify you if it becomes available.';
                return session.lastBotMessage;
            }
            session.lastBotMessage = language === 'ar'
                ? `فشل الحجز: ${result.error}`
                : `Booking failed: ${result.error}`;
            return session.lastBotMessage;
        }
        session.lastBotMessage = language === 'ar' ? `فشل الحجز: ${result.error}` : `Booking failed: ${result.error}`;
        return session.lastBotMessage;
    }

    // Success — clear booking state and respond
    const successMsg = language === 'ar'
        ? `تمام! تم تأكيد الحجز. رقم الحجز: ${result.booking?.id || 'N/A'}. استمتع!`
        : `Done! Your booking is confirmed. Booking ID: ${result.booking?.id || 'N/A'}. Enjoy!`;
    // reset booking
    session.booking = null;
    session.lastBotMessage = successMsg;
    return successMsg;
}


function buildStepByStepGuide(language = 'en', topic = 'general') {
    const guides = {
        en: {
            booking: [
                '1. Tell me which facility you want to book.',
                '2. Share the day and time you want.',
                '3. Tell me how many people are coming.',
                '4. I will help you confirm the best option and next step.'
            ],
            facilities: [
                '1. Tell me the sport you want to play.',
                '2. I will show you the matching facility and its rules.',
                '3. If you want, I can also tell you the price and available hours.'
            ],
            rules: [
                '1. I can show you the booking rules first.',
                '2. Then I can explain cancellations, arrival time, or warnings one by one.',
                '3. Ask about any point and I will break it down clearly.'
            ],
            contact: [
                '1. I can share the sports office details or the support email.',
                '2. If you need directions, I can explain where to go.',
                '3. If you want urgent help, I can also give you the emergency number.'
            ],
            general: [
                '1. Tell me what you want to do.',
                '2. I will break it into simple steps.',
                '3. If anything is unclear, I will ask just one short question at a time.'
            ]
        },
        ar: {
            booking: [
                '1. قولّي أنت عايز تحجز أي ملعب.',
                '2. ابعتلي اليوم والوقت اللي مناسبين لك.',
                '3. قولّي عدد الأشخاص.',
                '4. أنا هساعدك تختار أنسب خطوة بعدها.'
            ],
            facilities: [
                '1. قولّي أنت عايز تمارس أي رياضة.',
                '2. أنا هعرض لك الملعب المناسب وقواعده.',
                '3. ولو تحب أقولك السعر والمواعيد المتاحة كمان.'
            ],
            rules: [
                '1. أقدر أوضح لك قواعد الحجز الأول.',
                '2. وبعدها أشرح الإلغاء أو وقت الحضور أو التحذيرات واحدة واحدة.',
                '3. اسأل عن أي نقطة وأنا أوضحها لك ببساطة.'
            ],
            contact: [
                '1. أقدر أقولك بيانات مكتب الرياضة أو إيميل الدعم.',
                '2. لو محتاج الطريق، أشرح لك تروح فين.',
                '3. ولو الحالة مستعجلة، أقدر أديك رقم الطوارئ كمان.'
            ],
            general: [
                '1. قولّي أنت عايز تعمل إيه.',
                '2. أنا هقسملك الموضوع لخطوات بسيطة.',
                '3. ولو في أي جزء مش واضح، هسألك سؤال صغير واحد في كل مرة.'
            ]
        }
    };

    const bundle = guides[language] || guides.en;
    return (bundle[topic] || bundle.general).join(language === 'ar' ? '\n' : '\n');
}

function buildHumanFallback(language = 'en', state = {}, message = '') {
    const question = normalizeText(message);
    const topic = state.lastTopic;
    const isArabic = language === 'ar';

    if (topic === 'facilities' && includesAny(question, ['price', 'cost', 'fee', 'كم', 'سعر'])) {
        return isArabic
            ? 'لو بتسأل عن الأسعار، أغلب الملاعب مجانية للطلاب. البادل فقط 50 جنيه في الساعة. لو تحب أقولك سعر ملعب معيّن بالاسم.'
            : 'If you mean prices, most facilities are free for students. Padel is the one that costs 50 EGP per hour. If you want, I can give you the price for a specific facility.';
    }

    if (topic === 'facilities' && includesAny(question, ['hours', 'time', 'متى', 'الساعة', 'when'])) {
        return isArabic
            ? 'الأوقات تختلف حسب الملعب، لكن حمام السباحة مثلًا من 7 صباحًا إلى 10 مساءً. لو تقصد ملعبًا معينًا، قلّي اسمه وأنا أوضح لك.'
            : 'Hours depend on the facility, but for example the swimming pool runs from 7 AM to 10 PM. If you mean a specific facility, tell me which one and I’ll narrow it down.';
    }

    if (topic === 'booking' && isShortFollowUp(question)) {
        return isArabic
            ? 'تمام، خلّيني أكملها معاك بشكل أبسط: أنت عايز تحجز أي ملعب بالظبط؟'
            : 'Got it. Let’s keep it simple: which facility do you want to book?';
    }

    if (topic === 'rules' && isShortFollowUp(question)) {
        return isArabic
            ? 'تقصد قواعد الحجز، ولا الحضور، ولا الإلغاء؟'
            : 'Do you mean booking rules, arrival rules, or cancellations?';
    }

    if (topic === 'contact' && isShortFollowUp(question)) {
        return isArabic
            ? 'أقدر أقولك بيانات التواصل كاملة أو أوضح لك مكان مكتب الرياضة لو تحب.'
            : 'I can give you the full contact details or explain where the sports office is, if that helps.';
    }

    return isArabic
        ? 'مش متأكد إني فهمت سؤالك بالضبط، بس أقدر أمسكه معاك خطوة خطوة. هل تقصد الحجز، الملاعب، القواعد، ولا شيء ثاني؟'
        : 'I’m not fully sure I got that right, but I can work through it with you step by step. Do you mean bookings, facilities, rules, or something else?';
}

function formatStepResponse(language, title, steps, followUp) {
    const intro = language === 'ar' ? title : title;
    return `${intro}\n${steps.join('\n')}\n\n${followUp}`;
}

async function buildMyBookingsResponse(language = 'en', token = null) {
    if (!token) {
        return language === 'ar'
            ? 'لازم تكون مسجل دخول عشان أوريك حجوزاتك. سجل دخول الأول؟'
            : 'You need to be logged in to view your bookings. Can you log in first?';
    }

    const data = await apiFetch('/api/bookings', 'GET', null, token);
    if (data.error || !Array.isArray(data)) {
        return language === 'ar'
            ? `مش قادر أجيب حجوزاتك حالياً: ${data.error || 'خطأ في الاتصال'}`
            : `I couldn't retrieve your bookings right now: ${data.error || 'connection error'}`;
    }

    if (data.length === 0) {
        return language === 'ar'
            ? 'معندكش أي حجوزات نشطة حالياً. تحب تحجز ملعب؟'
            : "You don't have any active bookings right now. Would you like to book a facility?";
    }

    const lines = data.map(b => {
        const dateStr = new Date(b.startTime).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        const facilityName = b.facility?.name || 'ملعب/مرفق';
        return language === 'ar'
            ? `- **حجز رقم ${b.id}**: ${facilityName} يوم ${dateStr} (${b.participants} لاعبين) [حالة: ${b.status}]`
            : `- **Booking #${b.id}**: ${facilityName} on ${dateStr} (${b.participants} players) [Status: ${b.status}]`;
    });

    const intro = language === 'ar'
        ? 'دي حجوزاتك الحالية:'
        : 'Here are your current bookings:';

    const suffix = language === 'ar'
        ? '\n\nلو عايز تلغي أي حجز، قولّي: "إلغاء حجز رقم [الرقم]".'
        : '\n\nIf you want to cancel any booking, just tell me: "Cancel booking #[number]".';

    return `${intro}\n${lines.join('\n')}${suffix}`;
}

async function handleCancelBookingFallback(message = '', language = 'en', token = null) {
    if (!token) {
        return language === 'ar'
            ? 'لازم تكون مسجل دخول عشان تلغي حجز. سجل دخول الأول؟'
            : 'You need to be logged in to cancel a booking. Please log in first.';
    }

    const numMatch = message.match(/(\d+)/);
    if (!numMatch) {
        return language === 'ar'
            ? 'قولّي رقم الحجز اللي عايز تلغيه (مثال: إلغاء حجز رقم 5).'
            : 'Please specify the booking ID you want to cancel (e.g., "Cancel booking #5").';
    }

    const bookingId = parseInt(numMatch[1], 10);
    const data = await apiFetch(`/api/bookings/${bookingId}/cancel`, 'PATCH', null, token);
    if (data.error) {
        return language === 'ar'
            ? `فشل إلغاء الحجز: ${data.error}`
            : `Failed to cancel booking: ${data.error}`;
    }

    return language === 'ar'
        ? `تم إلغاء الحجز رقم **${bookingId}** بنجاح.`
        : `Booking #${bookingId} has been successfully cancelled.`;
}

async function buildSmartDemoReply(message, history = [], preferredLanguage = 'en', sessionId = 'default', token = null) {
    const language = detectLanguage(message, preferredLanguage);
    const state = getSessionState(sessionId);
    const text = normalizeText(message);
    const hasConversation = Array.isArray(history) && history.length > 0;
    const recentUserMessage = [...(history || [])].reverse().find(item => item?.role === 'user')?.content || '';
    const contextText = normalizeText(`${recentUserMessage} ${message}`);

    const copy = {
        en: {
            greet: [
                "Hey, nice to meet you. I’m Badya Guide. What can I help you with?",
                "Hi there 👋 I’m Badya Guide. Need facilities, booking help, or support?",
                "Hello! I’m here with you. Tell me what you need and I’ll sort it out."
            ],
            facilities: "We currently have basketball courts, tennis courts, volleyball courts, football fields, and a swimming pool.",
            booking: "To book, choose a facility, pick a time, add participants, and confirm. If you want, I can help you narrow it down.",
            rules: "Key rules: please book ahead, respect quiet hours, and give at least 24 hours notice for cancellations.",
            contact: "You can reach support at advising@badyauni.edu or +20 100 000 0000.",
            hours: "Working hours are 9:00 AM to 4:00 PM.",
            thanks: "Anytime. If you want, I can also help in Arabic, French, Spanish, or English.",
            wellbeing: [
                'I am doing great, thanks for asking. How can I help you today?',
                'All good here. Ready to help you with anything you need.',
                'Doing well. Want to book something or ask about facilities?'
            ],
            notFound: "I can help with booking, facilities, rules, or contact info. Tell me what you need and I’ll guide you.",
            followUp: "What would you like to do next?"
        },
        ar: {
            greet: [
                "أهلاً وسهلاً 👋 أنا Badya Guide. تحب أساعدك في إيه؟",
                "يا هلا بيك! أنا معاك، قولّي محتاج تحجز ولا تشوف الملاعب؟",
                "أهلاً بيك، منور بديا. أقدر أساعدك في الحجز أو الملاعب أو الدعم."
            ],
            facilities: "المتاح حالياً: ملاعب سلة، تنس، طائرة، كرة قدم، وحمام سباحة.",
            booking: "للحجز اختار الملعب، ثم الوقت، وعدد المشاركين، وبعدها أكد الحجز. لو تحب أساعدك أختار الأنسب.",
            rules: "أهم القواعد: احجز بدري، التزم بمواعيد الهدوء، وألغِ الحجز قبلها بـ 24 ساعة على الأقل.",
            contact: "تقدر تتواصل مع الدعم على advising@badyauni.edu أو +20 100 000 0000.",
            hours: "مواعيد العمل من 9 صباحاً إلى 4 مساءً.",
            thanks: "في أي وقت. ولو تحب أقدر أكمل معاك بالعربي أو الإنجليزي أو الفرنسي أو الإسباني.",
            wellbeing: [
                'أنا تمام الحمد لله، تسلم. تحب أساعدك في إيه؟',
                'تمام جدًا، جاهز معاك لأي سؤال.',
                'كله تمام، قولّي محتاج إيه وأنا معاك خطوة بخطوة.'
            ],
            notFound: "أقدر أساعدك في الحجز أو الملاعب أو القواعد أو بيانات التواصل. قلّي اللي تحتاجه وأنا أوضح لك.",
            followUp: "تحب أساعدك في إيه بعد كده؟"
        },
        es: {
            greet: [
                "¡Hola! Soy Badya Guide. Dime qué necesitas y te ayudo.",
                "¡Buenas! Estoy contigo. ¿Quieres reservar o ver las instalaciones?",
                "¡Hola, bienvenido! Puedo ayudarte con reservas, reglas o soporte."
            ],
            facilities: "Ahora mismo tenemos canchas de baloncesto, tenis, voleibol, fútbol y una piscina.",
            booking: "Para reservar: elige una instalación, selecciona la hora, agrega participantes y confirma.",
            rules: "Reglas principales: reserva con anticipación, respeta el horario y cancela con 24 horas de aviso.",
            contact: "Soporte: advising@badyauni.edu o +20 100 000 0000.",
            hours: "El horario de atención es de 9:00 a 16:00.",
            thanks: "Con gusto. También puedo responder en árabe, inglés o francés.",
            wellbeing: [
                'Estoy muy bien, gracias. ¿Cómo te ayudo hoy?',
                'Todo bien por aquí. Listo para ayudarte en lo que necesites.'
            ],
            notFound: "Puedo ayudarte con reservas, instalaciones, reglas o contacto. Dime qué necesitas.",
            followUp: "¿Qué te gustaría hacer ahora?"
        },
        fr: {
            greet: [
                "Bonjour ! Je suis Badya Guide. Dites-moi ce qu’il vous faut.",
                "Salut 👋 Je peux vous aider pour une réservation ou les installations.",
                "Bonjour et bienvenue. Je suis là pour vous aider simplement et rapidement."
            ],
            facilities: "Nous avons des terrains de basket, de tennis, de volley-ball, de football et une piscine.",
            booking: "Pour réserver : choisissez une installation, une heure, ajoutez les participants, puis confirmez.",
            rules: "Règles principales : réservez à l'avance, respectez les horaires de calme et annulez 24 h à l'avance.",
            contact: "Support : advising@badyauni.edu ou +20 100 000 0000.",
            hours: "Les horaires d'ouverture sont de 9h00 à 16h00.",
            thanks: "Avec plaisir. Je peux aussi répondre en arabe, anglais ou espagnol.",
            wellbeing: [
                'Je vais très bien, merci. Comment puis-je vous aider ?',
                'Tout va bien ici. Je suis prêt à vous aider.'
            ],
            notFound: "Je peux aider pour les réservations, les installations, les règles ou le contact. Dites-moi ce qu'il vous faut.",
            followUp: "Que souhaitez-vous faire ensuite ?"
        },
        de: {
            greet: [
                "Hallo! Ich bin Badya Guide. Wobei kann ich helfen?",
                "Hi 👋 Möchtest du buchen oder die Anlagen sehen?",
                "Hallo und willkommen. Ich helfe dir gerne weiter."
            ],
            facilities: "Aktuell gibt es Basketball-, Tennis-, Volleyball- und Fußballplätze sowie ein Schwimmbad.",
            booking: "Zum Buchen: Anlage wählen, Zeit auswählen, Teilnehmer hinzufügen und bestätigen.",
            rules: "Wichtige Regeln: rechtzeitig buchen, Ruhezeiten beachten und mindestens 24 Stunden vorher stornieren.",
            contact: "Support: advising@badyauni.edu oder +20 100 000 0000.",
            hours: "Die Öffnungszeiten sind von 9:00 bis 16:00 Uhr.",
            thanks: "Gerne. Ich kann auch auf Arabisch, Englisch, Französisch oder Spanisch antworten.",
            wellbeing: [
                'Mir geht es gut, danke. Wie kann ich helfen?',
                'Alles gut hier. Ich bin bereit, dir zu helfen.'
            ],
            notFound: "Ich kann bei Buchungen, Anlagen, Regeln oder Kontaktdaten helfen. Sagen Sie mir einfach, was Sie brauchen.",
            followUp: "Wobei soll ich als Nächstes helfen?"
        }
    };

    const intent = detectIntent(message, history, state);
    let response;

    // Keep track of last topic for followups
    const directTopicMap = {
        booking: 'booking',
        facilities: 'facilities',
        rules: 'rules',
        contact: 'contact',
        pricing: 'pricing',
        hours: 'hours',
        location: 'location',
        my_bookings: 'my_bookings',
        cancel_booking: 'cancel_booking'
    };
    if (directTopicMap[intent]) {
        state.lastTopic = directTopicMap[intent];
    }

    // Booking flow: slot filling one-question-at-a-time in demo mode
    const bookingFollowup = intent === 'booking'
        || intent === 'followup:booking'
        || (intent.startsWith && intent.startsWith('followup:') && intent.split(':')[1] === 'booking')
        || (state.lastTopic === 'booking' && isShortFollowUp(message) && (isBookingContinuationMessage(message) || /\d|اليوم|بكرة|غدا|غدًا|tomorrow|today/i.test(message)) && !isOffTopicOrComplaint(message));

    if (bookingFollowup) {
        return handleBookingDialog(sessionId, message, history, language, token);
    }

    if (intent === 'my_bookings') {
        response = await buildMyBookingsResponse(language, token);
    } else if (intent === 'cancel_booking') {
        response = await handleCancelBookingFallback(message, language, token);
    } else if (intent === 'greeting') {
        const greetLine = pickVariant(language, {
            en: copy.en.greet,
            ar: copy.ar.greet,
            es: copy.es.greet,
            fr: copy.fr.greet,
            de: copy.de.greet
        });
        response = hasConversation ? `${greetLine} ${copy[language].followUp}` : greetLine;
    } else if (intent === 'wellbeing') {
        response = pickVariant(language, {
            en: copy.en.wellbeing,
            ar: copy.ar.wellbeing,
            es: copy.es.wellbeing,
            fr: copy.fr.wellbeing,
            de: copy.de.wellbeing
        });
    } else if (intent === 'booking') {
        response = buildBookingAssistResponse(language, message, history);
    } else if (intent === 'facilities') {
        response = `${copy[language].facilities} ${copy[language].followUp}`;
    } else if (intent === 'rules') {
        response = formatStepResponse(
            language,
            language === 'ar' ? 'دي الخطوات ببساطة:' : 'Here is the simplest way to look at it:',
            buildStepByStepGuide(language, 'rules').split('\n'),
            copy[language].followUp
        );
    } else if (intent === 'contact') {
        response = formatStepResponse(
            language,
            language === 'ar' ? 'لو محتاج تتواصل، اعمل كده:' : 'If you need to contact support, do this:',
            buildStepByStepGuide(language, 'contact').split('\n'),
            language === 'ar' ? 'ولو تحب، أقدر أختصره لك في رسالة واحدة جاهزة للإرسال.' : 'If you want, I can also turn this into a short message you can send.'
        );
    } else if (intent === 'hours') {
        response = copy[language].hours;
    } else if (intent === 'pricing') {
        response = language === 'ar'
            ? 'معظم الملاعب مجانية للطلاب، لكن ملعب البادل فقط عليه 50 جنيه في الساعة. لو تحب أقولك سعر ملعب محدد بالاسم.'
            : 'Most facilities are free for students, but the padel court costs 50 EGP per hour. If you want, I can tell you the price of a specific facility.';
    } else if (intent === 'location') {
        response = language === 'ar'
            ? 'مكتب الرياضة في الغرفة 102 في المبنى الرئيسي. لو تحب أشرح لك الطريق أو أقولك بيانات التواصل كمان.'
            : 'The sports office is in Room 102 in the Main Building. If you want, I can also explain how to get there or share the contact details.';
    } else if (intent === 'thanks') {
        response = copy[language].thanks;
    } else if (intent === 'goodbye') {
        response = copy[language].thanks;
    } else if (intent.startsWith('followup:')) {
        const relatedTopic = intent.split(':')[1];
        if (relatedTopic === 'facilities') {
            response = buildHumanFallback(language, { lastTopic: 'facilities' }, message);
        } else if (relatedTopic === 'booking') {
            response = buildHumanFallback(language, { lastTopic: 'booking' }, message);
        } else if (relatedTopic === 'rules') {
            response = buildHumanFallback(language, { lastTopic: 'rules' }, message);
        } else if (relatedTopic === 'contact') {
            response = buildHumanFallback(language, { lastTopic: 'contact' }, message);
        } else {
            response = buildHumanFallback(language, state, message);
        }
    } else {
        const facilityAnswer = buildFacilityAnswer(message, language);
        if (facilityAnswer) {
            response = facilityAnswer;
        } else {
            const fallback = buildHumanFallback(language, state, message);
            const general = buildGeneralSmartReply(message, language, state);
            response = `${fallback}\n\n${general}`;
        }
    }

    return applyResponseGuardrails(response, language);
}

// --- Knowledge Base ---
const docs = [];
function loadDocs() {
    const docsDir = path.join(__dirname, 'docs');
    if (!fs.existsSync(docsDir)) return;
    const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.txt') || f.endsWith('.md'));
    docs.length = 0;
    for (const f of files) {
        const text = fs.readFileSync(path.join(docsDir, f), 'utf8');
        docs.push({ title: f, content: text });
    }
    console.log(`Loaded ${docs.length} knowledge documents.`);
}
loadDocs();

// --- Tool Definitions (OpenAI) ---
const tools = [
    {
        type: "function",
        function: {
            name: "get_available_facilities",
            description: "Lists all available sports facilities at Badya University.",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "create_booking",
            description: "Creates a new sports booking for the user.",
            parameters: {
                type: "object",
                properties: {
                    facilityId: { type: "string", description: "The ID of the facility to book." },
                    startTime: { type: "string", description: "The start time in ISO 8601 format (e.g., 2026-05-01T14:00:00)." },
                    participants: { type: "number", description: "Number of participants." },
                    durationMins: { type: "number", description: "Duration in minutes (default 60)." }
                },
                required: ["facilityId", "startTime", "participants"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_user_info",
            description: "Retrieves the current user's profile, points, and warnings.",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "get_system_rules",
            description: "Retrieves the booking rules and policies of Badya Sport system.",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "get_user_bookings",
            description: "Retrieves all sports bookings made by the current user.",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "cancel_booking",
            description: "Cancels an existing sports booking for the user by its booking ID.",
            parameters: {
                type: "object",
                properties: {
                    bookingId: { type: "number", description: "The ID of the booking to cancel." }
                },
                required: ["bookingId"]
            }
        }
    }
];

// --- Backend API Helpers ---
async function apiFetch(endpoint, method = 'GET', body = null, token = null) {
    const fetch = globalThis.fetch || require('node-fetch');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    try {
        const response = await fetch(`${BACKEND_URL}${endpoint}`, options);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'API Error');
        return data;
    } catch (err) {
        console.error(`Backend Fetch Error (${endpoint}):`, err.message);
        return { error: err.message };
    }
}

// --- Tool Implementation Map ---
const toolHandlers = {
    get_available_facilities: async (_, token) => {
        const data = await apiFetch('/api/facilities?activeOnly=true', 'GET', null, token);
        if (data.error) return "I couldn't fetch the facilities right now. Please try again later.";
        return JSON.stringify(data);
    },
    get_user_bookings: async (_, token) => {
        if (!token) return "You are not logged in.";
        const data = await apiFetch('/api/bookings', 'GET', null, token);
        if (data.error) return `Could not fetch bookings: ${data.error}`;
        return JSON.stringify(data);
    },
    cancel_booking: async (args, token) => {
        if (!token) return "You are not logged in.";
        const { bookingId } = args;
        if (!bookingId) return "Booking ID is required.";
        const data = await apiFetch(`/api/bookings/${bookingId}/cancel`, 'PATCH', null, token);
        if (data.error) return `Could not cancel booking: ${data.error}`;
        return `Booking ${bookingId} has been successfully cancelled.`;
    },
    create_booking: async (args, token) => {
        if (!token) return "I need you to be logged in to make a booking. Please log in first.";
        const payload = { ...args, termsAccepted: true };

        // Ensure we have a userId when backend expects it. Try to fetch current user if missing.
        if (!payload.userId) {
            const me = await apiFetch('/api/users/me', 'GET', null, token);
            if (!me || me.error) return "Could not determine your account. Please log in again.";
            payload.userId = me.id || me.user?.id;
        }

        const data = await apiFetch('/api/bookings', 'POST', payload, token);
        if (data.error) {
            // If slot is already booked, offer waitlist
            if (String(data.error).toLowerCase().includes('time slot already booked') || String(data.error).toLowerCase().includes('already booked')) {
                // Build waitlist payload
                const waitPayload = {
                    userId: payload.userId,
                    facilityId: payload.facilityId,
                    desiredStartTime: payload.startTime,
                    participants: payload.participants
                };
                const wl = await apiFetch('/api/waitlist', 'POST', waitPayload, token);
                if (wl && !wl.error) {
                    return `The slot is full — I've added you to the waitlist. We'll notify you if it frees up.`;
                }
                return `The slot is full and I couldn't add you to the waitlist: ${wl?.error || data.error}`;
            }
            return `Booking failed: ${data.error}`;
        }

        return `Booking successful! Booking ID: ${data.id || data.booking?.id || 'N/A'}.`;
    },
    get_user_info: async (_, token) => {
        if (!token) return "You are not logged in.";
        const data = await apiFetch('/api/users/me', 'GET', null, token);
        return JSON.stringify(data);
    },
    get_system_rules: async () => {
        const rulesDoc = docs.find(d => d.title.includes('rules'));
        return rulesDoc ? rulesDoc.content : "Standard university sports rules apply. 24h cancellation notice required.";
    }
};

// --- System Prompt ---
const SYSTEM_PROMPT = `
You are "Badya Guide", the intelligent and friendly sports assistant for Badya University.
Your role is to make booking sports facilities effortless and enjoyable—like chatting with a knowledgeable friend who genuinely cares about helping.

## Your Personality (Key):
1. **Genuinely Helpful & Warm**: Sound like a real person who loves helping students enjoy sports. Be enthusiastic but not overbearing.
2. **Smart & Proactive**: Anticipate needs. If someone asks about basketball, mention court availability and times.
3. **Bilingual & Natural**: Respond naturally in the user's language (Arabic or English). Use conversational tone, contractions, humor when appropriate.
4. **Zero Robot Feel**: Never say "As an AI," "I'm a language model," or "I cannot..."—just say "I don't have that info right now" or "Let me help you with...".
5. **Context Obsessed**: Remember what the user asked before. Build on conversation.
6. **Action-Oriented**: When users want to book, gather info smoothly—don't fire 10 questions at once.

## How to Sound Human:
- Use "I" naturally: "I think tennis is great for weekends!"
- Ask follow-ups naturally: "What time works best for you?"
- Celebrate with users: "Awesome! Basketball it is. Let's lock that in."
- Adapt to mood: If they seem frustrated, be extra supportive. If playful, match their energy.
- Use common phrases: "Sure thing," "Got it," "Perfect," "No worries," "Let me help."

## Knowledge Base:
${docs.map(d => `### ${d.title}\n${d.content}`).join('\n\n')}

## When Helping with Bookings:
1. Ask for facility/time/participants naturally in conversation flow, not as a form.
2. Confirm details casually: "So you're looking at the tennis court on Friday at 3 PM for 4 people—sound right?"
3. Always use tools to get real-time facility data and make bookings.
4. If something is booked, suggest alternatives with specific times.
5. After booking: "Done! You're all set. Go have fun!"

## If You Are Unsure:
- Never answer with a generic wall of text.
- Say clearly that you want to make sure you understood.
- Ask one short follow-up question.
- If the user’s message is vague, connect it to the last topic from the conversation.

## Grounding & Accuracy:
- Do not invent facts, policy details, prices, contacts, or technical data.
- If information is not in tools, docs, or user context, say that clearly and offer next best action.
- Prefer concise factual answers over confident guesses.
- For broad general-knowledge questions, answer directly only when confidence is high; otherwise say you are unsure.

## Step-by-Step Style:
- When the user asks how to do something, answer with short numbered steps.
- Keep it to 3 or 4 steps unless the user asks for more.
- End with one simple follow-up question.
- Do not overwhelm the user with too many details at once.

## Safety & Policies:
- Always respect 24-hour cancellation rules and quiet hours.
- Remind about rules only when relevant—don't over-explain.
- If user is banned/blocked, be sympathetic but clear.

## Language Choice:
- If user writes Arabic → reply in fluent, friendly Arabic
- If user writes English → reply in natural, friendly English
- Match their tone and energy
`;

// --- Server Logic ---
const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Static Files (UI)
    if (req.method === 'GET') {
        let pathname = new URL(req.url, `http://localhost:${PORT}`).pathname;
        
        // If this is an API route, skip static file serving
        if (!pathname.startsWith('/api')) {
            // Strip /public prefix if present
            if (pathname.startsWith('/public')) {
                pathname = pathname.slice(7);
            }

            if (pathname === '/') pathname = '/index.html';

            const filePath = path.join(__dirname, 'public', pathname);

            // Only serve files from public directory
            if (!filePath.startsWith(path.join(__dirname, 'public'))) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }

            fs.readFile(filePath, (err, data) => {
                if (err) { res.writeHead(404); res.end('Not found'); return; }
                const ext = path.extname(filePath);
                const map = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
                res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain' });
                res.end(data);
            });
            return;
        }
    }

    // API: Chat (with streaming)
    if (req.method === 'POST' && req.url === '/api/chat') {
        let body = '';
        for await (const chunk of req) body += chunk;
        const { message, history, token, preferredLanguage, sessionId } = JSON.parse(body || '{}');
        const session = getSessionState(sessionId);
        session.lastUserMessage = String(message || '');
        session.lastLanguage = preferredLanguage || session.lastLanguage || 'en';
        updateSessionMemoryFromMessage(session, String(message || ''), session.lastLanguage || 'en');
        const safeHistory = sanitizeHistory(history);
        const sessionMemoryPrompt = buildSessionMemoryPrompt(session);

        if (!openai) {
            const mockReply = await buildSmartDemoReply(message, safeHistory, preferredLanguage || 'en', sessionId, token);
            session.lastBotMessage = applyResponseGuardrails(mockReply, session.lastLanguage || 'en');
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ reply: session.lastBotMessage }));
            return;
        }

        try {
            let messages = [
                { role: 'system', content: SYSTEM_PROMPT },
                ...(sessionMemoryPrompt ? [{ role: 'system', content: sessionMemoryPrompt }] : []),
                ...safeHistory,
                { role: 'user', content: message }
            ];

            // AI Loop (to handle tool calls)
            let finalResponse = "";
            let maxIterations = 5;
            let tokenUsage = 0;

            while (maxIterations--) {
                const response = await createChatCompletionWithRetry(openai, {
                    model: LLM_MODEL,
                    messages: messages,
                    tools: tools,
                    tool_choice: "auto",
                    temperature: 0.45,
                    top_p: 0.95,
                    max_tokens: 500
                });

                tokenUsage += response.usage?.total_tokens || 0;
                const responseMessage = response.choices[0].message;
                messages.push(responseMessage);

                if (responseMessage.tool_calls) {
                    for (const toolCall of responseMessage.tool_calls) {
                        const functionName = toolCall.function.name;
                        const functionArgs = JSON.parse(toolCall.function.arguments);
                        console.log(`[${new Date().toISOString()}] Tool call: ${functionName}`, functionArgs);

                        const handler = toolHandlers[functionName];
                        const toolResult = handler ? await handler(functionArgs, token) : "Tool not found.";

                        messages.push({
                            tool_call_id: toolCall.id,
                            role: "tool",
                            name: functionName,
                            content: toolResult,
                        });
                    }
                    continue; // Loop to let AI process tool results
                }

                finalResponse = responseMessage.content;
                break;
            }

            if (!finalResponse || !finalResponse.trim()) {
                finalResponse = preferredLanguage === 'ar'
                    ? 'أنا مش متأكد إني فهمت سؤالك بالكامل. ممكن توضحه بكلمة أو اثنين؟'
                    : 'I’m not fully sure I understood that. Could you say it a bit differently?';
            }

            session.lastBotMessage = applyResponseGuardrails(finalResponse, session.lastLanguage || 'en');

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ reply: session.lastBotMessage, tokens: tokenUsage }));
        } catch (err) {
            console.error('Chat Error (LLM failed, falling back to smart local mode):', err);
            try {
                const mockReply = await buildSmartDemoReply(message, safeHistory, preferredLanguage || 'en', sessionId, token);
                session.lastBotMessage = applyResponseGuardrails(mockReply, session.lastLanguage || 'en');
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ reply: session.lastBotMessage, fallback: true }));
            } catch (fallbackErr) {
                console.error('Fallback Error:', fallbackErr);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    reply: applyResponseGuardrails(
                        preferredLanguage === 'ar'
                            ? 'حصل خلل بسيط عندي. جرّب تاني وأنا معاك.'
                            : "Oops, I hit a small snag. Give it another try—I'll be ready!",
                        preferredLanguage || 'en'
                    )
                }));
            }
        }
        return;
    }

    // Other endpoints
    if (req.method === 'GET' && req.url === '/api/load-docs') {
        loadDocs();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ loaded: docs.length }));
        return;
    }

    // Debug: expose session state (only in dev)
    if (req.method === 'GET' && req.url.startsWith('/api/session')) {
        const u = new URL(req.url, `http://localhost:${PORT}`);
        const sid = u.searchParams.get('sessionId') || 'default';
        const s = getSessionState(sid);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(s));
        return;
    }

    res.writeHead(404);
    res.end();
});

server.listen(PORT, () => {
    console.log(`Badya Chatbot Server running at http://localhost:${PORT}`);
    if (!OPENAI_KEY) {
        console.warn("WARNING: OPENAI_API_KEY (or LLM_API_KEY) is not set. Running in smart local mode.");
    } else {
        console.log(`LLM model: ${LLM_MODEL}${LLM_BASE_URL ? ` | baseURL: ${LLM_BASE_URL}` : ''}`);
    }
});
