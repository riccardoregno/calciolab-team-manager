import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Env ──────────────────────────────────────────────────────────────────────
const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")              ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CHECK_TRIALS_SECRET       = Deno.env.get("CHECK_TRIALS_SECRET")       ?? "";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
function isAuthorized(req: Request): boolean {
  // 1. Secret header (da cron / pg_net)
  if (CHECK_TRIALS_SECRET && req.headers.get("x-internal-secret") === CHECK_TRIALS_SECRET) {
    return true;
  }
  // 2. Service role Bearer
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  return bearer === SUPABASE_SERVICE_ROLE_KEY;
}

// ─── Supabase client ──────────────────────────────────────────────────────────
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Invia email via send-email Edge Function (fire-and-forget) */
async function sendEmail(payload: Record<string, unknown>) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(payload),
    });
  } catch { /* fire-and-forget */ }
}

/** Recupera email + first_name dell'owner di un team */
async function getOwnerInfo(teamId: string): Promise<{ email?: string; firstName?: string }> {
  if (!supabase) return {};
  try {
    const { data } = await supabase
      .from("team_members")
      .select("profiles:profiles(email, first_name)")
      .eq("team_id", teamId)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();

    const profile = (data as Record<string, unknown> | null)
      ?.profiles as Record<string, string> | undefined;

    return { email: profile?.email, firstName: profile?.first_name };
  } catch {
    return {};
  }
}

// ─── Tipi ─────────────────────────────────────────────────────────────────────
interface TrialTeam {
  id: string;
  trial_ends_at: string;
  trial_plan: string;
  trial_reminder_3d_sent: boolean;
  trial_reminder_1d_sent: boolean;
}

interface SendResult {
  teamId: string;
  type: "3d" | "1d";
  email?: string;
  sent: boolean;
  reason?: string;
}

// ─── Logica principale ────────────────────────────────────────────────────────

/**
 * Controlla i trial in scadenza e invia email di reminder.
 *
 * Finestre temporali (il cron deve girare 1× al giorno):
 *  - 3 giorni: trial_ends_at tra [now + 2.5d, now + 3.5d]
 *  - 1 giorno: trial_ends_at tra [now + 0.5d, now + 1.5d]
 *
 * Le colonne trial_reminder_3d_sent / trial_reminder_1d_sent evitano duplicati
 * se il cron venisse eseguito più volte nello stesso giorno.
 */
async function checkAndSendReminders(): Promise<{
  checked: number;
  sent: number;
  results: SendResult[];
}> {
  if (!supabase) throw new Error("Supabase non configurato");

  const now = new Date();

  // ── finestra 3 giorni ───────────────────────────────────────────────────────
  const w3_from = new Date(now.getTime() + 2.5 * 24 * 60 * 60 * 1000).toISOString();
  const w3_to   = new Date(now.getTime() + 3.5 * 24 * 60 * 60 * 1000).toISOString();

  // ── finestra 1 giorno ───────────────────────────────────────────────────────
  const w1_from = new Date(now.getTime() + 0.5 * 24 * 60 * 60 * 1000).toISOString();
  const w1_to   = new Date(now.getTime() + 1.5 * 24 * 60 * 60 * 1000).toISOString();

  // Recupera team con trial attivo in entrambe le finestre in un'unica query
  const { data: teams, error } = await supabase
    .from("teams")
    .select("id, trial_ends_at, trial_plan, trial_reminder_3d_sent, trial_reminder_1d_sent")
    .eq("subscription_status", "trialing")
    .not("trial_ends_at", "is", null)
    .or(
      `trial_ends_at.gte.${w3_from},trial_ends_at.lte.${w3_to},` +
      `trial_ends_at.gte.${w1_from},trial_ends_at.lte.${w1_to}`
    ) as { data: TrialTeam[] | null; error: unknown };

  if (error) throw error;
  if (!teams?.length) return { checked: 0, sent: 0, results: [] };

  const results: SendResult[] = [];

  for (const team of teams) {
    const endsAt   = new Date(team.trial_ends_at).getTime();
    const diffMs   = endsAt - now.getTime();
    const diffDays = diffMs / (24 * 60 * 60 * 1000);

    // ── 3-day reminder ────────────────────────────────────────────────────────
    if (diffDays >= 2.5 && diffDays < 3.5 && !team.trial_reminder_3d_sent) {
      const owner = await getOwnerInfo(team.id);

      if (owner.email) {
        await sendEmail({
          type:      "trial_expiring",
          to:        owner.email,
          firstName: owner.firstName,
          daysLeft:  3,
          planName:  team.trial_plan || "Premium Coach",
          upgradeUrl: "https://calciolab.org/premium",
        });

        // Marca come inviato
        await supabase
          .from("teams")
          .update({ trial_reminder_3d_sent: true })
          .eq("id", team.id);

        results.push({ teamId: team.id, type: "3d", email: owner.email, sent: true });
      } else {
        results.push({ teamId: team.id, type: "3d", sent: false, reason: "email non trovata" });
      }
    }

    // ── 1-day reminder ────────────────────────────────────────────────────────
    if (diffDays >= 0.5 && diffDays < 1.5 && !team.trial_reminder_1d_sent) {
      const owner = await getOwnerInfo(team.id);

      if (owner.email) {
        await sendEmail({
          type:      "trial_expiring",
          to:        owner.email,
          firstName: owner.firstName,
          daysLeft:  1,
          planName:  team.trial_plan || "Premium Coach",
          upgradeUrl: "https://calciolab.org/premium",
        });

        await supabase
          .from("teams")
          .update({ trial_reminder_1d_sent: true })
          .eq("id", team.id);

        results.push({ teamId: team.id, type: "1d", email: owner.email, sent: true });
      } else {
        results.push({ teamId: team.id, type: "1d", sent: false, reason: "email non trovata" });
      }
    }
  }

  const sent = results.filter((r) => r.sent).length;
  return { checked: teams.length, sent, results };
}

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const summary = await checkAndSendReminders();

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[check-trials] error:", message);

    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

/*
 * ─── SETUP CRON (Supabase Dashboard) ──────────────────────────────────────────
 *
 * 1. Abilita l'estensione pg_cron su Supabase:
 *    Dashboard → Database → Extensions → pg_cron → Enable
 *
 * 2. Nella SQL Editor incolla questo snippet (una sola volta):
 *
 *    select cron.schedule(
 *      'check-trials-daily',
 *      '0 8 * * *',           -- ogni giorno alle 08:00 UTC
 *      $$
 *      select net.http_post(
 *        url    := 'https://<PROJECT_REF>.supabase.co/functions/v1/check-trials',
 *        headers := '{"Content-Type":"application/json","x-internal-secret":"<CHECK_TRIALS_SECRET>"}'::jsonb,
 *        body   := '{}'::jsonb
 *      )
 *      $$
 *    );
 *
 * 3. Aggiungi il secret:
 *    Dashboard → Edge Functions → Secrets → CHECK_TRIALS_SECRET = <stringa-casuale>
 *
 * 4. Verifica che l'estensione pg_net sia attiva (necessaria per net.http_post):
 *    Dashboard → Database → Extensions → pg_net → Enable
 * ──────────────────────────────────────────────────────────────────────────────
 */
