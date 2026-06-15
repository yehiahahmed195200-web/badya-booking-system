require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.CHATBOT_PORT || 3333;
const OPENAI_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || null;
const OPENAI_MODEL = process.env.LLM_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';

function isArabicText(text) {
  return /[\u0600-\u06FF]/.test(text || '');
}

function buildAssistantPrompt() {
  return `You are Badya Concierge, the official digital assistant for a premium sports booking platform.
Sound like a polished, attentive support specialist rather than a scripted chatbot.
Match the user's language: use Arabic when the user writes Arabic and English when the user writes English.
Be warm, concise, and confident.
Avoid robotic openings such as "Certainly" or "Of course" unless the user explicitly prefers that style.
Do not mention internal policy, model names, or that you are an AI unless the user asks directly.
When important details are missing, ask exactly one focused follow-up question and offer the next step.
Prefer short paragraphs and clear next actions over long explanations.
When the context is available, use it directly and do not repeat the same sentence structure across turns.`;
}

function buildFallbackReply(message, context) {
  if (isArabicText(message)) {
    return context
      ? `أكيد. هذا أقرب سياق مرتبط بطلبك:\n\n${context}`
      : 'أكيد. لا يوجد تطابق مباشر في المستندات الحالية، لكن أقدر أكمل معك فورًا لو وصفت لي المطلوب بشكل أبسط أو أرسلت رقم الحجز أو اسم المرفق.';
  }

  return context
    ? `Here is the closest context I found:\n\n${context}`
    : 'I could not find an exact match in the current knowledge base, but I can still help if you share the booking ID, facility name, or the exact task you want to complete.';
}

// In-memory simple document store (id -> {text, metadata})
const docs = [];
// In-memory conversation store (sessionId -> [{role, content}, ...])
const sessions = new Map();

async function loadDocsFromFolder() {
  const docsDir = path.join(__dirname, 'docs');
  try {
    if (!fs.existsSync(docsDir)) return 0;
    const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.txt') || f.endsWith('.md'));
    let added = 0;
    for (const f of files) {
      const txt = fs.readFileSync(path.join(docsDir, f), 'utf8');
      const id = docs.length + 1;
      docs.push({ id, title: f, text: txt });
      added++;
    }
    return added;
  } catch (e) {
    console.error('loadDocsFromFolder error', e);
    return 0;
  }
}

async function indexDocsEmbeddings() {
  if (!OPENAI_KEY) return 0;
  let count = 0;
  for (const d of docs) {
    if (embeddings.find(e=>e.id===d.id)) continue;
    const v = await getEmbedding(d.text.slice(0,2000));
    if (v) { embeddings.push({ id: d.id, vector: v }); count++; }
  }
  return count;
}

function serveStatic(req, res) {
  let pathname = new URL(req.url, `http://localhost:${PORT}`).pathname;
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(__dirname, 'public', pathname);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    const map = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css' };
    res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain' });
    res.end(data);
  });
}

async function callOpenAI(messages) {
  const fetch = global.fetch || require('node-fetch');
  const body = {
    model: OPENAI_MODEL,
    messages,
    max_tokens: 800,
    temperature: 0.7,
    top_p: 0.95,
  };

  let baseUrl = LLM_BASE_URL.trim();
  if (!baseUrl.endsWith('/')) {
    baseUrl += '/';
  }
  const endpoint = baseUrl + 'chat/completions';

  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    let errText = '';
    try {
      const errJson = await r.json();
      const errObj = Array.isArray(errJson) ? errJson[0] : errJson;
      errText = errObj?.error?.message || errObj?.message || JSON.stringify(errJson);
    } catch (e) {
      errText = await r.text();
    }
    throw new Error(`HTTP ${r.status}: ${errText}`);
  }

  const j = await r.json();
  const resObj = Array.isArray(j) ? j[0] : j;
  if (resObj?.error) {
    throw new Error(resObj.error.message || JSON.stringify(resObj.error));
  }

  const content = resObj?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error(`Invalid response format: ${JSON.stringify(j)}`);
  }
  return content;
}

async function callOllama(messages) {
  const fetch = global.fetch || require('node-fetch');
  const url = new URL('/api/chat', OLLAMA_URL).toString();
  const body = {
    model: OLLAMA_MODEL,
    messages,
    stream: false
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    throw new Error(`Ollama HTTP ${r.status}`);
  }
  const j = await r.json();
  if (j.error) {
    throw new Error(j.error);
  }
  if (typeof j?.message?.content !== 'string') {
    throw new Error(`Invalid Ollama response: ${JSON.stringify(j)}`);
  }
  return j.message.content;
}

async function backendRequest(endpoint, options = {}) {
  const fetch = global.fetch || require('node-fetch');
  const url = new URL(endpoint, BACKEND_URL).toString();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    throw new Error(`Backend ${res.status}: ${msg}`);
  }
  return data;
}

function formatFacilities(facilities) {
  if (!Array.isArray(facilities) || facilities.length === 0) {
    return 'لا توجد مرافق متاحة حالياً.';
  }
  return facilities.map((f) => {
    return `#${f.id} ${f.name} (${f.category}) - ${f.openTime} إلى ${f.closeTime} | المشاركون ${f.minParticipants}-${f.maxParticipants}`;
  }).join('\n');
}

function extractJsonPayload(message, prefixes) {
  const lower = message.toLowerCase();
  const prefix = prefixes.find(p => lower.startsWith(p));
  if (!prefix) return null;
  const raw = message.slice(prefix.length).trim();
  if (!raw) return { error: 'missing_payload' };
  try {
    const data = JSON.parse(raw);
    return { data };
  } catch (e) {
    return { error: 'invalid_json' };
  }
}

function extractUserId(message, prefixes) {
  const lower = message.toLowerCase();
  const matched = prefixes.some(p => lower.startsWith(p));
  if (!matched) return null;
  const m = message.match(/(\d+)/);
  if (!m) return { error: 'missing_user_id' };
  return { userId: Number(m[1]) };
}

async function handleBackendCommands(message) {
  const text = (message || '').trim();
  const lower = text.toLowerCase();

  if (lower === '/help' || lower === 'help' || lower === 'مساعدة') {
    return `أوامر سريعة:\n` +
      `/facilities لعرض المرافق المتاحة\n` +
      `/book {"userId":3,"facilityId":1,"startTime":"2026-04-30T18:00","participants":2,"durationMins":60} لإنشاء حجز\n` +
      `/notifications 3 لعرض إشعارات المستخدم`;
  }

  if (lower.startsWith('/facilities') || lower === 'المرافق' || lower === 'الملاعب') {
    const facilities = await backendRequest('/api/facilities?activeOnly=true', { method: 'GET' });
    return `المرافق المتاحة:\n${formatFacilities(facilities)}`;
  }

  if (lower.startsWith('/book') || lower.startsWith('احجز')) {
    const payload = extractJsonPayload(text, ['/book', 'احجز']);
    if (!payload) return null;
    if (payload.error === 'missing_payload') {
      return 'من فضلك أرسل بيانات الحجز بصيغة JSON بعد الأمر. مثال: /book {"userId":3,"facilityId":1,"startTime":"2026-04-30T18:00","participants":2,"durationMins":60}';
    }
    if (payload.error === 'invalid_json') {
      return 'صيغة JSON غير صحيحة. تأكد من علامات الاقتباس والفواصل.';
    }
    try {
      const booking = await backendRequest('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(payload.data)
      });
      return `تم إنشاء الحجز بنجاح. رقم الحجز: ${booking.id}`;
    } catch (e) {
      return `تعذر إنشاء الحجز: ${e.message}`;
    }
  }

  if (lower.startsWith('/notifications') || lower.startsWith('اشعارات')) {
    const payload = extractUserId(text, ['/notifications', 'اشعارات']);
    if (!payload) return null;
    if (payload.error === 'missing_user_id') {
      return 'من فضلك اكتب رقم المستخدم بعد الأمر. مثال: /notifications 3';
    }
    try {
      const notifications = await backendRequest(`/api/notifications/user/${payload.userId}`, { method: 'GET' });
      if (!Array.isArray(notifications) || notifications.length === 0) {
        return 'لا توجد إشعارات حالياً.';
      }
      const list = notifications.map(n => `- ${n.title}: ${n.message}`).join('\n');
      return `إشعارات المستخدم ${payload.userId}:\n${list}`;
    } catch (e) {
      return `تعذر جلب الإشعارات: ${e.message}`;
    }
  }

  return null;
}

function simpleRAG(query, queryVector) {
  // If we have embeddings, do vector similarity; otherwise fallback to keyword match
  if (embeddings.length > 0 && queryVector) {
    return vectorRAG(queryVector);
  }
  const q = (query || '').toLowerCase();
  const hits = docs.filter(d => d.text.toLowerCase().includes(q)).slice(0,3);
  return hits.map(h => h.text).join('\n---\n');
}

// --- In-memory embeddings store (parallel to docs)
const embeddings = []; // each item: { id, vector }
const queryEmbeddingCache = new Map();

async function getEmbedding(text) {
  if (!OPENAI_KEY || !OPENAI_KEY.startsWith('sk-')) return null;
  try {
    const fetch = global.fetch || require('node-fetch');
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ input: text, model: 'text-embedding-3-small' }),
    });
    const j = await res.json();
    return j?.data?.[0]?.embedding || null;
  } catch (e) {
    console.error('embedding error', e);
    return null;
  }
}

function dot(a,b){return a.reduce((s,v,i)=>s+v*(b[i]||0),0);}
function norm(a){return Math.sqrt(dot(a,a))||1;}
function cosine(a,b){return dot(a,b)/(norm(a)*norm(b)||1);}

function vectorRAG(queryVector, topk=3) {
  if (!embeddings.length) return '';
  const sims = embeddings.map(e => ({ id: e.id, score: cosine(queryVector, e.vector) }));
  sims.sort((a,b)=>b.score-a.score);
  const hits = sims.slice(0, topk).map(s => docs.find(d => d.id===s.id)).filter(Boolean);
  return hits.map(h=>h.text).join('\n---\n');
}

function getSessionHistory(sessionId) {
  if (!sessionId) return [];
  const h = sessions.get(sessionId);
  return Array.isArray(h) ? h : [];
}

function pushSessionHistory(sessionId, role, content) {
  if (!sessionId || !content) return;
  const maxTurns = 12;
  const h = getSessionHistory(sessionId);
  h.push({ role, content });
  while (h.length > maxTurns * 2) h.shift();
  sessions.set(sessionId, h);
}

const server = http.createServer(async (req, res) => {
  try {
    // simple per-IP rate limiting (requests per minute)
    if (!rateLimitAllow(req)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
      return;
    }
    if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/index') || req.url.startsWith('/public'))) {
      return serveStatic(req, res);
    }

    if (req.method === 'POST' && req.url === '/api/chat') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const { message, history, sessionId } = JSON.parse(body || '{}');

      // moderation
      const mod = await moderateContent(message);
      if (!mod.ok) { res.writeHead(400, {'Content-Type':'application/json'}); res.end(JSON.stringify({ error: 'moderation_failed', reason: mod.reason || null })); return; }

      const persona = buildAssistantPrompt();

      const commandReply = await handleBackendCommands(message);
      if (commandReply) {
        pushSessionHistory(sessionId, 'user', message);
        pushSessionHistory(sessionId, 'assistant', commandReply);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply: commandReply }));
        return;
      }

      let queryVector = null;
      if (OPENAI_KEY) {
        const cached = queryEmbeddingCache.get(message);
        if (cached) queryVector = cached;
        else {
          try {
            queryVector = await getEmbedding((message||'').slice(0,2000));
            if (queryVector) queryEmbeddingCache.set(message, queryVector);
          } catch (e) {}
        }
      }

      const context = simpleRAG(message, queryVector);
      const sessionHistory = getSessionHistory(sessionId);

      const messages = [
        { role: 'system', content: persona },
        { role: 'system', content: `Context from docs:\n${context}` },
        ...(history || []),
        ...sessionHistory,
        { role: 'user', content: message }
      ];

      if (OPENAI_KEY) {
        try {
          const resp = await callOpenAI(messages);
          pushSessionHistory(sessionId, 'user', message);
          pushSessionHistory(sessionId, 'assistant', resp);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ reply: resp }));
          return;
        } catch (e) {
          console.error('OpenAI error', e);
        }
      }

      try {
        const resp = await callOllama(messages);
        pushSessionHistory(sessionId, 'user', message);
        pushSessionHistory(sessionId, 'assistant', resp);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply: resp }));
        return;
      } catch (e) {
        console.error('Ollama error', e);
      }

      // fallback local behavior: echo + context
      const reply = buildFallbackReply(message, context);
      pushSessionHistory(sessionId, 'user', message);
      pushSessionHistory(sessionId, 'assistant', reply);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reply }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/docs') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const { text, title } = JSON.parse(body || '{}');
      const id = docs.length + 1;
      docs.push({ id, title: title || `doc-${id}`, text: text || '' });
      // index embedding for new doc if key present
      if (OPENAI_KEY) {
        const v = await getEmbedding((text||'').slice(0,2000));
        if (v) embeddings.push({ id, vector: v });
      }
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, id }));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/docs') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(docs));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/load-docs') {
      const count = await loadDocsFromFolder();
      await indexDocsEmbeddings();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ loaded: count }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/reset') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const { sessionId } = JSON.parse(body || '{}');
      if (sessionId) sessions.delete(sessionId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    serveStatic(req, res);
  } catch (e) {
    console.error(e);
    res.writeHead(500);
    res.end('Server error');
  }
});

server.listen(PORT, async () => {
  console.log(`Chatbot server running at http://localhost:${PORT}`);
  const loaded = await loadDocsFromFolder();
  console.log(`Loaded ${loaded} documents from docs/ folder.`);
  if (OPENAI_KEY) {
    const indexed = await indexDocsEmbeddings();
    console.log(`Indexed ${indexed} documents embeddings.`);
  }
});

// --- Rate limiter implementation
const rateBuckets = new Map();
function rateLimitAllow(req) {
  try {
    const ip = req.socket.remoteAddress || 'local';
    const now = Date.now();
    const windowMs = 60_000; // 1 minute
    const limit = 120; // requests per minute per IP
    let bucket = rateBuckets.get(ip);
    if (!bucket) { bucket = { ts: now, count: 0 }; rateBuckets.set(ip, bucket); }
    if (now - bucket.ts > windowMs) { bucket.ts = now; bucket.count = 0; }
    if (bucket.count >= limit) return false;
    bucket.count++;
    return true;
  } catch (e) { return true; }
}

// --- Simple moderation (server-side)
const bannedWords = ['badword1','badword2'];
async function moderateContent(text) {
  if (!text) return { ok: true };
  // fallback simple check
  const lower = text.toLowerCase();
  for (const w of bannedWords) if (lower.includes(w)) return { ok: false, reason: 'banned_word' };
  // if OpenAI key present, call moderation endpoint
  if (OPENAI_KEY && OPENAI_KEY.startsWith('sk-')) {
    try {
      const fetch = global.fetch || require('node-fetch');
      const r = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({ input: text })
      });
      const j = await r.json();
      const flagged = j?.results?.[0]?.flagged || false;
      return { ok: !flagged, meta: j };
    } catch (e) { return { ok: true }; }
  }
  return { ok: true };
}
