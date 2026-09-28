/**
 * send-email — Supabase Edge Function
 * Invia email transazionali via Resend API.
 *
 * Body:
 * {
 *   type: "welcome" | "subscription_activated" | "subscription_canceled" | "trial_expiring" | "payment_failed" | "custom",
 *   to: string,
 *   firstName?: string,
 *   planName?: string,        // "Premium Coach" | "Club"
 *   trialEndsAt?: string,     // ISO date
 *   daysLeft?: number,
 *   manageUrl?: string,       // URL portale Stripe
 *   subject?: string,         // override subject (type="custom")
 *   html?: string,            // override body HTML (type="custom")
 * }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitedResponse } from "../_shared/rateLimit.ts";
import { requireAuth } from "../_shared/requireAuth.ts";

// Rate limit: max 15 email per utente ogni 10 minuti (protezione spam inviti)
const EMAIL_RL_MAX = 15;
const EMAIL_RL_WINDOW_MS = 10 * 60 * 1000; // 10 min

// Regex per validazione email minima (RFC 5321 semplificato)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const RESEND_API_KEY    = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL        = Deno.env.get("EMAIL_FROM") ?? "CalcioLab <noreply@calciolab.org>";
const INTERNAL_SECRET   = Deno.env.get("SEND_EMAIL_SECRET") ?? "";
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL           = Deno.env.get("APP_URL") ?? "https://calciolab.org";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FRONTEND_ALLOWED_TYPES = ["welcome", "team_invite", "player_invite"];
const INVITE_ALLOWED_ROLES = ["owner", "headCoach", "director"];
const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietario",
  headCoach: "Allenatore",
  assistantCoach: "Allenatore in seconda",
  athleticTrainer: "Preparatore atletico",
  director: "Dirigente",
  player: "Giocatore",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function isAppUrl(value?: string) {
  if (!value) return true;
  try {
    const expected = new URL(APP_URL);
    const actual = new URL(value);
    const allowedOrigins = new Set([expected.origin]);

    if (expected.hostname === "calciolab.org") {
      allowedOrigins.add(`${expected.protocol}//www.calciolab.org`);
    }

    if (expected.hostname === "www.calciolab.org") {
      allowedOrigins.add(`${expected.protocol}//calciolab.org`);
    }

    const isLocalDev = actual.hostname === "localhost" || actual.hostname === "127.0.0.1";
    return allowedOrigins.has(actual.origin) || isLocalDev;
  } catch {
    return false;
  }
}

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeSubject(value: unknown) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 180);
}

function appUrl(path = "/") {
  return new URL(path, APP_URL).toString();
}

/* ─── HTML Templates ────────────────────────────────────────────── */
function baseLayout(content: string, previewText = "") {
  const safePreview = previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(previewText)}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="it" style="background-color:#0f1115;">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CalcioLab</title>
</head>
<body bgcolor="#0f1115" style="margin:0;padding:0;background-color:#0f1115;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
${safePreview}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0f1115" style="background-color:#0f1115;">
  <tr><td align="center" bgcolor="#0f1115" style="padding:48px 16px;background-color:#0f1115;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;">
      <tr><td align="center" style="padding-bottom:40px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
          <td align="center" style="background:linear-gradient(135deg,#0ea5e9,#38bdf8);border-radius:16px;width:56px;height:56px;">
            <span style="display:block;color:#fff;font-size:22px;font-weight:800;line-height:56px;text-align:center;width:56px;">CL</span>
          </td>
          <td style="padding-left:14px;">
            <span style="display:block;color:#fff;font-size:24px;font-weight:700;">CalcioLab</span>
            <span style="display:block;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Team Manager</span>
          </td>
        </tr></table>
      </td></tr>
      <tr><td bgcolor="#161a21" style="background-color:#161a21;border-radius:20px;border:1px solid #1e2530;overflow:hidden;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr><td style="height:4px;background:linear-gradient(90deg,#0ea5e9,#38bdf8,#7dd3fc);border-radius:20px 20px 0 0;"></td></tr>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr><td style="padding:48px;">
            ${content}
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:36px 24px 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr><td style="height:1px;background:#1e2530;padding-bottom:24px;"></td></tr>
          <tr><td align="center" style="padding-top:24px;padding-bottom:12px;">
            <p style="margin:0;font-size:12px;color:#334155;text-align:center;">CalcioLab</p>
          </td></tr>
          <tr><td align="center">
            <p style="margin:0;font-size:12px;text-align:center;">
              <a href="${APP_URL}/privacy" style="color:#38bdf8;text-decoration:none;">Privacy Policy</a>
              <span style="color:#334155;padding:0 8px;">·</span>
              <a href="${APP_URL}/terms" style="color:#38bdf8;text-decoration:none;">Termini di Servizio</a>
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function btnPrimary(label: string, url: string) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:32px;">
    <tr><td style="border-radius:12px;background:linear-gradient(135deg,#0ea5e9,#38bdf8);box-shadow:0 4px 24px rgba(56,189,248,0.35);">
      <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:16px 40px;font-size:16px;font-weight:700;color:#fff;text-decoration:none;border-radius:12px;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}

function h1(text: string) {
  return `<h1 style="margin:0 0 16px;font-size:28px;font-weight:700;color:#fff;line-height:1.25;">${escapeHtml(text)}</h1>`;
}

function p(text: string) {
  return `<p style="margin:0 0 12px;font-size:16px;color:#94a3b8;line-height:1.65;">${text}</p>`;
}

function divider() {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;">
    <tr><td style="height:1px;background:#1e2530;"></td></tr>
  </table>`;
}

function fallbackUrl(url: string) {
  return `
    ${divider()}
    <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Se il pulsante non funziona, copia questo link nel browser:</p>
    <p style="margin:0;font-size:13px;word-break:break-all;"><a href="${escapeHtml(url)}" style="color:#38bdf8;">${escapeHtml(url)}</a></p>
  `;
}

function infoBox(text: string) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr><td style="padding:0 48px 48px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr><td style="background:#0c1520;border:1px solid #1e2d3d;border-radius:12px;padding:20px 24px;">
          <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">${escapeHtml(text)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>`;
}

/* ── Template: Welcome ───────────────────────────── */
function templateWelcome(firstName = "Coach") {
  const subject = "Benvenuto in CalcioLab 🎉";
  const html = baseLayout(`
    ${h1(`Ciao ${firstName}, benvenuto in CalcioLab! ⚡`)}
    ${p("Il tuo account è stato creato con successo. Sei pronto a gestire la tua squadra come uno staff professionista.")}
    ${p("Con CalcioLab hai accesso a:")}
    <ul style="margin:0 0 16px;padding-left:20px;color:#94a3b8;font-size:14px;line-height:2;">
      <li>Rosa completa con disponibilità e schede giocatore</li>
      <li>Pianificazione allenamenti e gestione presenze</li>
      <li>Calendario stagionale e match day</li>
      <li>Dashboard statistiche e obiettivi stagione</li>
    </ul>
    ${btnPrimary("Accedi a CalcioLab →", APP_URL)}
    ${divider()}
    ${p(`Hai domande? Scrivici a <a href="mailto:info@calciolab.org">info@calciolab.org</a>`)}
  `, `Benvenuto ${firstName}! Il tuo account CalcioLab è pronto.`);
  return { subject, html };
}

/* ── Template: Subscription activated ───────────── */
function templateSubscriptionActivated(firstName = "Coach", planName = "Premium Coach", manageUrl = "") {
  const subject = `Piano ${planName} attivato ✅`;
  const html = baseLayout(`
    ${h1(`Piano ${planName} attivato! 🚀`)}
    ${p(`Ciao ${escapeHtml(firstName)}, il tuo abbonamento <strong style="color:white;">${escapeHtml(planName)}</strong> è ora attivo.`)}
    ${p("Hai sbloccato tutte le funzionalità avanzate:")}
    <ul style="margin:0 0 16px;padding-left:20px;color:#94a3b8;font-size:14px;line-height:2;">
      ${planName.includes("Club")
        ? "<li>Staff multi-utente illimitato</li><li>Area giocatori e portale sponsor</li><li>AI Session Builder</li>"
        : "<li>Match Day avanzato e report post gara</li><li>Test fisici e scouting avversari</li><li>Export PDF professionali</li>"}
      <li>Statistiche avanzate</li>
    </ul>
    ${btnPrimary("Vai alla dashboard →", APP_URL)}
    ${manageUrl ? `${divider()}${p(`Gestisci abbonamento, fatture e metodo di pagamento dal <a href="${escapeHtml(manageUrl)}">portale di fatturazione</a>.`)}` : ""}
  `, `Il piano ${planName} è attivo — inizia subito!`);
  return { subject, html };
}

/* ── Template: Trial expiring ────────────────────── */
function templateTrialExpiring(
  firstName = "Coach",
  planName  = "Premium Coach",
  daysLeft  = 3,
  upgradeUrl = `${APP_URL}/premium`,
) {
  const subject = `Il tuo trial ${planName} scade tra ${daysLeft} ${daysLeft === 1 ? "giorno" : "giorni"}`;
  const urgencyColor = daysLeft <= 1 ? "#ef4444" : "#f59e0b";
  const html = baseLayout(`
    ${h1(`Il tuo trial scade tra <span style="color:${urgencyColor}">${daysLeft} ${daysLeft === 1 ? "giorno" : "giorni"}</span> ⏰`)}
    ${p(`Ciao ${escapeHtml(firstName)}, il tuo periodo di prova gratuito del piano <strong style="color:white;">${escapeHtml(planName)}</strong> sta per terminare.`)}
    ${p("Per continuare ad usare tutte le funzionalità avanzate, attiva il tuo abbonamento. Non perdere i dati già inseriti.")}
    ${btnPrimary("Attiva abbonamento →", upgradeUrl)}
    ${divider()}
    ${p("Se non attivi il piano, il tuo account tornerà automaticamente al piano Starter gratuito. I tuoi dati non andranno persi.")}
  `, `Il tuo trial scade tra ${daysLeft} giorni`);
  return { subject, html };
}

/* ── Template: Subscription canceled ────────────── */
function templateSubscriptionCanceled(firstName = "Coach", planName = "Premium Coach") {
  const subject = `Il tuo piano ${planName} è stato cancellato`;
  const html = baseLayout(`
    ${h1("Abbonamento cancellato 📋")}
    ${p(`Ciao ${escapeHtml(firstName)}, il tuo piano <strong style="color:white;">${escapeHtml(planName)}</strong> è stato cancellato.`)}
    ${p("Il tuo account è tornato al piano Starter gratuito. I tuoi dati (rosa, allenamenti, partite) sono stati conservati e rimangono accessibili.")}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        <td style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px;">
          <p style="margin:0 0 8px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;">Piano Starter — Sempre gratuito</p>
          <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.7;">
            ✓ Rosa completa e disponibilità<br>
            ✓ Calendario stagionale<br>
            ✓ Sedute base e libreria esercizi<br>
            ✓ Lavagna tattica interattiva
          </p>
        </td>
      </tr>
    </table>
    ${p("Se hai cambiato idea, puoi riattivare un piano Premium o Club in qualsiasi momento.")}
    ${btnPrimary("Riattiva abbonamento →", `${APP_URL}/premium`)}
    ${divider()}
    ${p("Hai avuto problemi o hai una domanda? Scrivici a <a href=\"mailto:info@calciolab.org\">info@calciolab.org</a>.")}
  `, `Il piano ${planName} è stato cancellato — il piano Starter è attivo`);
  return { subject, html };
}

/* ── Template: Team invite ───────────────────────── */
function templateTeamInvite(
  inviterName = "Il tuo coach",
  teamName    = "CalcioLab",
  roleName    = "Membro dello staff",
  inviteUrl   = APP_URL,
) {
  const subject = `${inviterName} ti invita in ${teamName} su CalcioLab`;
  const html = baseLayout(`
    ${h1(`Invito staff per ${teamName}`)}
    ${p(`<strong style="color:#ffffff;">${escapeHtml(inviterName)}</strong> ti ha invitato a unirti allo staff di <strong style="color:#ffffff;">${escapeHtml(teamName)}</strong> su CalcioLab come <strong style="color:#ffffff;">${escapeHtml(roleName)}</strong>.`)}
    ${btnPrimary("Accetta invito", inviteUrl)}
    ${fallbackUrl(inviteUrl)}
  `, `${inviterName} ti invita in ${teamName} — accetta l'invito`);
  return { subject, html };
}

/* ── Template: Player portal invite ──────────────── */
function templatePlayerInvite(
  playerName = "Giocatore",
  teamName   = "CalcioLab",
  inviteUrl  = APP_URL,
) {
  const subject = `Attiva il tuo accesso al portale giocatore di ${teamName}`;
  const html = baseLayout(`
    ${h1("Attiva il tuo portale giocatore")}
    ${p(`Ciao ${escapeHtml(playerName)}, <strong style="color:#ffffff;">${escapeHtml(teamName)}</strong> ti ha invitato ad accedere al portale giocatore su CalcioLab. Da qui potrai consultare convocazioni, disponibilita' e comunicazioni dello staff.`)}
    ${btnPrimary("Attiva accesso", inviteUrl)}
    ${fallbackUrl(inviteUrl)}
  `, `${teamName} ti invita ad attivare il portale giocatore`);
  return { subject, html };
}

/* ── Template: Match convocation ─────────────────── */
function templateMatchConvocation(
  playerName  = "Giocatore",
  teamName    = "CalcioLab",
  opponent    = "",
  matchDate   = "",
  matchTime   = "",
  matchVenue  = "",
  rsvpUrl     = APP_URL,
) {
  const subject = opponent
    ? `Convocazione: ${teamName} vs ${opponent}`
    : `Convocazione ${teamName}`;
  const matchInfoLines = [
    opponent   ? `vs <strong style="color:white;">${escapeHtml(opponent)}</strong>` : null,
    matchDate  ? escapeHtml(matchDate) : null,
    matchTime  ? `ore ${escapeHtml(matchTime)}` : null,
    matchVenue ? escapeHtml(matchVenue) : null,
  ].filter(Boolean).join(" · ");

  const html = baseLayout(`
    ${h1(`Sei stato convocato! 📋`)}
    ${p(`Ciao ${escapeHtml(playerName)}, lo staff di <strong style="color:white;">${escapeHtml(teamName)}</strong> ti ha convocato per la prossima partita.`)}
    ${matchInfoLines ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        <td style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px;">
          <p style="margin:0;font-size:14px;color:#e2e8f0;line-height:1.7;">${matchInfoLines}</p>
        </td>
      </tr>
    </table>` : ""}
    ${p("Conferma la tua presenza cliccando il pulsante qui sotto.")}
    ${btnPrimary("Conferma disponibilità →", rsvpUrl)}
    ${divider()}
    ${p("Se non riesci a cliccare il bottone, copia e incolla questo link nel browser:")}
    <p style="margin:0;font-size:12px;color:#475569;word-break:break-all;">${escapeHtml(rsvpUrl)}</p>
  `, `Sei stato convocato da ${teamName}${opponent ? ` per la sfida contro ${opponent}` : ""}`);
  return { subject, html };
}

/* ── Template: Payment failed ────────────────────── */
function templatePaymentFailed(firstName = "Coach", manageUrl = `${APP_URL}/premium`) {
  const subject = "⚠️ Problema con il tuo pagamento CalcioLab";
  const html = baseLayout(`
    ${h1("Problema con il pagamento ⚠️")}
    ${p(`Ciao ${escapeHtml(firstName)}, non siamo riusciti a elaborare il tuo pagamento. Il tuo accesso potrebbe essere limitato a breve.`)}
    ${p("Aggiorna il tuo metodo di pagamento per evitare interruzioni del servizio.")}
    ${btnPrimary("Aggiorna metodo di pagamento →", manageUrl)}
    ${divider()}
    ${p("Se pensi si tratti di un errore o hai bisogno di aiuto, contattaci a <a href=\"mailto:info@calciolab.org\">info@calciolab.org</a>.")}
  `, "Controlla il tuo metodo di pagamento");
  return { subject, html };
}

type InviteContext = {
  to: string;
  inviterName: string;
  teamName: string;
  roleName: string;
  playerName: string;
  inviteUrl: string;
};

async function resolveInviteContext(
  body: { type: string; teamId?: string; inviteId?: string; to?: string },
  userId: string,
): Promise<{ context?: InviteContext; error?: string; status?: number }> {
  const teamId = String(body.teamId || "").trim();
  const inviteId = String(body.inviteId || "").trim();
  if (!teamId || !inviteId) return { error: "teamId e inviteId sono obbligatori", status: 400 };
  if (!SUPABASE_SERVICE_ROLE_KEY) return { error: "Supabase non configurato", status: 500 };

  if (!SUPABASE_URL) return { error: "Supabase non configurato", status: 500 };
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: team, error: teamError } = await serviceClient
    .from("teams")
    .select("name, settings")
    .eq("id", teamId)
    .maybeSingle();
  if (teamError) return { error: "Errore lettura invito", status: 500 };
  if (!team) return { error: "Team non trovato", status: 404 };

  const settings = (team.settings || {}) as Record<string, unknown>;
  const pendingInvites = Array.isArray(settings.pendingInvites)
    ? settings.pendingInvites as Array<Record<string, unknown>>
    : [];
  const invite = pendingInvites.find((item) => String(item.id || "") === inviteId);
  if (!invite) return { error: "Invito non trovato o non ancora sincronizzato", status: 404 };

  const to = String(invite.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(to) || to !== String(body.to || "").trim().toLowerCase()) {
    return { error: "Destinatario invito non valido", status: 400 };
  }

  const workspace = (settings.workspaceProfile || {}) as Record<string, unknown>;
  const teamName = String(team.name || workspace.clubName || workspace.teamName || "CalcioLab").trim();
  const token = body.type === "team_invite"
    ? String(settings.inviteToken || "").trim()
    : String(invite.token || "").trim();
  if (!token) return { error: "Token invito non disponibile", status: 409 };
  const expiresAt = body.type === "team_invite"
    ? String(settings.inviteTokenExpiresAt || invite.expiresAt || "")
    : String(invite.expiresAt || "");
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    return { error: "Invito scaduto", status: 410 };
  }

  const { data: userData } = await serviceClient.auth.admin.getUserById(userId);
  const metadata = userData?.user?.user_metadata || {};
  const inviterName = String(
    metadata.first_name || metadata.full_name || userData?.user?.email || "Il tuo coach",
  ).trim();

  return {
    context: {
      to,
      inviterName,
      teamName,
      roleName: ROLE_LABELS[String(invite.role || "")] || "Membro dello staff",
      playerName: String(invite.name || "Giocatore").trim(),
      inviteUrl: appUrl(`/join?token=${encodeURIComponent(token)}`),
    },
  };
}

/* ─── Main handler ────────────────────────────────────────────────── */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  // Auth: service role oppure internal secret
  const authHeader    = req.headers.get("authorization") ?? "";
  const internalSec   = req.headers.get("x-internal-secret") ?? "";
  const isServiceRole = SUPABASE_SERVICE_ROLE_KEY && authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  const isInternal    = INTERNAL_SECRET && internalSec === INTERNAL_SECRET;
  const isFrontend    = !isServiceRole && !isInternal && authHeader.startsWith("Bearer ");

  if (!isServiceRole && !isInternal && !isFrontend) {
    return json({ error: "Non autorizzato" }, 401);
  }

  // ── Rate limiting per chiamate frontend (non service role / internal) ──────
  if (isFrontend) {
    // Estrae un identificatore dall'IP + token (opaco, non reversibile)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip")
      || "unknown";
    // Usa solo i primi 20 char del token per chiave (privacy)
    const tokenHint = authHeader.slice(7, 27);
    const rlKey = `send-email:${ip}:${tokenHint}`;

    if (!checkRateLimit(rlKey, EMAIL_RL_MAX, EMAIL_RL_WINDOW_MS)) {
      return rateLimitedResponse(rlKey, CORS);
    }
  }

  if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY non configurata" }, 500);

  let body: {
    type: string;
    to: string;
    firstName?: string;
    planName?: string;
    canceledPlanName?: string;
    trialEndsAt?: string;
    daysLeft?: number;
    upgradeUrl?: string;
    manageUrl?: string;
    subject?: string;
    html?: string;
    // team_invite
    inviterName?: string;
    teamName?: string;
    roleName?: string;
    inviteUrl?: string;
    // player_invite
    playerName?: string;
    opponent?: string;
    matchDate?: string;
    matchTime?: string;
    matchVenue?: string;
    rsvpUrl?: string;
    teamId?: string;
    inviteId?: string;
  };
  try { body = await req.json(); }
  catch { return json({ error: "Body JSON non valido" }, 400); }

  let { type, to } = body;
  if (!to)   return json({ error: "to è obbligatorio" }, 400);
  if (!type) return json({ error: "type è obbligatorio" }, 400);

  // ── Validazione email destinatario ────────────────────────────────────────
  if (!EMAIL_RE.test(String(to))) {
    console.warn("[send-email] invalid recipient", { to });
    return json({ error: "Indirizzo email non valido" }, 400);
  }

  // ── Il tipo "custom" richiede service role o internal secret ──────────────
  // (un utente anonimo non può iniettare HTML arbitrario nel sistema email)
  if (type === "custom" && isFrontend) {
    return json({ error: "Il tipo 'custom' richiede autenticazione server-side" }, 403);
  }

  // ── Limita i tipi permessi agli utenti anonimi ─────────────────────────────
  if (isFrontend && !FRONTEND_ALLOWED_TYPES.includes(type)) {
    return json({ error: `Tipo '${type}' non permesso dalle chiamate frontend` }, 403);
  }

  let authenticatedUser: { id: string; email?: string } | null = null;
  if (isFrontend) {
    const teamId = type === "team_invite" || type === "player_invite" ? String(body.teamId || "") : "";
    const allowedRoles = teamId ? INVITE_ALLOWED_ROLES : undefined;
    const auth = await requireAuth(req, teamId, allowedRoles);
    if (auth.error) return json({ error: auth.error }, auth.status!);
    authenticatedUser = auth.user;
  }

  if (type === "welcome" && authenticatedUser?.email?.toLowerCase() !== String(to).trim().toLowerCase()) {
    return json({ error: "Puoi inviare l'email di benvenuto solo al tuo account" }, 403);
  }

  if (type === "team_invite" || type === "player_invite") {
    const resolved = await resolveInviteContext(body, authenticatedUser!.id);
    if (resolved.error) return json({ error: resolved.error }, resolved.status || 400);
    const context = resolved.context!;
    to = context.to;
    body.to = context.to;
    body.inviterName = context.inviterName;
    body.teamName = context.teamName;
    body.roleName = context.roleName;
    body.playerName = context.playerName;
    body.inviteUrl = context.inviteUrl;
  }

  if (type === "match_convocation" && !isAppUrl(body.rsvpUrl)) {
    console.warn("[send-email] invalid rsvp url", {
      type,
      rsvpUrl: body.rsvpUrl,
      appUrl: APP_URL,
    });
    return json({ error: "URL non valido" }, 400);
  }

  let subject: string;
  let html: string;

  switch (type) {
    case "welcome":
      ({ subject, html } = templateWelcome(body.firstName));
      break;
    case "subscription_activated":
      ({ subject, html } = templateSubscriptionActivated(body.firstName, body.planName, body.manageUrl));
      break;
    case "trial_expiring":
      ({ subject, html } = templateTrialExpiring(body.firstName, body.planName, body.daysLeft ?? 3, body.upgradeUrl));
      break;
    case "subscription_canceled":
      ({ subject, html } = templateSubscriptionCanceled(body.firstName, body.canceledPlanName || body.planName));
      break;
    case "team_invite":
      ({ subject, html } = templateTeamInvite(body.inviterName, body.teamName, body.roleName, body.inviteUrl));
      break;
    case "player_invite":
      ({ subject, html } = templatePlayerInvite(body.playerName, body.teamName, body.inviteUrl));
      break;
    case "match_convocation":
      if (isFrontend) return json({ error: "Usa la funzione dedicata alle convocazioni" }, 403);
      ({ subject, html } = templateMatchConvocation(
        body.playerName, body.teamName, body.opponent,
        body.matchDate, body.matchTime, body.matchVenue, body.rsvpUrl,
      ));
      break;
    case "payment_failed":
      ({ subject, html } = templatePaymentFailed(body.firstName, body.manageUrl));
      break;
    case "custom":
      if (!body.subject || !body.html) return json({ error: "subject e html obbligatori per type=custom" }, 400);
      subject = body.subject;
      html    = body.html;
      break;
    default:
      return json({ error: `Tipo email sconosciuto: ${type}` }, 400);
  }

  subject = safeSubject(subject);

  // Invia via Resend
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: String(to).trim().toLowerCase(), subject, html }),
  });

  const result = await res.json();

  if (!res.ok) {
    if (Deno.env.get("DENO_ENV") === "development") {
      console.error("[send-email] Resend error:", result);
    }
    return json({ error: result?.message || "Errore Resend" }, 502);
  }

  return json({ sent: true, id: result.id });
});
