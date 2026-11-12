import { randomUUID } from "node:crypto";
import { createServer } from "vite";

const port = 4177;
const host = process.argv.includes("--lan") ? "0.0.0.0" : "127.0.0.1";
const teamId = "10000000-0000-4000-8000-000000000001";
const user = { id: "20000000-0000-4000-8000-000000000001", email: "staff@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
const assistant = { ...user, id: "20000000-0000-4000-8000-000000000002", email: "collaboratore@example.test" };
const accounts = [user, assistant];
const timestamp = () => new Date().toISOString();
const players = Array.from({ length: 25 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  return { id: `30000000-0000-4000-8000-0000000000${number}`, firstName: "Giocatore", lastName: number, name: "Giocatore " + number, role: "Centrocampista", gruppo: "prima" };
});
const monday = new Date();
monday.setHours(12, 0, 0, 0);
monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
function date(offset) {
  const value = new Date(monday);
  value.setDate(value.getDate() + offset);
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");
}
const seasonYear = monday.getMonth() >= 6 ? monday.getFullYear() : monday.getFullYear() - 1;
const season = seasonYear + "/" + String(seasonYear + 1).slice(-2);
const session = (id, offset, incomplete = false) => ({
  id, date: date(offset), title: "Seduta prova " + id, type: "Allenamento", completed: true, duration: 75,
  attendance: Object.fromEntries(players.filter((_, index) => !incomplete || index !== 0)
    .map((player, index) => [player.id, { status: index === 4 ? "Assente" : index === 5 ? "Recupero" : "Presente" }])),
});
const called = players.slice(0, 18).map(({ id }) => id);
const match = (id, offset) => ({
  id, date: date(offset), type: "Partita", title: "Gara prova " + id, opponent: "Avversaria " + id, location: "Casa",
  season, competition: "Campionato", matchKind: "Campionato", result: "2-1", completed: true,
  convocazione: { published: true, playerIds: called },
  lineup: { starterIds: called.slice(0, 11), benchIds: called.slice(11), calledUpIds: called },
});
const entity = (data) => ({ id: data.id, data, team_id: teamId, updated_at: timestamp() });
const team = { id: teamId, name: "CalcioLab Prova Staff", season, onboarding_completed: true, subscription_plan: "premium", subscription_status: "active", billing_status: "active", created_at: timestamp(), settings: { workspaceProfile: { clubName: "CalcioLab Prova Staff", currentSeason: season } }, set_plays: [] };
const tables = {
  teams: [team],
  team_members: [{ team_id: teamId, role: "owner", user_id: user.id, teams: team }],
  players: players.map(entity),
  sessions: [session("A", -7), session("B", -5), session("C", -3, true)].map(entity),
  matches: [match("A", -1), match("B", -20), match("C", -16)].map(entity),
  player_matches: [
    ...called.slice(2).map((id, i) => ({ player_id: id, match_id: "A", minutes_played: i < 9 ? 65 : 0 })),
    ...called.map((id) => ({ player_id: id, match_id: "B", minutes_played: 65 })),
    ...called.slice(1).map((id) => ({ player_id: id, match_id: "C", minutes_played: 0 })),
  ].map((row) => ({ team_id: teamId, minutes_cleared: false, yellow_cards: 0, ...row })),
};

const secondTeamId = "10000000-0000-4000-8000-000000000002";
const secondTeam = {
  ...team,
  id: secondTeamId,
  name: "CalcioLab Prova Staff B",
  created_at: "2020-01-01T00:00:00.000Z",
  settings: {
    ...team.settings,
    workspaceProfile: { ...team.settings.workspaceProfile, clubName: "CalcioLab Prova Staff B" },
    members: [{ id: assistant.id, name: "Collaboratore di prova", email: assistant.email, role: "assistantCoach", status: "Attivo" }],
  },
};
tables.teams.push(secondTeam);
tables.team_members.push(
  { team_id: secondTeamId, role: "owner", user_id: user.id, teams: secondTeam },
  { team_id: secondTeamId, role: "assistantCoach", user_id: assistant.id, teams: secondTeam },
);
const longNames = ["Alessandro Della Rovere di Montefeltro", "Leonardo Barzagli della Torre", "Tommaso Di Sant'Alessandro"];
const secondPlayers = players.map((player, index) => ({
  ...player,
  firstName: "",
  lastName: "",
  name: "B " + String(index + 1).padStart(2, "0") + " · " + (longNames[index] || player.name),
}));
const secondEntity = (data) => ({ ...entity(data), team_id: secondTeamId });
tables.players.push(...secondPlayers.map(secondEntity));
tables.sessions.push(...[
  session("A", -7), session("B", -5), session("C", -3, true),
].map((item) => secondEntity({ ...item, title: item.title + " · Squadra B" })));
tables.matches.push(...[
  match("A", -2), match("D", -1),
].map((item) => secondEntity({ ...item, opponent: item.opponent + " · Squadra B" })));
tables.player_matches.push(...called.flatMap((player_id, index) => [
  { player_id, match_id: "A", minutes_played: [65, 0, 7][index] ?? 42 },
  ...(index === 0 ? [] : [{ player_id, match_id: "D", minutes_played: 0 }]),
]).map((row) => ({ ...row, team_id: secondTeamId, minutes_cleared: false, yellow_cards: 0 })));

const encoded = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const makeToken = (account) => [encoded({ alg: "HS256", typ: "JWT" }), encoded({ sub: account.id, exp: Math.floor(Date.now() / 1000) + 86400, role: "authenticated" }), "local"].join(".");
function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(data === undefined ? undefined : JSON.stringify(data));
}
async function readBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

async function serve(req, res, next) {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/auth/v1/")) {
    if (url.pathname.endsWith("/token")) {
      const input = await readBody(req);
      const account = url.searchParams.get("grant_type") === "refresh_token"
        ? accounts.find(({ id }) => input.refresh_token === id)
        : accounts.find(({ email }) => input.email === email && input.password === "prova-staff");
      if (!account) return send(res, 400, { code: "invalid_credentials", message: "Credenziali di prova non valide" });
      return send(res, 200, { access_token: makeToken(account), refresh_token: account.id, token_type: "bearer", expires_in: 86400, user: account });
    }
    if (url.pathname.endsWith("/user")) {
      const token = req.headers.authorization?.split(" ")[1];
      const account = accounts.find((item) => makeToken(item).split(".")[0] === token?.split(".")[0]
        && JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub === item.id);
      return account ? send(res, 200, account) : send(res, 401, { message: "Sessione di prova non valida" });
    }
    return send(res, 200, {});
  }
  if (url.pathname.startsWith("/functions/v1/") || url.pathname.startsWith("/rest/v1/rpc/")) return send(res, 200, null);
  if (!url.pathname.startsWith("/rest/v1/")) return next();
  const name = url.pathname.split("/").at(-1);
  const rows = tables[name] ??= [];
  const matches = (row) => [...url.searchParams].every(([field, value]) => {
    if (value.startsWith("eq.")) return String(row[field]) === value.slice(3);
    if (value.startsWith("gt.")) return String(row[field]) > value.slice(3);
    if (value.startsWith("in.(")) return value.slice(4, -1).split(",").includes(String(row[field]));
    return true;
  });
  if (req.method === "GET" || req.method === "HEAD") {
    const result = rows.filter(matches);
    return send(res, 200, req.headers.accept?.includes("vnd.pgrst.object") ? result[0] ?? null : result);
  }
  const payload = await readBody(req);
  const written = [];
  if (req.method === "PATCH") {
    for (const row of rows.filter(matches)) {
      Object.assign(row, payload, { updated_at: timestamp() });
      written.push(row);
    }
  } else if (req.method === "POST") {
    for (const item of Array.isArray(payload) ? payload : [payload]) {
      const fields = url.searchParams.get("on_conflict")?.split(",") ?? ["id"];
      let row = rows.find((candidate) => fields.every((field) => item[field] !== undefined && candidate[field] === item[field]));
      if (row) {
        if (!req.headers.prefer?.includes("ignore-duplicates")) Object.assign(row, item, { updated_at: timestamp() });
      } else {
        row = { id: randomUUID(), updated_at: timestamp(), ...(name === "player_matches" ? { minutes_played: null, minutes_cleared: false } : {}), ...item };
        rows.push(row);
      }
      written.push(row);
    }
  } else return send(res, 405, { message: "Unsupported in the staff rehearsal" });
  if (!req.headers.prefer?.includes("return=representation")) return send(res, 204);
  return send(res, 200, req.headers.accept?.includes("vnd.pgrst.object") ? written[0] ?? null : written);
}

process.env.VITE_SUPABASE_URL = "http://127.0.0.1:" + port;
process.env.VITE_SUPABASE_ANON_KEY = "local-staff-test";
process.env.VITE_SENTRY_DSN = "";
const server = await createServer({
  cacheDir: "node_modules/.vite-staff-rehearsal",
  server: { host, port, strictPort: true },
  plugins: [{
    name: "calciolab-staff-rehearsal",
    transform(code, id) {
      if (id.replaceAll("\\", "/").endsWith("/src/lib/supabaseClient.js")) {
        return code.replace("import.meta.env.VITE_SUPABASE_URL", "window.location.origin");
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        serve(req, res, next).catch((error) => send(res, 500, { message: error.message }));
      });
    },
  }],
});
await server.listen();
server.printUrls();
console.log("Dati fittizi in memoria. Account: staff@example.test e collaboratore@example.test. Password: prova-staff.");
