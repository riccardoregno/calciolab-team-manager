import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

const acceptTeamInviteUrl = import.meta.env.VITE_ACCEPT_TEAM_INVITE_URL ||
  "https://sglevvqhlzpllrjrgbod.functions.supabase.co/accept-team-invite";
const INVITE_TOKEN_KEY = "calciolab_invite_token";
const FAILED_INVITE_TOKEN_KEY = "calciolab_failed_invite_token";

// user.user_metadata.invite_token resta scritto per sempre nel JWT dal momento
// della registrazione: se l'invito fallisce (soft error) non possiamo "pulirlo"
// da lì, quindi marchiamo il token come fallito e lo ignoriamo nei tentativi
// successivi, altrimenti ensureDefaultTeam lo ritenterebbe a ogni mount.
function getStoredInviteToken(user) {
  const failedToken = typeof window !== "undefined" ? localStorage.getItem(FAILED_INVITE_TOKEN_KEY) : "";

  const candidate = typeof window === "undefined"
    ? user?.user_metadata?.invite_token || ""
    : sessionStorage.getItem(INVITE_TOKEN_KEY) ||
      localStorage.getItem(INVITE_TOKEN_KEY) ||
      user?.user_metadata?.invite_token ||
      "";

  return candidate && candidate === failedToken ? "" : candidate;
}

function clearStoredInviteToken() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(INVITE_TOKEN_KEY);
  localStorage.removeItem(INVITE_TOKEN_KEY);
}

function markInviteTokenFailed(token) {
  if (typeof window === "undefined" || !token) return;
  localStorage.setItem(FAILED_INVITE_TOKEN_KEY, token);
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
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
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
  const hadInviteToken = Boolean(inviteToken);

  if (inviteToken) {
    const { team: invitedTeam, error: inviteError, status: inviteStatus } = await acceptTeamInvite(inviteToken);

    if (invitedTeam) {
      return { team: await attachPlayerAccount(invitedTeam, user.id) };
    }

    // Errori "soft": token non trovato (404), invito riservato ad altra email (403),
    // invito scaduto (410), o già membro senza payload team. In questi casi
    // puliamo il token invalido/stale e proseguiamo SOLO al lookup di membership
    // già esistenti: non creiamo mai un workspace nuovo partendo da un link invito.
    // Errori "hard" (rete, 500): restituiamo l'errore perché c'è un problema
    // infrastrutturale che vale la pena segnalare.
    // 401 = utente non autenticato: token stale, pulisci e prosegui al login normale
    const isSoftError = inviteStatus === 404 || inviteStatus === 403 || inviteStatus === 410 || inviteStatus === 401;

    if (inviteError) {
      if (import.meta.env.DEV) {
        console.warn("[auth] Invito non applicato (status=%d):", inviteStatus, inviteError.message);
      }
      if (!isSoftError) {
        // Errore hard (rete null/500): blocca e segnala
        return { team: null, error: inviteError };
      }
      // Errore soft: pulisci il token e prosegui al fallback membership.
      // Marca anche il token come fallito: se proviene da user_metadata (JWT),
      // clearStoredInviteToken() non basta perché lì non si può rimuovere.
      clearStoredInviteToken();
      markInviteTokenFailed(inviteToken);
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
    return { team: await attachPlayerAccount({
      ...existingMembership.teams,
      role: existingMembership.role,
    }, user.id) };
  }

  if (hadInviteToken) {
    return {
      team: null,
      error: new Error("Invito non completato: verifica che il link sia valido e che l'account usi la stessa email invitata."),
    };
  }

  // Controlla player_accounts prima di creare un nuovo team.
  // Un giocatore invitato non ha team_members ma ha player_accounts.
  const { data: playerAccount } = await supabase
    .from("player_accounts")
    .select("team_id, player_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (playerAccount?.team_id) {
    const { data: playerTeam } = await supabase
      .from("teams")
      .select(teamSelect)
      .eq("id", playerAccount.team_id)
      .maybeSingle();

    if (playerTeam) {
      return {
        team: {
          ...playerTeam,
          role: "player",
          playerId: playerAccount.player_id || null,
        },
      };
    }
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

async function attachPlayerAccount(team, userId) {
  if (!team || team.role !== "player" || team.playerId) return team;

  const { data: playerAccount } = await supabase
    .from("player_accounts")
    .select("player_id")
    .eq("auth_user_id", userId)
    .eq("team_id", team.id)
    .maybeSingle();

  return {
    ...team,
    playerId: playerAccount?.player_id || null,
  };
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
