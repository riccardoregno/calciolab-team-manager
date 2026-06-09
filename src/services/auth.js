import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

const acceptTeamInviteUrl = import.meta.env.VITE_ACCEPT_TEAM_INVITE_URL ||
  "https://sglevvqhlzpllrjrgbod.functions.supabase.co/accept-team-invite";
const INVITE_TOKEN_KEY = "calciolab_invite_token";

function getStoredInviteToken(user) {
  if (typeof window === "undefined") {
    return user?.user_metadata?.invite_token || "";
  }

  return sessionStorage.getItem(INVITE_TOKEN_KEY) ||
    localStorage.getItem(INVITE_TOKEN_KEY) ||
    user?.user_metadata?.invite_token ||
    "";
}

function clearStoredInviteToken() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(INVITE_TOKEN_KEY);
  localStorage.removeItem(INVITE_TOKEN_KEY);
}

export async function getAuthSession() {
  if (!isSupabaseConfigured) {
    return { session: null, user: null };
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    return { session: null, user: null, error };
  }

  return { session: data.session, user: data.session?.user || null };
}

export function onAuthChange(callback) {
  if (!isSupabaseConfigured) {
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback({ event, session, user: session?.user || null });
  });

  return () => data.subscription.unsubscribe();
}

export async function signInWithPassword(email, password) {
  if (!isSupabaseConfigured) {
    return { error: new Error("Supabase non configurato") };
  }

  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithPassword(email, password) {
  if (!isSupabaseConfigured) {
    return { error: new Error("Supabase non configurato") };
  }

  return supabase.auth.signUp({ email, password });
}

export async function signOut() {
  if (!isSupabaseConfigured) return { error: null };

  return supabase.auth.signOut();
}

export async function acceptTeamInvite(token) {
  if (!isSupabaseConfigured || !token) {
    return { team: null, error: null, status: null };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  if (sessionError || !accessToken) {
    return { team: null, error: sessionError || new Error("Sessione non disponibile"), status: null };
  }

  let response;
  try {
    response = await fetch(acceptTeamInviteUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ token }),
    });
  } catch (networkError) {
    return { team: null, error: networkError, status: null };
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.error) {
    return {
      team: null,
      error: new Error(payload?.error || "Invito non valido"),
      status: response.status,
    };
  }

  if (typeof window !== "undefined") {
    clearStoredInviteToken();
  }

  return { team: payload.team || null, error: null, status: response.status };
}

export async function ensureDefaultTeam(user) {
  if (!isSupabaseConfigured || !user) {
    return { team: null };
  }

  const inviteToken = getStoredInviteToken(user);

  if (inviteToken) {
    const { team: invitedTeam, error: inviteError, status: inviteStatus } = await acceptTeamInvite(inviteToken);

    if (invitedTeam) {
      return { team: invitedTeam };
    }

    // Errori "soft": token non trovato (404), invito riservato ad altra email (403),
    // invito scaduto (410), o già membro (il team è stato restituito comunque).
    // In questi casi puliamo il token invalido/stale e proseguiamo normalmente
    // al lookup delle membership esistenti dell'utente — così non si blocca chi
    // ha già un team o ha già accettato l'invito in precedenza.
    // Errori "hard" (rete, 500): restituiamo l'errore perché c'è un problema
    // infrastrutturale che vale la pena segnalare.
    const isSoftError = inviteStatus === 404 || inviteStatus === 403 || inviteStatus === 410;

    if (inviteError) {
      if (import.meta.env.DEV) {
        console.warn("[auth] Invito non applicato (status=%d):", inviteStatus, inviteError.message);
      }
      if (!isSoftError) {
        // Errore hard (rete null/500): blocca e segnala
        return { team: null, error: inviteError };
      }
      // Errore soft: pulisci il token e prosegui al fallback membership
      clearStoredInviteToken();
    }
  }

  const teamSelect = "id, name, season, category, subscription_plan, subscription_status, billing_status, trial_plan, trial_started_at, trial_ends_at, trial_used, stripe_customer_id, stripe_subscription_id, onboarding_completed, created_at";

  const { data: memberships, error: membershipError } = await supabase
    .from("team_members")
    .select(`team_id, role, teams(${teamSelect})`)
    .eq("user_id", user.id);

  if (membershipError) {
    return { team: null, error: membershipError };
  }

  const existingMembership = await pickBestMembership(memberships || []);

  if (existingMembership?.teams) {
    return {
      team: {
        ...existingMembership.teams,
        role: existingMembership.role,
      },
    };
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({
      name: "CalcioLab Team",
      season: "2025/2026",
      category: "Prima squadra",
      owner_id: user.id,
    })
    .select(teamSelect)
    .single();

  if (teamError) {
    return { team: null, error: teamError };
  }

  const { error: insertMembershipError } = await supabase
    .from("team_members")
    .insert({
      team_id: team.id,
      user_id: user.id,
      role: "owner",
    });

  if (insertMembershipError) {
    return { team: null, error: insertMembershipError };
  }

  return { team: { ...team, role: "owner" } };
}

async function pickBestMembership(memberships) {
  const validMemberships = memberships.filter((membership) => membership?.teams);
  if (validMemberships.length <= 1) return validMemberships[0] || null;

  const teamIds = validMemberships.map((membership) => membership.team_id).filter(Boolean);
  const playerCounts = await getTeamPlayerCounts(teamIds);
  const roleRank = { owner: 4, headCoach: 3, assistantCoach: 2, athleticTrainer: 2, director: 1 };

  return [...validMemberships].sort((a, b) => {
    const playersDiff = (playerCounts.get(b.team_id) || 0) - (playerCounts.get(a.team_id) || 0);
    if (playersDiff !== 0) return playersDiff;

    const roleDiff = (roleRank[b.role] || 0) - (roleRank[a.role] || 0);
    if (roleDiff !== 0) return roleDiff;

    return new Date(b.teams?.created_at || 0).getTime() - new Date(a.teams?.created_at || 0).getTime();
  })[0];
}

async function getTeamPlayerCounts(teamIds) {
  const counts = new Map();
  teamIds.forEach((teamId) => counts.set(teamId, 0));

  if (teamIds.length === 0) return counts;

  const { data, error } = await supabase
    .from("players")
    .select("team_id")
    .in("team_id", teamIds);

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[auth] Conteggio giocatori team non disponibile:", error.message);
    }
    return counts;
  }

  (data || []).forEach((row) => {
    counts.set(row.team_id, (counts.get(row.team_id) || 0) + 1);
  });

  return counts;
}
