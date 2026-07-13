import { useState, useRef, useEffect } from "react";
import { sendMessage } from "../services/chatApi.js";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition.js";
import { speakText } from "../hooks/useSpeechSynthesis.js";
import ChatHistoryPanel from "./ChatHistoryPanel.jsx";

const SESSIONS_KEY = "ai-chatbot-demo:sessions";
const ACTIVE_KEY = "ai-chatbot-demo:active-session";

const GREETING_TEXT = "Hi! I'm your AI assistant. Ask me anything, by typing or by voice.";

function makeGreeting() {
  return { role: "model", text: GREETING_TEXT, timestamp: Date.now() };
}

function makeSession() {
  return {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "New chat",
    messages: [makeGreeting()],
    updatedAt: Date.now(),
  };
}

// Reads saved sessions from localStorage, falling back to a single fresh
// session if nothing is stored yet (or the stored data is corrupted).
function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // fall through to fresh session
  }
  return [makeSession()];
}

function loadActiveId(sessions) {
  try {
    const id = localStorage.getItem(ACTIVE_KEY);
    if (id && sessions.some((s) => s.id === id)) return id;
  } catch {
    // ignore
  }
  return sessions[0].id;
}

function deriveTitle(messages) {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  return firstUser.text.length > 32 ? firstUser.text.slice(0, 32) + "…" : firstUser.text;
}

function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ChatWindow({ onClose }) {
  const [sessions, setSessions] = useState(loadSessions);
  const [activeId, setActiveId] = useState(() => loadActiveId(loadSessions()));
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const messagesEndRef = useRef(null);

  const activeSession = sessions.find((s) => s.id === activeId) || sessions[0];
  const messages = activeSession.messages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showHistory]);

  // Persist every change to sessions / active session.
  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
      localStorage.setItem(ACTIVE_KEY, activeId);
    } catch {
      // localStorage can fail (private browsing, quota) — non-fatal.
    }
  }, [sessions, activeId]);

  const updateActiveMessages = (updater) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeId) return s;
        const nextMessages = updater(s.messages);
        return {
          ...s,
          messages: nextMessages,
          title: deriveTitle(nextMessages),
          updatedAt: Date.now(),
        };
      })
    );
  };

  const handleNewChat = () => {
    const fresh = makeSession();
    setSessions((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    setShowHistory(false);
  };

  const handleSelectSession = (id) => {
    setActiveId(id);
    setShowHistory(false);
  };

  const handleDeleteSession = (id) => {
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      if (remaining.length === 0) {
        const fresh = makeSession();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) {
        setActiveId(remaining[0].id);
      }
      return remaining;
    });
  };

  // Builds the Gemini-style history array from our simple messages state.
  // Gemini requires history to start with role "user", so we drop any
  // leading "model" messages (like our initial greeting) before sending.
  const buildHistory = (msgs) => {
    const firstUserIndex = msgs.findIndex((m) => m.role === "user");
    if (firstUserIndex === -1) return [];
    return msgs.slice(firstUserIndex).map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));
  };

  const handleSend = async (textToSend) => {
    const text = (textToSend ?? input).trim();
    if (!text || isLoading) return;

    const historyBeforeThisMessage = buildHistory(messages);
    const userMessage = { role: "user", text, timestamp: Date.now() };
    updateActiveMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const reply = await sendMessage(text, historyBeforeThisMessage);
      updateActiveMessages((prev) => [
        ...prev,
        { role: "model", text: reply, timestamp: Date.now() },
      ]);
      if (voiceReplyEnabled) speakText(reply);
    } catch (err) {
      updateActiveMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: "Sorry, I couldn't reach the server. Is it running?",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const { startListening, isListening, isSupported } = useSpeechRecognition(
    (transcript) => {
      setInput(transcript);
      handleSend(transcript);
    }
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSend();
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-header-left">
          <span className="bot-avatar">🤖</span>
          <div className="chat-header-text">
            <div className="chat-title">AI Assistant</div>
            <div className="chat-status">
              <span className="status-dot" /> Online
            </div>
          </div>
        </div>

        <div className="chat-header-actions">
          <button
            className="icon-btn"
            onClick={() => setShowHistory((v) => !v)}
            title="Chat history"
          >
            🕘
          </button>
          <button className="icon-btn" onClick={handleNewChat} title="New chat">
            ＋
          </button>
          <button className="icon-btn close-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
      </div>

      {showHistory ? (
        <ChatHistoryPanel
          sessions={sessions}
          activeId={activeId}
          onSelect={handleSelectSession}
          onDelete={handleDeleteSession}
          onNewChat={handleNewChat}
          onClose={() => setShowHistory(false)}
        />
      ) : (
        <>
          <div className="chat-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`msg-row ${msg.role}`}>
                <span className="msg-avatar">{msg.role === "user" ? "🧑" : "🤖"}</span>
                <div className="msg-col">
                  <div className={`chat-bubble ${msg.role}`}>{msg.text}</div>
                  {msg.timestamp && <span className="msg-time">{formatTime(msg.timestamp)}</span>}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="msg-row model">
                <span className="msg-avatar">🤖</span>
                <div className="msg-col">
                  <div className="chat-bubble model typing-bubble">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-row">
            <button
              className={`mic-btn ${isListening ? "listening" : ""}`}
              onClick={startListening}
              title={isSupported ? "Speak your message" : "Voice input not supported in this browser"}
              disabled={isLoading}
            >
              🎤
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? "Listening..." : "Type your message..."}
              disabled={isLoading}
            />

            <button className="send-btn" onClick={() => handleSend()} disabled={isLoading}>
              ➤
            </button>
          </div>

          <label className="voice-toggle">
            <input
              type="checkbox"
              checked={voiceReplyEnabled}
              onChange={(e) => setVoiceReplyEnabled(e.target.checked)}
            />
            Read replies aloud
          </label>
        </>
      )}
    </div>
  );
}

export default ChatWindow;
