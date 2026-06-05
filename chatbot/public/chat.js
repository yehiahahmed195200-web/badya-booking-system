const messagesEl = document.getElementById('messages');
const form = document.getElementById('form');
const input = document.getElementById('input');
const chatToggle = document.getElementById('chatToggle');
const chatClose = document.getElementById('chatClose');
const chatContainer = document.querySelector('.chat-container');
const sendBtn = document.getElementById('sendBtn');

// Get token from URL params
const urlParams = new URLSearchParams(window.location.search);
const authToken = urlParams.get('token') || localStorage.getItem('token');

const sessionId = (localStorage.getItem('chat_session_id') || crypto.randomUUID());
localStorage.setItem('chat_session_id', sessionId);

const isEmbedded = new URLSearchParams(window.location.search).get('embedded') === '1';

const conversationHistory = [];
let isAwaitingResponse = false;

function detectLanguage(locale = '') {
    const value = String(locale || '').toLowerCase();
    if (value.startsWith('ar')) return 'ar';
    if (value.startsWith('es')) return 'es';
    if (value.startsWith('fr')) return 'fr';
    if (value.startsWith('de')) return 'de';
    return 'en';
}

// Detect language
const userLanguage = detectLanguage(navigator.language);

const WELCOME_EN = "Hey! 👋 I'm here to help you book sports facilities at Badya. What would you like to do?";
const WELCOME_AR = "أهلاً! 👋 أنا هنا لمساعدتك في حجز الملاعب الرياضية. شنو اللي تبغاه؟";

function syncScroll() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function highlightKeywords(text) {
    if (!text) return '';
    let html = text;

    // Categories (Sports, facilities)
    const categories = [
        /\b(tennis|padel|football|basketball|volleyball|gym|squash|swimming|pool|fitness|yoga|cardio)\b/gi,
        /(ملعب|كرة القدم|تنس|بادل|سلة|طائرة|سباحة|مسبح|جيم|لياقة)/g
    ];
    // Success / Confirmation
    const success = [
        /\b(confirmed|successful|success|done|enjoy)\b/gi,
        /(تم تأكيد|بنجاح|تم إنشاء|تمت|استمتع|ممتاز|أكيد)/g
    ];
    // Warnings / Cancellations / Errors
    const warnings = [
        /\b(failed|fail|cancel|cancelled|late|warning|error)\b/gi,
        /(تعذر|فشل|إلغاء|تأخير|تحذير|خلل|خطأ)/g
    ];
    // Times & Dates
    const times = [
        /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|am|pm|mins?|hours?)\b/gi,
        /(اليوم|بكرة|غداً|غدا|ساعة|ساعات|دقيقة|دقائق|صباحاً|مساءً|صباحا|مساءا|عصراً|عصرا)/g
    ];

    for (const pattern of success) {
        html = html.replace(pattern, '<span class="hl-ok">$&</span>');
    }
    for (const pattern of warnings) {
        html = html.replace(pattern, '<span class="hl-err">$&</span>');
    }
    for (const pattern of times) {
        html = html.replace(pattern, '<span class="hl-date">$&</span>');
    }
    for (const pattern of categories) {
        html = html.replace(pattern, '<span class="hl-type">$&</span>');
    }

    return html;
}

function formatMarkdown(text) {
    if (!text) return '';
    
    // First, escape HTML to prevent XSS
    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Apply keyword highlighting
    html = highlightKeywords(html);

    // Code blocks: `code` -> <code class="inline-code">code</code>
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Bold text: **text** -> <strong class="bold-text">$1</strong>
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="bold-text">$1</strong>');

    // Parse lines for headers and lists
    const lines = html.split('\n');
    let inList = false;
    let inOrderedList = false;
    let resultLines = [];

    for (let line of lines) {
        let trimmed = line.trim();
        
        // Headers (h4, h3)
        if (trimmed.startsWith('###')) {
            if (inList) { resultLines.push('</ul>'); inList = false; }
            if (inOrderedList) { resultLines.push('</ol>'); inOrderedList = false; }
            resultLines.push(`<h4 class="chat-header-h4">${trimmed.slice(3).trim()}</h4>`);
            continue;
        }
        if (trimmed.startsWith('##')) {
            if (inList) { resultLines.push('</ul>'); inList = false; }
            if (inOrderedList) { resultLines.push('</ol>'); inOrderedList = false; }
            resultLines.push(`<h3 class="chat-header-h3">${trimmed.slice(2).trim()}</h3>`);
            continue;
        }

        // Bullet lists
        const bulletMatch = line.match(/^(\s*)[*-]\s+(.+)$/);
        if (bulletMatch) {
            if (inOrderedList) { resultLines.push('</ol>'); inOrderedList = false; }
            if (!inList) {
                resultLines.push('<ul class="chat-list">');
                inList = true;
            }
            resultLines.push(`<li class="chat-list-item">${bulletMatch[2]}</li>`);
            continue;
        }

        // Ordered lists
        const numberedMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
        if (numberedMatch) {
            if (inList) { resultLines.push('</ul>'); inList = false; }
            if (!inOrderedList) {
                resultLines.push('<ol class="chat-ordered-list">');
                inOrderedList = true;
            }
            resultLines.push(`<li class="chat-list-item">${numberedMatch[2]}</li>`);
            continue;
        }

        // Empty lines or standard paragraphs
        if (trimmed === '') {
            if (inList) { resultLines.push('</ul>'); inList = false; }
            if (inOrderedList) { resultLines.push('</ol>'); inOrderedList = false; }
            resultLines.push('<div class="chat-break"></div>');
        } else {
            resultLines.push(`<p class="chat-p">${line}</p>`);
        }
    }

    if (inList) resultLines.push('</ul>');
    if (inOrderedList) resultLines.push('</ol>');

    return resultLines.join('\n');
}

function renderBubble(role, content, isTemp = false) {
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    const avatar = document.createElement('div');
    avatar.className = 'msg__avatar';
    avatar.textContent = role === 'user' ? 'You' : '🎯';
    const bubble = document.createElement('div');
    bubble.className = 'msg__bubble';
    if (typeof content === 'string') {
        bubble.innerHTML = formatMarkdown(content);
    } else {
        bubble.appendChild(content);
    }
    div.appendChild(avatar);
    div.appendChild(bubble);
    messagesEl.appendChild(div);
    syncScroll();
    return div;
}

function addTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-dots';
    indicator.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    return renderBubble('bot', indicator);
}

function closeWidget() {
    if (isEmbedded && window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'badya-chat-close' }, '*');
        return;
    }

    chatContainer.dataset.state = 'closed';
    chatToggle.style.display = 'flex';
}

async function sendMessage(text) {
    if (!text.trim() || isAwaitingResponse) return;
    renderBubble('user', text);
    conversationHistory.push({ role: 'user', content: text });
    input.value = '';
    isAwaitingResponse = true;
    sendBtn.disabled = true;
    const typing = addTypingIndicator();
    try {
        const response = await fetch('http://localhost:3333/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                history: conversationHistory.slice(-10),
                token: authToken,
                sessionId,
                preferredLanguage: userLanguage
            })
        });
        const data = await response.json();
        typing.remove();
        if (data.reply) {
            renderBubble('bot', data.reply);
            conversationHistory.push({ role: 'assistant', content: data.reply });
        } else {
            renderBubble('bot', userLanguage === 'ar' ? "معذرة، حصل شي خطأ!" : "Oops, something went wrong!");
        }
    } catch (err) {
        typing.remove();
        renderBubble('bot', userLanguage === 'ar' ? "الاتصال انقطع." : "Connection lost.");
        console.error(err);
    } finally {
        isAwaitingResponse = false;
        sendBtn.disabled = false;
        input.focus();
    }
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage(input.value);
});

document.querySelectorAll('.action-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        sendMessage(chip.textContent);
    });
});

chatToggle.addEventListener('click', () => {
    chatContainer.dataset.state = 'open';
    chatToggle.style.display = 'none';
    if (messagesEl.children.length === 0) {
        renderBubble('bot', userLanguage === 'ar' ? WELCOME_AR : WELCOME_EN);
    }
    input.focus();
});

chatClose.addEventListener('click', () => {
    closeWidget();
});

if (isEmbedded) {
    chatContainer.dataset.state = 'open';
    chatToggle.style.display = 'none';
    if (messagesEl.children.length === 0) {
        renderBubble('bot', userLanguage === 'ar' ? WELCOME_AR : WELCOME_EN);
    }
}
