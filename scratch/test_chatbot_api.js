async function testChat() {
  const url = 'http://localhost:3333/api/chat';
  const payload = {
    message: 'Hello, I want to see the available facilities',
    history: [],
    preferredLanguage: 'en',
    sessionId: 'test-session-123'
  };

  try {
    console.log("Sending message to chatbot API...");
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    console.log("Response status:", res.status);
    const data = await res.json();
    console.log("Chatbot response:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("API request failed:", e);
  }
}

testChat();
