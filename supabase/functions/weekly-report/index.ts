import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WEEKLY_REPORT_SECRET = Deno.env.get("WEEKLY_REPORT_SECRET") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://calciolab.org";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonRow = { id: string; team_id: string; data?: Record<string, unknown> };
type RecipientRow = {
  team_id: string;
  role: string;
  profiles?: { email?: string; first_name?: string } | null;
  teams?: { name?: string } | null;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function isAuthorized(req: Request) {
  if (WEEKLY_REPORT_SECRET && req.headers.get("x-internal-secret") === WEEKLY_REPORT_SECRET) return true;
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  return Boolean(SUPABASE_SERVICE_ROLE_KEY && bearer === SUPABASE_SERVICE_ROLE_KEY);
}

function lastWeekRange() {
  const now = new Date();
  const day = now.getUTCDay() || 7;
  const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  thisMonday.setUTCDate(thisMonday.getUTCDate() - day + 1);
  const start = new Date(thisMonday);
  start.setUTCDate(start.getUTCDate() - 7);
  const end = new Date(thisMonday);
  return { start, end, startIso: start.toISOString().slice(0, 10), endIso: end.toISOString().slice(0, 10) };
}

function rowDate(row: JsonRow) {
  const raw = row.data?.date || row.data?.startDate || row.data?.dateStart || row.data?.createdAt;
  if (!raw) return null;
  const date = new Date(String(raw));
  return Number.isNaN(date.getTime()) ? null : date;
}

function inRange(row: JsonRow, start: Date, end: Date) {
  const date = rowDate(row);
  return Boolean(date && date >= start && date < end);
}

function attendanceValues(row: JsonRow) {
  const attendance = row.data?.attendance;
  if (!attendance || typeof attendance !== "object") return [];
  return Object.values(attendance as Record<string, Record<string, unknown>>);
}

function sessionLoad(row: JsonRow) {
  const fallbackDuration = Number(row.data?.duration || 0);
  return attendanceValues(row).reduce((sum, item) => {
    const rpe = Number(item?.rpe || 0);
    const duration = Number(item?.minutes || fallbackDuration || 0);
    return sum + rpe * duration;
  }, 0);
}

function activeInjuryCount(players: JsonRow[]) {
  return players.reduce((sum, player) => {
    const injuries = Array.isArray(player.data?.injuries) ? player.data.injuries as Record<string, unknown>[] : [];
    const active = injuries.filter((injury) => !injury.endDate && !injury.dateEndActual).length;
    return sum + active;
  }, 0);
}

function newInjuryCount(players: JsonRow[], start: Date, end: Date) {
  return players.reduce((sum, player) => {
    const injuries = Array.isArray(player.data?.injuries) ? player.data.injuries as Record<string, unknown>[] : [];
    return sum + injuries.filter((injury) => {
      const raw = injury.startDate || injury.dateStart || injury.date;
      if (!raw) return false;
      const date = new Date(String(raw));
      return !Number.isNaN(date.getTime()) && date >= start && date < end;
    }).length;
  }, 0);
}

async function sendEmail(payload: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(String(error?.error || "Invio report non riuscito"));
  }
}

function htmlReport(teamName: string, rangeLabel: string, summary: Record<string, unknown>) {
  return `
    <h1 style="margin:0 0 16px;font-size:24px;color:white;">Report settimanale ${teamName}</h1>
    <p style="color:#94a3b8;line-height:1.7;">Riepilogo operativo della settimana ${rangeLabel}.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-collapse:separate;border-spacing:0 8px;">
      ${[
        ["Sedute svolte", summary.sessions],
        ["Carico totale RPE×durata", summary.load],
        ["Presenze allenamento", summary.presences],
        ["Partite giocate", summary.matches],
        ["Test fisici registrati", summary.physicalTests],
        ["Infortuni attivi", summary.activeInjuries],
        ["Nuovi infortuni", summary.newInjuries],
      ].map(([label, value]) => `
        <tr>
          <td style="padding:12px 14px;background:rgba(255,255,255,0.04);border-radius:10px 0 0 10px;color:#94a3b8;">${label}</td>
          <td style="padding:12px 14px;background:rgba(255,255,255,0.04);border-radius:0 10px 10px 0;color:white;font-weight:900;text-align:right;">${value}</td>
        </tr>
      `).join("")}
    </table>
    ${summary.matchList ? `<p style="color:#e2e8f0;line-height:1.7;"><strong>Partite:</strong><br>${summary.matchList}</p>` : ""}
    <p><a href="${APP_URL}" style="display:inline-block;background:#2563eb;color:white;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:800;">Apri CalcioLab</a></p>
  `;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Metodo non consentito" }, 405);
  if (!isAuthorized(req)) return json({ error: "Unauthorized" }, 401);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: "Supabase non configurato" }, 500);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { start, end, startIso, endIso } = lastWeekRange();

  try {
    const { data: members, error: membersError } = await supabase
      .from("team_members")
      .select("team_id, role, profiles:profiles(email, first_name), teams:teams(name)")
      .in("role", ["director", "owner"]);
    if (membersError) throw membersError;

    const grouped = new Map<string, RecipientRow[]>();
    (members as RecipientRow[] | null || []).forEach((member) => {
      if (!member.profiles?.email) return;
      grouped.set(member.team_id, [...(grouped.get(member.team_id) || []), member]);
    });

    const results: Array<{ teamId: string; sent: number }> = [];

    for (const [teamId, recipients] of grouped) {
      const directors = recipients.filter((member) => member.role === "director");
      const selectedRecipients = directors.length ? directors : recipients.filter((member) => member.role === "owner");
      const teamName = selectedRecipients[0]?.teams?.name || "CalcioLab";

      const [{ data: sessions }, { data: matches }, { data: players }, { data: physicalTests }] = await Promise.all([
        supabase.from("sessions").select("id, team_id, data").eq("team_id", teamId),
        supabase.from("matches").select("id, team_id, data").eq("team_id", teamId),
        supabase.from("players").select("id, team_id, data").eq("team_id", teamId),
        supabase.from("physical_tests").select("id, team_id, data").eq("team_id", teamId),
      ]);

      const weekSessions = ((sessions || []) as JsonRow[]).filter((row) => inRange(row, start, end));
      const weekMatches = ((matches || []) as JsonRow[]).filter((row) => inRange(row, start, end));
      const weekTests = ((physicalTests || []) as JsonRow[]).filter((row) => inRange(row, start, end));
      const allPlayers = (players || []) as JsonRow[];
      const presences = weekSessions.reduce((sum, row) =>
        sum + attendanceValues(row).filter((item) => item?.status === "Presente").length, 0);
      const load = weekSessions.reduce((sum, row) => sum + sessionLoad(row), 0);
      const matchList = weekMatches.map((row) => {
        const opponent = row.data?.opponent ? `vs ${row.data.opponent}` : row.data?.title || "Partita";
        return `${row.data?.date || ""} ${opponent}${row.data?.result ? ` (${row.data.result})` : ""}`;
      }).join("<br>");

      const summary = {
        sessions: weekSessions.length,
        load: Math.round(load),
        presences,
        matches: weekMatches.length,
        physicalTests: weekTests.length,
        activeInjuries: activeInjuryCount(allPlayers),
        newInjuries: newInjuryCount(allPlayers, start, end),
        matchList,
      };

      let sent = 0;
      for (const recipient of selectedRecipients) {
        await sendEmail({
          type: "custom",
          to: recipient.profiles!.email,
          subject: `Report settimanale ${teamName} · ${startIso} / ${endIso}`,
          html: htmlReport(teamName, `${startIso} - ${endIso}`, summary),
        });
        sent += 1;
      }
      results.push({ teamId, sent });
    }

    return json({ ok: true, teams: results.length, sent: results.reduce((sum, item) => sum + item.sent, 0), results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[weekly-report]", message);
    return json({ ok: false, error: message }, 500);
  }
});
