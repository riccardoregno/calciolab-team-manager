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
import { requireAuth } from "../_shared/requireAuth.ts";

// Rate limit: max 15 email per utente ogni 10 minuti (protezione spam inviti)
const EMAIL_RL_MAX = 15;
const EMAIL_RL_WINDOW_MS = 10 * 60 * 1000; // 10 min

// Regex per validazione email minima (RFC 5321 semplificato)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const RESEND_API_KEY    = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL        = Deno.env.get("EMAIL_FROM") ?? "CalcioLab <noreply@calciolab.org>";
const INTERNAL_SECRET   = Deno.env.get("SEND_EMAIL_SECRET") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL           = Deno.env.get("APP_URL") ?? "https://calciolab.org";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AUTH_REQUIRED_TYPES = ["team_invite", "match_convocation", "player_invite"];

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

/* ─── HTML Templates ────────────────────────────────────────────── */
function baseLayout(content: string, previewText = "") {
  const safePreview = previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${previewText}</div>`
    : "";
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CalcioLab</title>
</head>
<body style="margin:0;background:#0b1118;font-family:Inter,Arial,sans-serif;color:#e5edf8;">
${safePreview}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b1118;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#111827;border:1px solid #223047;border-radius:18px;overflow:hidden;">
        <tr>
          <td style="padding:28px 28px 18px;border-bottom:1px solid #223047;">
            <div style="font-size:24px;font-weight:900;color:#ffffff;letter-spacing:.2px;">CalcioLab</div>
            <div style="margin-top:6px;font-size:13px;font-weight:700;color:#8fb4ff;">Coach Platform</div>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 28px;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 28px;background:#0f1724;border-top:1px solid #223047;font-size:12px;line-height:1.6;color:#73839a;">
            Questa email e' stata generata per proteggere l'accesso al tuo account CalcioLab.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body></html>`;
}

function btnPrimary(label: string, url: string) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0;">
    <tr>
      <td style="border-radius:12px;background:#3b82f6;">
        <a href="${url}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:900;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function h1(text: string) {
  return `<h1 style="margin:0 0 12px;font-size:24px;font-weight:900;color:#ffffff;line-height:1.25;">${text}</h1>`;
}

function p(text: string) {
  return `<p style="margin:0 0 18px;font-size:15px;color:#b7c4d8;line-height:1.7;">${text}</p>`;
}

function divider() {
  return `<div style="height:1px;background:#223047;margin:24px 0;"></div>`;
}

function fallbackUrl(url: string) {
  return `
    <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#94a3b8;">
      Se il pulsante non funziona, copia e incolla questo link nel browser:
    </p>
    <p style="margin:0;padding:12px;border-radius:10px;background:#0b1118;border:1px solid #26364f;font-size:12px;line-height:1.5;color:#9fb2cc;word-break:break-all;">${url}</p>
  `;
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
    ${p(`<strong style="color:#ffffff;">${inviterName}</strong> ti ha invitato a unirti alla squadra <strong style="color:#ffffff;">${teamName}</strong> come <strong style="color:#ffffff;">${roleName}</strong>.`)}
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
    ${p(`Ciao ${playerName}, sei stato invitato dallo staff di <strong style="color:#ffffff;">${teamName}</strong>. Attiva il tuo account per accedere alla tua area riservata.`)}
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
    opponent   ? `vs <strong style="color:white;">${opponent}</strong>` : null,
    matchDate  ? matchDate : null,
    matchTime  ? `ore ${matchTime}` : null,
    matchVenue ? matchVenue : null,
  ].filter(Boolean).join(" · ");

  const html = baseLayout(`
    ${h1(`Sei stato convocato! 📋`)}
    ${p(`Ciao ${playerName}, lo staff di <strong style="color:white;">${teamName}</strong> ti ha convocato per la prossima partita.`)}
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
    <p style="margin:0;font-size:12px;color:#475569;word-break:break-all;">${rsvpUrl}</p>
  `, `Sei stato convocato da ${teamName}${opponent ? ` per la sfida contro ${opponent}` : ""}`);
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
    ${p("Se pensi si tratti di un errore o hai bisogno di aiuto, contattaci a <a href=\"mailto:info@calciolab.org\">info@calciolab.org</a>.")}
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
  };
  try { body = await req.json(); }
  catch { return json({ error: "Body JSON non valido" }, 400); }

  const { type, to } = body;
  if (!to)   return json({ error: "to è obbligatorio" }, 400);
  if (!type) return json({ error: "type è obbligatorio" }, 400);

  // ── Validazione email destinatario ────────────────────────────────────────
  if (!EMAIL_RE.test(String(to))) {
    console.warn("[send-email] invalid recipient", { to });
    return json({ error: "Indirizzo email non valido" }, 400);
  }

  // ── Il tipo "custom" richiede service role o internal secret ──────────────
  // (un utente anonimo non può iniettare HTML arbitrario nel sistema email)
  if (type === "custom" && isAnon) {
    return json({ error: "Il tipo 'custom' richiede autenticazione server-side" }, 403);
  }

  // ── Limita i tipi permessi agli utenti anonimi ─────────────────────────────
  const ANON_ALLOWED_TYPES = ["welcome", "trial_expiring", "team_invite", "match_convocation", "player_invite"];
  if (isAnon && !ANON_ALLOWED_TYPES.includes(type)) {
    return json({ error: `Tipo '${type}' non permesso dalle chiamate frontend` }, 403);
  }

  if (AUTH_REQUIRED_TYPES.includes(type) && !isServiceRole && !isInternal) {
    const auth = await requireAuth(req);
    if (auth.error) return json({ error: auth.error }, auth.status!);
  }

  if ((type === "team_invite" || type === "player_invite") && !isAppUrl(body.inviteUrl)) {
    console.warn("[send-email] invalid invite url", {
      type,
      inviteUrl: body.inviteUrl,
      appUrl: APP_URL,
    });
    return json({ error: "URL non valido" }, 400);
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
