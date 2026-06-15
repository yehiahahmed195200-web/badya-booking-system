const messagesEl = document.getElementById('messages');
const form = document.getElementById('form');
const input = document.getElementById('input');
const fileInput = document.getElementById('file');
const uploadBtn = document.getElementById('uploadBtn');
const loadBtn = document.getElementById('loadBtn');
const resetBtn = document.getElementById('resetBtn');
const chooseFileBtn = document.getElementById('chooseFileBtn');
const fileName = document.getElementById('fileName');
const chatToggle = document.getElementById('chatToggle');
const chatClose = document.getElementById('chatClose');
const chatWrap = document.querySelector('.chat-wrap');
const sessionId = (localStorage.getItem('chat_session_id') || crypto.randomUUID());
localStorage.setItem('chat_session_id', sessionId);
const quickActions = document.querySelectorAll('[data-prompt]');
const conversationHistory = [];

const welcomeText = [
  'أهلاً بك في Badya Concierge.',
  'أستطيع مساعدتك في الحجز، استعراض المرافق، الإشعارات، أو توضيح الخطوات التالية بشكل مختصر وواضح.',
  'جرب أحد الاختصارات بالأسفل أو اكتب سؤالك مباشرة.'
].join('\n');

function syncScroll() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderBubble(role, text, metaText) {
  const div = document.createElement('div');
  div.className = 'msg ' + role;

  const avatar = document.createElement('div');
  avatar.className = 'msg__avatar';
  avatar.textContent = role.includes('user') ? 'YOU' : 'B';

  const bubble = document.createElement('div');
  bubble.className = 'msg__bubble';
  bubble.textContent = text;

  if (metaText) {
    bubble.title = metaText;
  }

  div.appendChild(avatar);
  div.appendChild(bubble);
  messagesEl.appendChild(div);
  syncScroll();
  return div;
}

function addMessage(role, text) {
  return renderBubble(role, text);
}

function pushHistory(role, content) {
  if (!content) return;
  conversationHistory.push({ role, content });
  while (conversationHistory.length > 12) {
    conversationHistory.shift();
  }
}

function clearMessages() {
  messagesEl.innerHTML = '';
  conversationHistory.length = 0;
}

function addWelcomeMessage() {
  if (messagesEl.children.length === 0) {
    addMessage('bot', welcomeText);
  }
}

addWelcomeMessage();

const urlParams = new URLSearchParams(window.location.search);
const isEmbedded = urlParams.get('embedded') === '1';

if (isEmbedded) {
  document.body.classList.add('is-embedded');
  if (chatToggle) {
    chatToggle.style.display = 'none';
  }
}

function setChatState(open) {
  if (!chatWrap) return;
  chatWrap.dataset.state = open ? 'open' : 'closed';
  chatWrap.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (open) {
    setTimeout(() => input.focus(), 150);
  } else {
    if (isEmbedded) {
      window.parent.postMessage({ type: 'badya-chat-close' }, '*');
    }
  }
}

if (isEmbedded) {
  setChatState(true);
}

chatToggle.addEventListener('click', () => setChatState(true));
chatClose.addEventListener('click', () => setChatState(false));

quickActions.forEach((button) => {
  button.addEventListener('click', () => {
    const prompt = button.dataset.prompt || '';
    input.value = prompt;
    input.focus();
  });
});

chooseFileBtn.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  const selectedFile = fileInput.files && fileInput.files[0];
  fileName.textContent = selectedFile ? selectedFile.name : 'لم يتم اختيار ملف';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const txt = input.value.trim();
  if (!txt) return;
  addMessage('user', txt);
  pushHistory('user', txt);
  input.value = '';
  const typing = renderBubble('bot typing', 'جاري التحليل...');
  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: txt, history: conversationHistory.slice(-8), sessionId })
    });
    const j = await r.json();
    const reply = j.reply || 'لم أتمكن من توليد رد حالياً.';
    typing.remove();
    addMessage('bot', reply);
    pushHistory('assistant', reply);
  } catch (e) {
    typing.remove();
    const errorText = 'تعذر الوصول إلى الخدمة حالياً. حاول مرة أخرى بعد لحظات.';
    addMessage('bot', errorText);
    pushHistory('assistant', errorText);
  }
});

uploadBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  const f = fileInput.files && fileInput.files[0];
  if (!f) { alert('اختر ملفاً أولاً'); return; }
  const txt = await f.text();
  try {
    const r = await fetch('/api/docs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: f.name, text: txt }) });
    const j = await r.json();
    alert('تم رفع المستند بنجاح. رقم التعريف: ' + j.id);
  } catch (err) { alert('فشل الرفع: ' + err.message); }
});

loadBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    const r = await fetch('/api/load-docs');
    const j = await r.json();
    alert('تم تحميل ' + j.loaded + ' ملفاً من المجلد.');
  } catch (err) { alert('فشل التحميل: ' + err.message); }
});

resetBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    await fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) });
    clearMessages();
    addMessage('bot', 'تمت إعادة ضبط المحادثة. كيف يمكنني مساعدتك اليوم؟');
  } catch (err) { alert('فشل إعادة الضبط: ' + err.message); }
});
