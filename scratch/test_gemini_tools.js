const { OpenAI } = require('openai');

const client = new OpenAI({
  apiKey: "AIzaSyByY9MyURsm2LM0fqtFF3wqgfASaSJ0lyg",
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

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
    console.log("Sending initial message to Gemini...");
    const messages = [{ role: "user", content: "I want to see the facilities list" }];
    const response = await client.chat.completions.create({
      model: "gemini-2.5-flash",
      messages: messages,
      tools: tools,
      tool_choice: 'auto'
    });
    
    const responseMessage = response.choices[0].message;
    messages.push(responseMessage);

    if (responseMessage.tool_calls) {
      console.log("Gemini requested tool call:", responseMessage.tool_calls[0].function.name);
      
      // Simulate tool response
      messages.push({
        tool_call_id: responseMessage.tool_calls[0].id,
        role: "tool",
        name: "get_facilities",
        content: JSON.stringify([{ id: 1, name: "Football Pitch" }])
      });

      console.log("Sending tool result back to Gemini...");
      const secondResponse = await client.chat.completions.create({
        model: "gemini-2.5-flash",
        messages: messages
      });
      console.log("Gemini responded with:", secondResponse.choices[0].message.content);
    } else {
      console.log("No tool call requested.");
    }
  } catch (error) {
    console.error("Diagnostic Error:", error);
  }
}

main();
