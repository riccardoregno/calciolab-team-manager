import { useEffect, useState } from "react";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { ensureDefaultTeam, getAuthSession, onAuthChange } from "../services/auth";

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

      if (!nextUser) {
        setTeam(null);
        setAuthLoading(false);
        return;
      }

      const { team: ensuredTeam, error } = await ensureDefaultTeam(nextUser);

      if (!active) return;

      setTeam(ensuredTeam);
      setAuthError(error?.message || null);
      setAuthLoading(false);
    }

    getAuthSession().then(({ session: currentSession, user: currentUser, error }) => {
      if (!active) return;

      setAuthError(error?.message || null);
      hydrateAuth(currentUser, currentSession);
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

