import { useEffect, useRef, useState } from "react";
import AppCard from "../components/ui/AppCard";
import PageHeader from "../components/ui/PageHeader";
import { useTranslation } from "../i18n";
import { useStaffChat } from "../hooks/useStaffChat";
import { useIsMobile } from "../hooks/useIsMobile";

// Ruoli → colori badge
const ROLE_COLORS = {
  owner:           { bg: "#7c3aed22", border: "#7c3aed66", text: "#c4b5fd" },
  headCoach:       { bg: "#2563eb22", border: "#2563eb66", text: "#93c5fd" },
  assistantCoach:  { bg: "#0891b222", border: "#0891b266", text: "#67e8f9" },
  athleticTrainer: { bg: "#05966922", border: "#05966966", text: "#6ee7b7" },
  director:        { bg: "#d9770622", border: "#d9770666", text: "#fcd34d" },
};

function roleBadgeStyle(role) {
  const c = ROLE_COLORS[role] || { bg: "#ffffff11", border: "#ffffff33", text: "#cbd5e1" };
  return {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 6,
    background: c.bg,
    border: `1px solid ${c.border}`,
    color: c.text,
    letterSpacing: 0.2,
  };
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDateLabel(iso, today, yesterday) {
  try {
    const d = new Date(iso);
    const todayDate   = new Date(); todayDate.setHours(0,0,0,0);
    const yesterdayDate = new Date(todayDate); yesterdayDate.setDate(todayDate.getDate() - 1);
    const msgDate     = new Date(d); msgDate.setHours(0,0,0,0);

    if (msgDate.getTime() === todayDate.getTime())     return today;
    if (msgDate.getTime() === yesterdayDate.getTime()) return yesterday;
    return d.toLocaleDateString([], { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

// Raggruppa messaggi per data
function groupByDate(messages) {
  const groups = [];
  let lastDate = null;
  for (const msg of messages) {
    const d = msg.created_at ? new Date(msg.created_at).toDateString() : "?";
    if (d !== lastDate) {
      groups.push({ type: "divider", date: msg.created_at, key: `divider-${d}` });
      lastDate = d;
    }
    groups.push({ type: "message", msg, key: msg.id });
  }
  return groups;
}

export default function StaffChat({ teamId, userId, authorName, authorRole }) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const {
    supported,
    messages,
    onlineUsers,
    loading,
    sending,
    sendMessage,
    deleteMessage,
    markSeen,
  } = useStaffChat({ teamId, userId, authorName, authorRole });

  const [input, setInput] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null); // id messaggio da confermare
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Segna visti all'apertura e al cambio messaggi
  useEffect(() => {
    markSeen();
  }, [markSeen]);

  useEffect(() => {
    if (messages.length > 0) markSeen();
  }, [messages.length, markSeen]);

  // Scroll in fondo a ogni nuovo messaggio
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;
    setInput("");
    await sendMessage(content);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleDelete(id) {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      // Auto-reset dopo 3s
      setTimeout(() => setDeleteConfirm((prev) => prev === id ? null : prev), 3000);
      return;
    }
    setDeleteConfirm(null);
    await deleteMessage(id);
  }

  const groups = groupByDate(messages);
  const today     = t("pages.staffChat.today");
  const yesterday = t("pages.staffChat.yesterday");
  const collaboratorsOnline = onlineUsers.filter((person) => person.user_id !== userId);

  function getReadBy(msg) {
    if (!msg?.created_at) return [];
    const createdAt = new Date(msg.created_at).getTime();
    return collaboratorsOnline.filter((person) => {
      const seenAt = person.last_seen_at ? new Date(person.last_seen_at).getTime() : 0;
      return seenAt >= createdAt;
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: isMobile ? "calc(100vh - 120px)" : "calc(100vh - 90px)", gap: 0 }}>
      <PageHeader
        title={t("pages.staffChat.title")}
        subtitle={t("pages.staffChat.subtitle")}
      />

      {!supported ? (
        <AppCard style={{ marginTop: 16 }}>
          <p style={{ color: "#94a3b8", margin: 0 }}>
            {t("pages.staffChat.noSupabase")}
          </p>
        </AppCard>
      ) : (
        <div style={chatStyles.shell}>
          <div style={chatStyles.presenceBar}>
            <div style={chatStyles.presenceTitle}>
              <span style={chatStyles.onlineDot} />
              <span>{t("pages.staffChat.onlineNow")}</span>
            </div>
            {collaboratorsOnline.length > 0 ? (
              <div style={chatStyles.presenceList}>
                {collaboratorsOnline.map((person) => (
                  <span key={person.user_id} style={chatStyles.presenceChip}>
                    <span style={chatStyles.presenceAvatar}>
                      {(person.author_name?.[0] || "?").toUpperCase()}
                    </span>
                    {person.author_name || t("pages.staffChat.collaborator")}
                  </span>
                ))}
              </div>
            ) : (
              <span style={chatStyles.presenceEmpty}>{t("pages.staffChat.noOneOnline")}</span>
            )}
          </div>

          {/* Lista messaggi */}
          <div style={chatStyles.messageList}>
            {loading && (
              <div style={chatStyles.centered}>
                <span style={{ color: "#64748b" }}>{t("common.loading")}</span>
              </div>
            )}

            {!loading && messages.length === 0 && (
              <div style={chatStyles.centered}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
                  <p style={{ color: "#64748b", margin: 0, fontWeight: 600 }}>
                    {t("pages.staffChat.empty")}
                  </p>
                </div>
              </div>
            )}

            {!loading && groups.map((item) => {
              if (item.type === "divider") {
                return (
                  <div key={item.key} style={chatStyles.dateDivider}>
                    <span style={chatStyles.dateDividerText}>
                      {formatDateLabel(item.date, today, yesterday)}
                    </span>
                  </div>
                );
              }

              const { msg } = item;
              const isOwn = msg.user_id === userId;
              const readBy = isOwn && !msg._optimistic ? getReadBy(msg) : [];

              return (
                <div
                  key={item.key}
                  style={{
                    ...chatStyles.messageRow,
                    flexDirection: isOwn ? "row-reverse" : "row",
                    opacity: msg._optimistic ? 0.7 : 1,
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      ...chatStyles.avatar,
                      background: isOwn
                        ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
                        : "linear-gradient(135deg, #374151, #1f2937)",
                    }}
                  >
                    {(msg.author_name?.[0] || "?").toUpperCase()}
                  </div>

                  {/* Bubble */}
                  <div
                    style={{
                      ...chatStyles.bubble,
                      background: isOwn
                        ? "linear-gradient(135deg, #1e40af, #1d4ed8)"
                        : "rgba(255,255,255,0.06)",
                      border: isOwn
                        ? "1px solid rgba(147,197,253,0.25)"
                        : "1px solid rgba(255,255,255,0.09)",
                      alignItems: isOwn ? "flex-end" : "flex-start",
                    }}
                  >
                    {/* Header bubble */}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexDirection: isOwn ? "row-reverse" : "row",
                      marginBottom: 4,
                    }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0" }}>
                        {isOwn ? t("pages.staffChat.you") : msg.author_name}
                      </span>
                      <span style={roleBadgeStyle(msg.author_role)}>
                        {t(`roles.${msg.author_role}`) || msg.author_role}
                      </span>
                      <span style={{ color: "#475569", fontSize: 11 }}>
                        {formatTime(msg.created_at)}
                      </span>
                    </div>

                    {/* Testo */}
                    <p style={chatStyles.bubbleText}>{msg.content}</p>

                    {readBy.length > 0 && (
                      <p style={chatStyles.readByText}>
                        {"✓✓ "}
                        {t("pages.staffChat.readBy")}{" "}
                        {readBy.map((person) => person.author_name || t("pages.staffChat.collaborator")).join(", ")}
                      </p>
                    )}

                    {/* Elimina (solo propri, non ottimistici) */}
                    {isOwn && !msg._optimistic && (
                      <button
                        type="button"
                        onClick={() => handleDelete(msg.id)}
                        style={{
                          ...chatStyles.deleteBtn,
                          ...(deleteConfirm === msg.id ? chatStyles.deleteBtnConfirm : {}),
                        }}
                        title={t("pages.staffChat.delete")}
                      >
                        {deleteConfirm === msg.id
                          ? t("pages.staffChat.confirmDelete")
                          : t("pages.staffChat.delete")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={chatStyles.inputBar}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("pages.staffChat.placeholder")}
              rows={1}
              disabled={sending}
              style={chatStyles.textarea}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              style={{
                ...chatStyles.sendBtn,
                opacity: !input.trim() || sending ? 0.45 : 1,
                cursor: !input.trim() || sending ? "not-allowed" : "pointer",
              }}
            >
              {sending ? "⏳" : "➤"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const chatStyles = {
  shell: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    overflow: "hidden",
  },
  presenceBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
    flexWrap: "wrap",
  },
  presenceTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "#22c55e",
    boxShadow: "0 0 0 4px rgba(34,197,94,0.12)",
  },
  presenceList: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  presenceChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "5px 10px 5px 6px",
    borderRadius: 999,
    background: "rgba(34,197,94,0.1)",
    border: "1px solid rgba(34,197,94,0.24)",
    color: "#bbf7d0",
    fontSize: 12,
    fontWeight: 800,
  },
  presenceAvatar: {
    width: 20,
    height: 20,
    borderRadius: 999,
    display: "inline-grid",
    placeItems: "center",
    background: "rgba(34,197,94,0.2)",
    color: "#dcfce7",
    fontSize: 11,
    fontWeight: 900,
  },
  presenceEmpty: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
  },
  messageList: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 20px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  centered: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  dateDivider: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "12px 0 8px",
  },
  dateDividerText: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 20,
    padding: "3px 14px",
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  messageRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    minWidth: 34,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 900,
    color: "white",
    marginBottom: 4,
  },
  bubble: {
    maxWidth: "72%",
    borderRadius: 16,
    padding: "10px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  bubbleText: {
    margin: 0,
    fontSize: 14,
    color: "#e2e8f0",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  readByText: {
    margin: "7px 0 0",
    color: "#7dd3fc",
    fontSize: 11,
    fontWeight: 800,
    textAlign: "right",
  },
  deleteBtn: {
    alignSelf: "flex-end",
    background: "rgba(248,113,113,0.08)",
    border: "1px solid rgba(248,113,113,0.18)",
    borderRadius: 999,
    color: "#fca5a5",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 800,
    padding: "4px 9px",
    marginTop: 7,
    transition: "all 0.15s",
  },
  deleteBtnConfirm: {
    background: "rgba(248,113,113,0.18)",
    border: "1px solid rgba(248,113,113,0.42)",
    color: "#fecaca",
  },
  inputBar: {
    display: "flex",
    alignItems: "flex-end",
    gap: 10,
    padding: "12px 16px",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
  },
  textarea: {
    flex: 1,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    color: "white",
    fontSize: 14,
    padding: "10px 14px",
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
    lineHeight: 1.5,
    maxHeight: 120,
    overflowY: "auto",
  },
  sendBtn: {
    width: 44,
    height: 44,
    minWidth: 44,
    borderRadius: 12,
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    border: "none",
    color: "white",
    fontSize: 18,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "opacity 0.15s",
  },
};
