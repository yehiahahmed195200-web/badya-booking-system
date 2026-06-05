Chatbot Prototype
=================

Lightweight chatbot that runs locally in two modes:

- Smart local mode (no API key): handles booking/support flows and common small talk.
- Full LLM mode (API key): can answer broad/general questions as well.

Run:

```bash
# 1) copy env example and configure if you want full LLM answers
#    cp chatbot/.env.example chatbot/.env
#
# 2) run server
node chatbot/server.js
```

Open http://localhost:3333

Environment variables:

- `OPENAI_API_KEY`: OpenAI API key
- `LLM_API_KEY`: fallback key name (used if OPENAI_API_KEY is empty)
- `OPENROUTER_API_KEY`: auto-enables the OpenRouter base URL if set
- `LLM_BASE_URL`: optional OpenAI-compatible endpoint
- `LLM_MODEL`: optional model name (default `gpt-4o-mini`)
- `CHATBOT_PORT`: chatbot server port (default `3333`)

OpenAI-compatible provider example:

```env
LLM_API_KEY=your_provider_key
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=openai/gpt-4o-mini
```

Or use the dedicated OpenRouter variable:

```env
OPENROUTER_API_KEY=your_openrouter_key
LLM_MODEL=openai/gpt-4o-mini
```

Endpoints:
- `POST /api/chat` JSON { message }
- `POST /api/docs` JSON { title, text }
- `GET /api/docs`

Notes:
- If `OPENAI_API_KEY` (or `LLM_API_KEY`) is set, the server uses LLM responses and tools.
- If `OPENROUTER_API_KEY` is set, the server switches to the OpenRouter API base automatically.
- Without a key, it runs in smart local mode with domain-focused fallback behavior.
- Session memory is used to keep user preferences (name, preferred sport, response style) across messages.
- History is sanitized and truncated before model calls to improve stability.
- Guardrails reduce hallucination risk by preferring grounded answers and explicit uncertainty when needed.
