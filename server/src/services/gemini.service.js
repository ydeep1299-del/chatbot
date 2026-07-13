import Groq from "groq-sdk";

let client;

function getClient() {
  if (!client) {
    client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }
  return client;
}

export async function getChatResponse(history = [], userMessage) {
  const messages = [];

  for (const item of history) {
    messages.push({
      role: item.role === "model" ? "assistant" : item.role,
      content: item.parts[0].text,
    });
  }

  messages.push({
    role: "user",
    content: userMessage,
  });

  const completion = await getClient().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages,
    temperature: 0.7,
    max_tokens: 1024,
  });

  return completion.choices[0].message.content;
}