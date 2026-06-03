import { useCallback, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

const LAST_SEEN_KEY = (teamId, userId) =>
  `calciolab_chat_lastseen_${teamId}_${userId}`;

const PAGE_SIZE = 60;

function flattenPresenceState(state = {}) {
  const byUser = new Map();

  Object.values(state).flat().forEach((presence) => {
    if (!presence?.user_id) return;
    const existing = byUser.get(presence.user_id);
    const existingSeen = existing?.last_seen_at ? new Date(existing.last_seen_at).getTime() : 0;
    const nextSeen = presence.last_seen_at ? new Date(presence.last_seen_at).getTime() : 0;
    if (!existing || nextSeen >= existingSeen) {
      byUser.set(presence.user_id, presence);
    }
  });

  return Array.from(byUser.values()).sort((a, b) =>
    String(a.author_name || "").localeCompare(String(b.author_name || ""))
  );
}

/**
 * useStaffChat — gestisce messaggi real-time della chat staff.
 *
 * @param {object} params
 * @param {string} params.teamId   — ID del team (uuid)
 * @param {string} params.userId   — ID dell'utente corrente (auth.uid)
 * @param {string} params.authorName — Nome visualizzato del mittente
 * @param {string} params.authorRole — Ruolo del mittente
 *
 * Returns:
 *   messages     — array di messaggi { id, user_id, author_name, author_role, content, created_at }
 *   loading      — bool caricamento iniziale
 *   sending      — bool invio in corso
 *   unreadCount  — messaggi nuovi da quando l'utente ha visitato l'ultima volta
 *   sendMessage  — async (content: string) => { error }
 *   deleteMessage— async (id: string) => { error }
 *   markSeen     — segna tutti i messaggi come letti (chiama quando si apre la chat)
 *   supported    — false se Supabase non è configurato
 */
export function useStaffChat({ teamId, userId, authorName = "", authorRole = "headCoach", instanceId = "main" } = {}) {
  const supported = isSupabaseConfigured && Boolean(teamId) && Boolean(userId);

  const [messages, setMessages]     = useState([]);
  const [loading, setLoading]       = useState(supported);
  const [sending, setSending]       = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const channelRef = useRef(null);
  const shouldTrackPresence = instanceId === "main";

  // lastSeen è il timestamp ISO dell'ultima visita alla chat
  const lastSeenRef = useRef(
    typeof window !== "undefined" && teamId && userId
      ? window.localStorage.getItem(LAST_SEEN_KEY(teamId, userId)) || null
      : null
  );

  // Calcola non letti da un array di messaggi
  function calcUnread(msgs) {
    if (!lastSeenRef.current) return 0;
    const last = new Date(lastSeenRef.current).getTime();
    return msgs.filter(
      (m) => m.user_id !== userId && new Date(m.created_at).getTime() > last
    ).length;
  }

  const buildPresencePayload = useCallback((lastSeenAt = lastSeenRef.current) => ({
    user_id:      userId,
    author_name:  authorName || "Staff",
    author_role:  authorRole,
    online_at:    new Date().toISOString(),
    last_seen_at: lastSeenAt || new Date().toISOString(),
  }), [userId, authorName, authorRole]);

  // --- Caricamento iniziale ---
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!supported) { setLoading(false); return; }

    let active = true;
    setLoading(true);

    supabase
      .from("staff_messages")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: true })
      .limit(PAGE_SIZE)
      .then(({ data, error }) => {
        if (!active) return;
        if (!error && data) {
          setMessages(data);
          setUnreadCount(calcUnread(data));
        }
        setLoading(false);
      });

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, teamId]);

  // --- Real-time subscription ---
  useEffect(() => {
    if (!supported) return;

    let channel;
    try {
    channel = supabase
      .channel(`staff_messages:${teamId}:${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "staff_messages",
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          setMessages((prev) => {
            // Evita duplicati (ottimismo locale + real-time)
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            const next = [...prev, payload.new];
            setUnreadCount(calcUnread(next));
            return next;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "staff_messages",
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .on("presence", { event: "sync" }, () => {
        if (!shouldTrackPresence) return;
        setOnlineUsers(flattenPresenceState(channel.presenceState()));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && shouldTrackPresence) {
          channel.track(buildPresencePayload());
        }
      });
      channelRef.current = channel;
    } catch (err) {
      if (import.meta.env.DEV) console.warn("[useStaffChat] Realtime subscription failed:", err);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (channelRef.current === channel) channelRef.current = null;
      setOnlineUsers([]);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, teamId, instanceId, shouldTrackPresence, buildPresencePayload]);

  // --- Invia messaggio ---
  const sendMessage = useCallback(async (content) => {
    if (!supported) return { error: new Error("Supabase non configurato") };
    const trimmed = content?.trim();
    if (!trimmed) return { error: new Error("Messaggio vuoto") };

    setSending(true);

    // Ottimismo locale: inserisce subito in UI
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id:          tempId,
      team_id:     teamId,
      user_id:     userId,
      author_name: authorName,
      author_role: authorRole,
      content:     trimmed,
      created_at:  new Date().toISOString(),
      _optimistic: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    const { data, error } = await supabase
      .from("staff_messages")
      .insert({
        team_id:     teamId,
        user_id:     userId,
        author_name: authorName,
        author_role: authorRole,
        content:     trimmed,
      })
      .select()
      .single();

    setSending(false);

    if (error) {
      // Rollback ottimismo
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      return { error };
    }

    // Sostituisce il messaggio ottimistico con quello reale (real-time potrebbe arrivare tardi)
    setMessages((prev) =>
      prev.map((m) => (m.id === tempId ? data : m))
    );

    return { error: null };
  }, [supported, teamId, userId, authorName, authorRole]);

  // --- Elimina messaggio ---
  const deleteMessage = useCallback(async (id) => {
    if (!supported) return { error: new Error("Supabase non configurato") };

    // Rimozione ottimistica
    setMessages((prev) => prev.filter((m) => m.id !== id));

    const { error } = await supabase
      .from("staff_messages")
      .delete()
      .eq("id", id)
      .eq("user_id", userId); // RLS: solo i propri messaggi

    if (error) {
      // Non ripristiniamo (messaggio già rimosso localmente), ma segnaliamo
      return { error };
    }

    return { error: null };
  }, [supported, userId]);

  // --- Segna come letti ---
  const markSeen = useCallback(() => {
    const now = new Date().toISOString();
    lastSeenRef.current = now;
    if (typeof window !== "undefined" && teamId && userId) {
      window.localStorage.setItem(LAST_SEEN_KEY(teamId, userId), now);
    }
    setUnreadCount(0);
    if (shouldTrackPresence) {
      channelRef.current?.track(buildPresencePayload(now));
    }
  }, [teamId, userId, shouldTrackPresence, buildPresencePayload]);

  return {
    supported,
    messages,
    onlineUsers,
    loading,
    sending,
    unreadCount,
    sendMessage,
    deleteMessage,
    markSeen,
  };
}
