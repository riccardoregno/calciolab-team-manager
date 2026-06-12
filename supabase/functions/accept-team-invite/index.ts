import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const teamSelect = "id, name, season, category, subscription_plan, billing_status, trial_plan, trial_started_at, trial_ends_at, trial_used, stripe_customer_id, stripe_subscription_id";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    const inviteToken = String(token || "").trim();

    if (!inviteToken) {
      return json({ error: "Token invito mancante" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: "Supabase secrets non configurati" }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();

    if (authError || !authData.user) {
      return json({ error: "Utente non autenticato" }, 401);
    }

    const serviceClient = createClient(supabaseUrl, serviceKey);

    const { data: teams, error: teamError } = await serviceClient
      .from("teams")
      .select(`${teamSelect}, settings`)
      .eq("settings->>inviteToken", inviteToken)
      .limit(1);

    if (teamError) {
      return json({ error: teamError.message }, 500);
    }

    const team = teams?.[0];
    if (!team) {
      return json({ error: "Invito non trovato o non valido" }, 404);
    }

    const user = authData.user;
    const userEmail = String(user.email || "").trim().toLowerCase();
    const settings = team.settings || {};

    // Controlla la scadenza del token canonico (teams.settings.inviteTokenExpiresAt).
    // Se il token è scaduto rispondiamo 410 — stesso codice usato per i pendingInvites
    // scaduti, così auth.js lo tratta come soft-error e prosegue al lookup membership.
    if (settings.inviteTokenExpiresAt && new Date(settings.inviteTokenExpiresAt).getTime() < Date.now()) {
      return json({ error: "Il link di invito è scaduto" }, 410);
    }

    const pendingInvites = Array.isArray(settings.pendingInvites) ? settings.pendingInvites : [];
    const pendingInvite = pendingInvites.find((invite) =>
      String(invite.email || "").trim().toLowerCase() === userEmail
    );
    const hasNamedInvites = pendingInvites.some((invite) => Boolean(String(invite.email || "").trim()));

    if (hasNamedInvites && !pendingInvite) {
      return json({ error: "Questo invito è riservato a un'altra email" }, 403);
    }

    if (pendingInvite?.expiresAt && new Date(pendingInvite.expiresAt).getTime() < Date.now()) {
      return json({ error: "Questo invito è scaduto" }, 410);
    }

    const role = pendingInvite?.role || "assistantCoach";

    const { data: existingMembership, error: existingError } = await serviceClient
      .from("team_members")
      .select("team_id, user_id, role")
      .eq("team_id", team.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) {
      return json({ error: existingError.message }, 500);
    }

    // FIX: SELECT + INSERT separati lasciavano una finestra di race condition —
    // un doppio click / reload sul link invito durante quella finestra produceva
    // righe duplicate per lo stesso (team_id, user_id) (vedi migrazione
    // 20260607130000_team_members_unique_dedupe.sql, che ha anche aggiunto il
    // vincolo UNIQUE usato qui come onConflict). upsert è atomico e idempotente:
    // chiamate concorrenti convergono su un'unica riga.
    const nextRole = existingMembership?.role && pendingInvite?.role
      ? (existingMembership.role !== pendingInvite.role ? pendingInvite.role : existingMembership.role)
      : (existingMembership?.role || role);

    const { error: upsertError } = await serviceClient
      .from("team_members")
      .upsert(
        { team_id: team.id, user_id: user.id, role: nextRole },
        { onConflict: "team_id,user_id" },
      );

    if (upsertError) {
      return json({ error: upsertError.message }, 500);
    }

    if (pendingInvite?.role === "player" && pendingInvite?.playerId) {
      const { error: playerAccountError } = await serviceClient
        .from("player_accounts")
        .upsert(
          { auth_user_id: user.id, team_id: team.id, player_id: String(pendingInvite.playerId) },
          { onConflict: "auth_user_id" },
        );

      if (playerAccountError) {
        return json({ error: playerAccountError.message }, 500);
      }
    }

    const nextPendingInvites = pendingInvite
      ? pendingInvites.filter((invite) =>
        String(invite.email || "").trim().toLowerCase() !== userEmail
      )
      : pendingInvites;
    const memberName = pendingInvite?.name ||
      [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(" ") ||
      userEmail;
    const currentMembers = Array.isArray(settings.members) ? settings.members : [];
    const memberExists = currentMembers.some((member) =>
      String(member.email || "").trim().toLowerCase() === userEmail
    );
    const nextMembers = memberExists
      ? currentMembers
      : [
        ...currentMembers,
        {
          id: `member-${user.id}`,
          name: memberName,
          email: userEmail,
          role,
          status: "Attivo",
          invitedAt: pendingInvite?.sentAt || null,
          acceptedAt: new Date().toISOString(),
          customAreas: pendingInvite?.customAreas || {},
        },
      ];

    const { error: settingsError } = await serviceClient
      .from("teams")
      .update({
        settings: {
          ...settings,
          pendingInvites: nextPendingInvites,
          members: nextMembers,
        },
      })
      .eq("id", team.id);

    if (settingsError) {
      return json({ error: settingsError.message }, 500);
    }

    const { data: membership } = await serviceClient
      .from("team_members")
      .select(`team_id, role, teams(${teamSelect})`)
      .eq("team_id", team.id)
      .eq("user_id", user.id)
      .single();

    return json({
      success: true,
      alreadyMember: Boolean(existingMembership),
      role: membership?.role || role,
      team: membership?.teams
        ? { ...membership.teams, role: membership.role || role }
        : { ...team, settings: undefined, role },
    });
  } catch (error) {
    return json({ error: error.message || "Errore invito" }, 500);
  }
});

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
