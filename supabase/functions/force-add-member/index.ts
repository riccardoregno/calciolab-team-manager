import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Aggiunge direttamente un membro al team bypassando il flusso invito.
// Solo il proprietario/headCoach può chiamare questa funzione.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return json({ ok: true });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verifica che chi chiama sia autenticato
    const authHeader = req.headers.get("Authorization") || "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return json({ error: "Non autenticato" }, 401);
    }

    const { email, teamId, role: rawRole = "assistantCoach" } = await req.json();
    if (!email || !teamId) {
      return json({ error: "email e teamId obbligatori" }, 400);
    }
    const ALLOWED_ROLES = ["headCoach", "assistantCoach", "athleticTrainer", "director", "player"];
    const role = ALLOWED_ROLES.includes(rawRole) ? rawRole : "assistantCoach";

    const serviceClient = createClient(supabaseUrl, serviceKey);

    // Verifica che chi chiama sia owner/headCoach di questo team
    const { data: callerMembership } = await serviceClient
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (!callerMembership || !["owner", "headCoach"].includes(callerMembership.role)) {
      return json({ error: "Permesso negato" }, 403);
    }

    // Cerca l'utente per email con paginazione
    const emailLower = email.toLowerCase().trim();
    let targetUser = null;
    let page = 1;
    while (!targetUser) {
      const { data: page_data, error: listError } = await serviceClient.auth.admin.listUsers({ page, perPage: 200 });
      if (listError) return json({ error: listError.message }, 500);
      targetUser = (page_data?.users || []).find(
        (u: any) => u.email?.toLowerCase().trim() === emailLower
      ) || null;
      if (!page_data?.users?.length || page_data.users.length < 200) break;
      page++;
    }
    if (!targetUser) {
      return json({ error: `Nessun account trovato per ${email}. L'utente deve prima registrarsi.` }, 404);
    }

    // Aggiungi a team_members
    const { error: upsertError } = await serviceClient
      .from("team_members")
      .upsert(
        { team_id: teamId, user_id: targetUser.id, role },
        { onConflict: "team_id,user_id" }
      );
    if (upsertError) return json({ error: upsertError.message }, 500);

    // Aggiorna settings.members e rimuovi da pendingInvites
    const { data: teamRow } = await serviceClient
      .from("teams")
      .select("settings")
      .eq("id", teamId)
      .single();

    const settings = teamRow?.settings || {};
    const currentMembers: any[] = Array.isArray(settings.members) ? settings.members : [];
    const emailLower = email.toLowerCase().trim();
    const alreadyInMembers = currentMembers.some(
      (m: any) => String(m.email || "").toLowerCase().trim() === emailLower
    );
    const memberName =
      [targetUser.user_metadata?.first_name, targetUser.user_metadata?.last_name]
        .filter(Boolean)
        .join(" ") || email;

    const nextMembers = alreadyInMembers
      ? currentMembers
      : [
          ...currentMembers,
          {
            id: `member-${targetUser.id}`,
            name: memberName,
            email: emailLower,
            role,
            status: "Attivo",
            acceptedAt: new Date().toISOString(),
          },
        ];

    const nextPendingInvites = (settings.pendingInvites || []).filter(
      (inv: any) => String(inv.email || "").toLowerCase().trim() !== emailLower
    );

    await serviceClient
      .from("teams")
      .update({ settings: { ...settings, members: nextMembers, pendingInvites: nextPendingInvites } })
      .eq("id", teamId);

    return json({ success: true, userId: targetUser.id, name: memberName });
  } catch (err: any) {
    return json({ error: err.message || "Errore interno" }, 500);
  }
});

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
