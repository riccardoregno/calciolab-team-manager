import { useCallback, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

const LAST_SEEN_KEY = (teamId, userId) =>
  `calciolab_chat_lastseen_${teamId}_${userId}`;

const PAGE_SIZE = 60;

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
export function useStaffChat({ teamId, userId, authorName = "", authorRole = "headCoach" } = {}) {
  const supported = isSupabaseConfigured && Boolean(teamId) && Boolean(userId);

  const [messages, setMessages]     = useState([]);
  const [loading, setLoading]       = useState(supported);
  const [sending, setSending]       = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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

  // --- Caricamento iniziale ---
  useEffect(() => {
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

    const channel = supabase
      .channel(`staff_messages:${teamId}`)
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
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, teamId]);

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
  }, [teamId, userId]);

  return {
    supported,
    messages,
    loading,
    sending,
    unreadCount,
    sendMessage,
    deleteMessage,
    markSeen,
  };
}
