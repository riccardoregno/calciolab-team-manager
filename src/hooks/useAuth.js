import { useEffect, useRef, useState } from "react";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { ensureDefaultTeam, getAuthSession, onAuthChange } from "../services/auth";

const AUTH_REQUEST_TIMEOUT_MS = 10000;
const AUTH_TEAM_CACHE_KEY = "calciolab_auth_team_cache_v1";

function withTimeout(promise, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label}: timeout connessione Supabase`));
    }, AUTH_REQUEST_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

function loadCachedTeam(userId) {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(AUTH_TEAM_CACHE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    if (parsed?.userId && parsed.userId === userId) {
      return parsed.team || null;
    }

    // Legacy cache shape was the raw team object. Ignore it because it was not
    // bound to the authenticated user and could leak a stale team across logins.
    if (parsed?.id) {
      window.localStorage.removeItem(AUTH_TEAM_CACHE_KEY);
    }

    return null;
  } catch {
    return null;
  }
}

function saveCachedTeam(userId, team) {
  if (typeof window === "undefined") return;
  try {
    if (userId && team) {
      window.localStorage.setItem(AUTH_TEAM_CACHE_KEY, JSON.stringify({ userId, team }));
    } else {
      window.localStorage.removeItem(AUTH_TEAM_CACHE_KEY);
    }
  } catch {
    // Cache solo UX: se fallisce, il flusso auth resta valido.
  }
}

export function useAuth() {
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [team, setTeam] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [teamLoading, setTeamLoading] = useState(false);

  // Traccia l'userId già idratato per skippare il team refetch su TOKEN_REFRESHED
  const hydratedUserIdRef = useRef(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    let active = true;

    async function hydrateAuth(nextUser, nextSession) {
      setSession(nextSession);
      setUser(nextUser);

      try {
        if (!nextUser) {
          hydratedUserIdRef.current = null;
          setTeam(null);
          saveCachedTeam(null, null);
          setAuthLoading(false);
          setTeamLoading(false);
          return;
        }

        const cachedTeam = loadCachedTeam(nextUser.id);
        if (cachedTeam) {
          setTeam(cachedTeam);
        }

        setAuthLoading(false);
        setTeamLoading(true);

        const { team: ensuredTeam, error } = await withTimeout(
          ensureDefaultTeam(nextUser),
          "Team",
        );

        if (!active) return;

        // Segna l'utente come completamente idratato SOLO dopo che il team è stato caricato.
        // Così TOKEN_REFRESHED non può skippare un'idratazione ancora in corso.
        hydratedUserIdRef.current = nextUser.id;
        setTeam(ensuredTeam);
        saveCachedTeam(nextUser.id, ensuredTeam);
        setAuthError(error?.message || null);
      } catch (error) {
        if (!active) return;
        setAuthError(error?.message || "Errore autenticazione Supabase");
      } finally {
        if (active) setAuthLoading(false);
        if (active) setTeamLoading(false);
      }
    }

    withTimeout(getAuthSession(), "Sessione").then(({ session: currentSession, user: currentUser, error }) => {
      if (!active) return;

      setAuthError(error?.message || null);
      hydrateAuth(currentUser, currentSession);
    }).catch((error) => {
      if (!active) return;
      setSession(null);
      setUser(null);
      setTeam(null);
      setAuthError(error?.message || "Errore autenticazione Supabase");
      setAuthLoading(false);
    });

    const unsubscribe = onAuthChange(({ event, session: nextSession, user: nextUser }) => {
      // TOKEN_REFRESHED con lo stesso utente → aggiorna solo la sessione (nuovo JWT),
      // non ri-fetchare il team (evita re-render pesanti ogni volta che l'utente
      // torna al tab dopo ≥5 minuti o alla scadenza del token ~1h).
      if (
        event === "TOKEN_REFRESHED" &&
        nextUser?.id &&
        nextUser.id === hydratedUserIdRef.current
      ) {
        setSession(nextSession);
        return;
      }
      if (!nextUser) setAuthLoading(true);
      hydrateAuth(nextUser, nextSession);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return {
    authConfigured: isSupabaseConfigured,
    authLoading,
    session,
    user,
    team,
    authError,
    teamLoading,
  };
}
