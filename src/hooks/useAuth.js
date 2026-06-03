import { useEffect, useState } from "react";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { ensureDefaultTeam, getAuthSession, onAuthChange } from "../services/auth";

const AUTH_REQUEST_TIMEOUT_MS = 10000;

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

export function useAuth() {
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [team, setTeam] = useState(null);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    let active = true;

    async function hydrateAuth(nextUser, nextSession) {
      setSession(nextSession);
      setUser(nextUser);

      try {
        if (!nextUser) {
          setTeam(null);
          setAuthLoading(false);
          return;
        }

        const { team: ensuredTeam, error } = await withTimeout(
          ensureDefaultTeam(nextUser),
          "Team",
        );

        if (!active) return;

        setTeam(ensuredTeam);
        setAuthError(error?.message || null);
      } catch (error) {
        if (!active) return;
        setTeam(null);
        setAuthError(error?.message || "Errore autenticazione Supabase");
      } finally {
        if (active) setAuthLoading(false);
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
      setAuthLoading(true);
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
  };
}
