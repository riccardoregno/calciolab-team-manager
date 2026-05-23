import { useCallback, useMemo, useState } from "react";

const STORAGE_KEY = "calciolab_inapp_notif_read";

function loadReadSet() {
  try {
    const raw = typeof window !== "undefined"
      ? window.localStorage.getItem(STORAGE_KEY)
      : null;
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadSet(set) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch { /* ignore */ }
}

/**
 * useInAppNotifications — genera notifiche in-app da dati esistenti.
 * Gestisce lo stato letto/non letto in localStorage.
 *
 * @param {object} params
 * @param {array}  params.players
 * @param {array}  params.sessions
 * @param {array}  params.matches
 * @param {array}  params.staffTasks
 * @param {number} params.chatUnread
 *
 * Returns:
 *   notifications  — array di { id, type, icon, title, text, to, createdAt }
 *   unreadCount    — numero di notifiche non lette
 *   markAllRead    — segna tutte come lette
 *   markRead       — segna una singola come letta
 *   isRead         — (id) => bool
 */
export function useInAppNotifications({
  players     = [],
  sessions    = [],
  matches     = [],
  staffTasks  = [],
  chatUnread  = 0,
} = {}) {
  const [readSet, setReadSet] = useState(loadReadSet);

  // ── Genera notifiche ───────────────────────────────────────────────────────
  const notifications = useMemo(() => {
    const now   = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const in48h = new Date(today); in48h.setDate(today.getDate() + 2);

    const items = [];

    // 1. Giocatori infortunati
    players
      .filter((p) => p.status === "Infortunato")
      .forEach((p) => {
        items.push({
          id:        `injured-${p.id}`,
          type:      "injury",
          icon:      "🚑",
          title:     p.name,
          text:      p.injury || "Stato: Infortunato",
          to:        `/players/${p.id}`,
          createdAt: null,
          priority:  1,
        });
      });

    // 2. Giocatori squalificati
    players
      .filter((p) => p.status === "Squalificato")
      .forEach((p) => {
        items.push({
          id:        `suspended-${p.id}`,
          type:      "suspended",
          icon:      "🟥",
          title:     p.name,
          text:      "Squalificato",
          to:        `/players/${p.id}`,
          createdAt: null,
          priority:  2,
        });
      });

    // 3. Partite nelle prossime 48h
    matches
      .filter((m) => {
        const d = new Date(m.date);
        return d >= today && d < in48h;
      })
      .forEach((m) => {
        const hoursAway = Math.round((new Date(m.date) - now) / 36e5);
        items.push({
          id:        `match-soon-${m.id}`,
          type:      "match",
          icon:      "⚽",
          title:     m.opponent ? `vs ${m.opponent}` : m.title,
          text:      hoursAway < 24
            ? `Tra ${hoursAway}h · ${m.location || ""}`
            : `Domani · ${m.location || ""}`,
          to:        "/matches",
          createdAt: m.date,
          priority:  1,
        });
      });

    // 4. Allenamenti nelle prossime 24h
    sessions
      .filter((s) => {
        const d = new Date(s.date);
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
        const dayAfter  = new Date(tomorrow); dayAfter.setDate(tomorrow.getDate() + 1);
        return d >= tomorrow && d < dayAfter;
      })
      .forEach((s) => {
        items.push({
          id:        `session-soon-${s.id}`,
          type:      "session",
          icon:      "📋",
          title:     s.title || "Allenamento",
          text:      `Domani${s.theme ? ` · ${s.theme}` : ""}`,
          to:        "/trainings",
          createdAt: s.date,
          priority:  3,
        });
      });

    // 5. Task scaduti (dueDate < oggi e non completati)
    staffTasks
      .filter((task) => {
        if (!task.dueDate || task.status === "done") return false;
        return new Date(task.dueDate) < today;
      })
      .slice(0, 3)
      .forEach((task) => {
        items.push({
          id:        `task-overdue-${task.id}`,
          type:      "task",
          icon:      "⚠️",
          title:     task.title || "Task scaduto",
          text:      `Scaduto il ${task.dueDate}`,
          to:        "/staff-tasks",
          createdAt: task.dueDate,
          priority:  2,
        });
      });

    // 6. Chat non letti
    if (chatUnread > 0) {
      items.push({
        id:        `chat-unread-${chatUnread}`,
        type:      "chat",
        icon:      "💬",
        title:     `${chatUnread} ${chatUnread === 1 ? "messaggio non letto" : "messaggi non letti"}`,
        text:      "Chat staff",
        to:        "/staff-chat",
        createdAt: null,
        priority:  3,
      });
    }

    // Ordina: priority asc, poi per data desc
    return items.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.createdAt && b.createdAt) return new Date(b.createdAt) - new Date(a.createdAt);
      return 0;
    });
  }, [players, sessions, matches, staffTasks, chatUnread]);

  // ── Helpers letto/non letto ───────────────────────────────────────────────
  const isRead = useCallback(
    (id) => readSet.has(id),
    [readSet],
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readSet.has(n.id)).length,
    [notifications, readSet],
  );

  const markRead = useCallback((id) => {
    setReadSet((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadSet(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadSet((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      saveReadSet(next);
      return next;
    });
  }, [notifications]);

  return { notifications, unreadCount, isRead, markRead, markAllRead };
}
