import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

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

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback({ session, user: session?.user || null });
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

export async function ensureDefaultTeam(user) {
  if (!isSupabaseConfigured || !user) {
    return { team: null };
  }

  const teamSelect = "id, name, season, category, subscription_plan, billing_status, trial_plan, trial_started_at, trial_ends_at, trial_used, stripe_customer_id, stripe_subscription_id";

  const { data: memberships, error: membershipError } = await supabase
    .from("team_members")
    .select(`team_id, role, teams(${teamSelect})`)
    .eq("user_id", user.id)
    .limit(1);

  if (membershipError) {
    return { team: null, error: membershipError };
  }

  const existingMembership = memberships?.[0];

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
