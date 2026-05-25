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
import { checkRateLimit, rateLimitedResponse } from "../_shared/rateLimit.ts";

// Rate limit: max 15 email per utente ogni 10 minuti (protezione spam inviti)
const EMAIL_RL_MAX = 15;
const EMAIL_RL_WINDOW_MS = 10 * 60 * 1000; // 10 min

// Regex per validazione email minima (RFC 5321 semplificato)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const RESEND_API_KEY    = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL        = Deno.env.get("EMAIL_FROM") ?? "CalcioLab <noreply@calciolab.it>";
const INTERNAL_SECRET   = Deno.env.get("SEND_EMAIL_SECRET") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL           = "https://calciolab.it";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/* ─── HTML Templates ────────────────────────────────────────────── */
function baseLayout(content: string, previewText = "") {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CalcioLab</title>
${previewText ? `<span style="display:none;max-height:0;overflow:hidden;">${previewText}</span>` : ""}
<style>
  body { margin:0; padding:0; background:#080b12; font-family:Inter,Arial,sans-serif; color:#e2e8f0; }
  a { color:#60a5fa; text-decoration:none; }
</style>
</head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#080b12; padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <!-- Header -->
      <tr><td style="padding:0 0 32px;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:36px;height:36px;background:linear-gradient(135deg,#2563eb,#7c3aed);border-radius:9px;text-align:center;vertical-align:middle;">
              <span style="font-size:18px;line-height:36px;">⚡</span>
            </td>
            <td style="padding-left:10px;font-size:18px;font-weight:900;color:white;">CalcioLab</td>
          </tr>
        </table>
      </td></tr>

      <!-- Content -->
      <tr><td style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:36px 40px;">
        ${content}
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:28px 0 0;text-align:center;">
        <p style="margin:0 0 8px;font-size:12px;color:#334155;">
          © ${new Date().getFullYear()} CalcioLab — La piattaforma per allenatori di calcio
        </p>
        <p style="margin:0;font-size:12px;">
          <a href="${APP_URL}/terms" style="color:#475569;">Termini</a>
          &nbsp;·&nbsp;
          <a href="${APP_URL}/privacy" style="color:#475569;">Privacy</a>
          &nbsp;·&nbsp;
          <a href="${APP_URL}" style="color:#475569;">calciolab.it</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function btnPrimary(label: string, url: string) {
  return `<a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;font-size:15px;font-weight:800;padding:14px 32px;border-radius:12px;text-decoration:none;margin-top:24px;">${label}</a>`;
}

function h1(text: string) {
  return `<h1 style="margin:0 0 16px;font-size:26px;font-weight:900;color:white;line-height:1.2;">${text}</h1>`;
}

function p(text: string) {
  return `<p style="margin:0 0 14px;font-size:15px;color:#94a3b8;line-height:1.7;">${text}</p>`;
}

function divider() {
  return `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:24px 0;">`;
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
    ${p(`Hai domande? Scrivici a <a href="mailto:info@calciolab.it">info@calciolab.it</a>`)}
  `, `Benvenuto ${firstName}! Il tuo account CalcioLab è pronto.`);
  return { subject, html };
}

/* ── Template: Subscription activated ───────────── */
function templateSubscriptionActivated(firstName = "Coach", planName = "Premium Coach", manageUrl = "") {
  const subject = `Piano ${planName} attivato ✅`;
  const html = baseLayout(`
    ${h1(`Piano ${planName} attivato! 🚀`)}
    ${p(`Ciao ${firstName}, il tuo abbonamento <strong style="color:white;">${planName}</strong> è ora attivo.`)}
    ${p("Hai sbloccato tutte le funzionalità avanzate:")}
    <ul style="margin:0 0 16px;padding-left:20px;color:#94a3b8;font-size:14px;line-height:2;">
      ${planName.includes("Club")
        ? "<li>Staff multi-utente illimitato</li><li>Area giocatori e portale sponsor</li><li>AI Session Builder</li>"
        : "<li>Match Day avanzato e report post gara</li><li>Test fisici e scouting avversari</li><li>Export PDF professionali</li>"}
      <li>Statistiche avanzate</li>
    </ul>
    ${btnPrimary("Vai alla dashboard →", APP_URL)}
    ${manageUrl ? `${divider()}${p(`Gestisci abbonamento, fatture e metodo di pagamento dal <a href="${manageUrl}">portale di fatturazione</a>.`)}` : ""}
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
    ${p(`Ciao ${firstName}, il tuo periodo di prova gratuito del piano <strong style="color:white;">${planName}</strong> sta per terminare.`)}
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
    ${p(`Ciao ${firstName}, il tuo piano <strong style="color:white;">${planName}</strong> è stato cancellato.`)}
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
    ${p("Hai avuto problemi o hai una domanda? Scrivici a <a href=\"mailto:info@calciolab.it\">info@calciolab.it</a>.")}
  `, `Il piano ${planName} è stato cancellato — il piano Starter è attivo`);
  return { subject, html };
}

/* ── Template: Payment failed ────────────────────── */
function templatePaymentFailed(firstName = "Coach", manageUrl = `${APP_URL}/premium`) {
  const subject = "⚠️ Problema con il tuo pagamento CalcioLab";
  const html = baseLayout(`
    ${h1("Problema con il pagamento ⚠️")}
    ${p(`Ciao ${firstName}, non siamo riusciti a elaborare il tuo pagamento. Il tuo accesso potrebbe essere limitato a breve.`)}
    ${p("Aggiorna il tuo metodo di pagamento per evitare interruzioni del servizio.")}
    ${btnPrimary("Aggiorna metodo di pagamento →", manageUrl)}
    ${divider()}
    ${p("Se pensi si tratti di un errore o hai bisogno di aiuto, contattaci a <a href=\"mailto:info@calciolab.it\">info@calciolab.it</a>.")}
  `, "Controlla il tuo metodo di pagamento");
  return { subject, html };
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
  // JWT generico (utente autenticato dal frontend) — solo per tipi non-critical
  const isAnon        = !isServiceRole && !isInternal && authHeader.startsWith("Bearer ");

  if (!isServiceRole && !isInternal && !isAnon) {
    return json({ error: "Non autorizzato" }, 401);
  }

  // ── Rate limiting per chiamate frontend (non service role / internal) ──────
  if (isAnon) {
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
  };
  try { body = await req.json(); }
  catch { return json({ error: "Body JSON non valido" }, 400); }

  const { type, to } = body;
  if (!to)   return json({ error: "to è obbligatorio" }, 400);
  if (!type) return json({ error: "type è obbligatorio" }, 400);

  // ── Validazione email destinatario ────────────────────────────────────────
  if (!EMAIL_RE.test(String(to))) {
    return json({ error: "Indirizzo email non valido" }, 400);
  }

  // ── Il tipo "custom" richiede service role o internal secret ──────────────
  // (un utente anonimo non può iniettare HTML arbitrario nel sistema email)
  if (type === "custom" && isAnon) {
    return json({ error: "Il tipo 'custom' richiede autenticazione server-side" }, 403);
  }

  // ── Limita i tipi permessi agli utenti anonimi ─────────────────────────────
  const ANON_ALLOWED_TYPES = ["welcome", "trial_expiring"];
  if (isAnon && !ANON_ALLOWED_TYPES.includes(type)) {
    return json({ error: `Tipo '${type}' non permesso dalle chiamate frontend` }, 403);
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

  // Invia via Resend
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });

  const result = await res.json();

  if (!res.ok) {
    if (import.meta.env?.DEV || Deno.env.get("DENO_ENV") === "development") {
      console.error("[send-email] Resend error:", result);
    }
    return json({ error: result?.message || "Errore Resend" }, 502);
  }

  return json({ sent: true, id: result.id });
});
