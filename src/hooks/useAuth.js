import { useEffect, useState } from "react";
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

function loadCachedTeam() {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(AUTH_TEAM_CACHE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveCachedTeam(team) {
  if (typeof window === "undefined") return;
  try {
    if (team) {
      window.localStorage.setItem(AUTH_TEAM_CACHE_KEY, JSON.stringify(team));
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
  const [team, setTeam] = useState(loadCachedTeam);
  const [authError, setAuthError] = useState(null);
  const [teamLoading, setTeamLoading] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    let active = true;

    async function hydrateAuth(nextUser, nextSession) {
      setSession(nextSession);
      setUser(nextUser);

      try {
        if (!nextUser) {
          setTeam(null);
          saveCachedTeam(null);
          setAuthLoading(false);
          setTeamLoading(false);
          return;
        }

        setAuthLoading(false);
        setTeamLoading(true);

        const { team: ensuredTeam, error } = await withTimeout(
          ensureDefaultTeam(nextUser),
          "Team",
        );

        if (!active) return;

        setTeam(ensuredTeam);
        saveCachedTeam(ensuredTeam);
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

    const unsubscribe = onAuthChange(({ session: nextSession, user: nextUser }) => {
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
