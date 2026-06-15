require('dotenv').config();
const { OpenAI } = require('openai');

const client = new OpenAI({
  apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.LLM_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai/"
});

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

async function main() {
  const tools = [
    {
      type: 'function',
      function: {
        name: 'get_facilities',
        description: 'Get the list of active sports facilities and courts.'
      }
    }
  ];

  try {
    console.log("Starting test call to Gemini with tools...");
    const response = await createChatCompletionWithRetry(client, {
      model: "gemini-2.5-flash",
      messages: [{ role: "user", content: "I want to see the facilities list" }],
      tools: tools,
      tool_choice: 'auto'
    });
    console.log("Success! Choices:", JSON.stringify(response.choices));
  } catch (error) {
    console.error("Diagnostic Error (All retries failed):", error.message || error);
  }
}

main();
