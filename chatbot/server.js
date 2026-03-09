const express = require("express");
const cors = require("cors");
const path = require("path");

if (process.env.NODE_ENV !== "test") {
  require("dotenv").config();
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Store conversation history per session (in-memory; resets on restart)
const conversations = new Map();

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  const { message, sessionId, apiKey } = req.body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "Message is required" });
  }

  // Use API key from request body, or fall back to environment variable
  const key = apiKey || process.env.OPENAI_API_KEY;

  if (!key || key === "your_openai_api_key_here") {
    return res.status(400).json({
      error:
        "OpenAI API key is not configured. Please enter your API key in the settings panel or set the OPENAI_API_KEY environment variable.",
    });
  }

  const sid = sessionId || "default";

  // Initialise conversation history for this session
  if (!conversations.has(sid)) {
    conversations.set(sid, [
      {
        role: "system",
        content:
          "You are a friendly, helpful AI assistant. Provide clear and concise answers. Use markdown formatting when appropriate.",
      },
    ]);
  }

  const history = conversations.get(sid);
  history.push({ role: "user", content: message.trim() });

  // Keep a reasonable context window (last 20 messages + system prompt)
  const maxMessages = 21;
  if (history.length > maxMessages) {
    const systemMsg = history[0];
    const recent = history.slice(-(maxMessages - 1));
    history.length = 0;
    history.push(systemMsg, ...recent);
  }

  try {
    const OpenAI = require("openai");
    const openai = new OpenAI({ apiKey: key });

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: history,
      temperature: 0.7,
      max_tokens: 1024,
    });

    const reply = completion.choices[0].message.content;
    history.push({ role: "assistant", content: reply });

    return res.json({ reply, sessionId: sid });
  } catch (err) {
    // Remove the failed user message so the conversation stays clean
    history.pop();

    if (err.status === 401) {
      return res.status(401).json({ error: "Invalid API key." });
    }
    if (err.status === 429) {
      return res
        .status(429)
        .json({ error: "Rate limit exceeded. Please try again shortly." });
    }
    console.error("OpenAI API error:", err.message);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// Clear conversation history
app.delete("/api/chat/:sessionId", (req, res) => {
  conversations.delete(req.params.sessionId);
  res.json({ status: "cleared" });
});

// Serve the frontend for any other route
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`AI Chatbot server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
