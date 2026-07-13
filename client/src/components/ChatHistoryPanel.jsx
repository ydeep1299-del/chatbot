function formatWhen(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return time;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

function previewText(session) {
  const lastReal = [...session.messages].reverse().find((m) => m.text);
  if (!lastReal) return "No messages yet";
  return lastReal.text.length > 46 ? lastReal.text.slice(0, 46) + "…" : lastReal.text;
}

function ChatHistoryPanel({ sessions, activeId, onSelect, onDelete, onNewChat, onClose }) {
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="history-panel">
      <div className="history-panel-header">
        <span>💬 Chat History</span>
        <button className="history-close-btn" onClick={onClose} title="Close history">
          ✕
        </button>
      </div>

      <button className="new-chat-btn" onClick={onNewChat}>
        <span>＋</span> New chat
      </button>

      <div className="history-list">
        {sorted.length === 0 && (
          <div className="history-empty">No conversations yet — start chatting!</div>
        )}
        {sorted.map((session) => (
          <div
            key={session.id}
            className={`history-item ${session.id === activeId ? "active" : ""}`}
            onClick={() => onSelect(session.id)}
          >
            <div className="history-item-main">
              <div className="history-item-title">{session.title}</div>
              <div className="history-item-preview">{previewText(session)}</div>
              <div className="history-item-meta">
                {formatWhen(session.updatedAt)} · {session.messages.length} msgs
              </div>
            </div>
            <button
              className="history-item-delete"
              title="Delete this conversation"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(session.id);
              }}
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ChatHistoryPanel;
