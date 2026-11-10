import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import AppCard from "../components/ui/AppCard";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import { useAreaPermission } from "../components/auth/permissionContext";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { loadMatchStats, saveMatchMinutes } from "../services/playerProfile";
import { formatDate, hasPlayerTransferred, parseMatchResult, resolveMatchMinutes } from "../utils/helpers";
import { buildHomeAwayScorePayload, isValidMatchScore } from "../utils/matchScore";
import { getMatchCompletionPlayerIds, hasRecordedMinutes } from "../utils/matchCompletion";

import { emptyDraft, getMatchDraftKey, readDraft, writeDraft } from "../utils/matchCompletionDraft";

function playerName(player) {
  return player.name || [player.firstName, player.lastName].filter(Boolean).join(" ");
}

const control = { minHeight: 44, width: 78, padding: 8, borderRadius: 8 };

export default function MatchCompletion({ matches, setMatches, players, teamId, clubName }) {
  const { id } = useParams();
  const match = matches.find((item) => String(item.id) === id);
  return match ? <CompletionForm key={teamId + ":" + id} {...{ match, setMatches, players, teamId, clubName }} />
    : <Link to="/matches?view=pending">Torna alle gare da completare</Link>;
}

function CompletionForm({ match, setMatches, players, teamId, clubName }) {
  const navigate = useNavigate();
  const { canManage } = useAreaPermission();
  const remote = Boolean(teamId && isSupabaseConfigured);
  const score = parseMatchResult(match.result, match);
  const draftKey = getMatchDraftKey(teamId, match.id);
  const [draft, setDraft] = useState(() => readDraft(draftKey));
  const [draftError, setDraftError] = useState(false);
  const { score: scoreDraft, starters: starterDraft, minutes: edits } = draft;
  const home = scoreDraft.home ?? String(score?.homeGoals ?? "");
  const away = scoreDraft.away ?? String(score?.awayGoals ?? "");
  const missingSavedLineup = !match.lineup?.starterIds?.length;
  const starters = missingSavedLineup ? starterDraft : match.lineup.starterIds.map(String);
  const [saved, setSaved] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const saveLock = useRef(false);
  const matchId = match.id;

  useEffect(() => {
    if (!remote) return;
    let active = true;
    loadMatchStats(teamId, matchId).then(({ data, error }) => {
      if (!active) return;
      if (error) setLoadError(true);
      else setSaved(Object.fromEntries((data || []).map((row) => [String(row.player_id), row])));
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [matchId, remote, revision, teamId]);

  const registeredIds = getMatchCompletionPlayerIds(match);
  const expected = new Set([...registeredIds, ...starters]);
  const { state } = useLocation();
  const linkedPlayerId = state?.minutesPlayerId;
  const [missingOnly, setMissingOnly] = useState(Boolean(state?.missingMinutesOnly));
  const backTo = state?.fromDashboard ? "/" : "/matches?view=pending";
  const rosterReturn = state?.rosterWeek ? "/statistics?roster=1&rosterWeek=" + encodeURIComponent(state.rosterWeek) + (state.rosterPending ? "&rosterPending=1" : "") : null;
  const savedStarterNames = starters.map((id) => {
    const player = players.find((item) => String(item.id) === id);
    return player ? playerName(player) : id;
  });
  const eligiblePlayers = players.filter((player) => !hasPlayerTransferred(player, match.date));
  const lineupPlayers = registeredIds.length ? eligiblePlayers.filter((player) => expected.has(String(player.id))) : eligiblePlayers;
  const minutesPlayers = eligiblePlayers.filter((player) => {
    const id = String(player.id);
    return expected.has(id) || id === linkedPlayerId;
  });
  const awayFixture = match.location === "Trasferta";

  function getSavedMinutes(id) {
    return resolveMatchMinutes(saved?.[id]?.minutes_played, match.attendance?.[id]?.minutes, saved?.[id]?.minutes_cleared) ?? "";
  }

  function getMinutes(id) {
    return Object.hasOwn(edits, id) ? edits[id] : getSavedMinutes(id);
  }

  const visibleMinutesPlayers = missingOnly
    ? minutesPlayers.filter(({ id }) => !hasRecordedMinutes(getSavedMinutes(String(id))) || Object.hasOwn(edits, String(id)))
    : minutesPlayers;
  const missingMinutes = minutesPlayers.filter((player) => {
    const value = getMinutes(String(player.id));
    return !hasRecordedMinutes(value);
  }).length;

  function updateDraft(next) {
    setDraft(next);
    setDraftError(!writeDraft(draftKey, next));
    setError("");
  }

  async function save(event) {
    event.preventDefault();
    if (!canManage || saveLock.current || (remote && !saved)) return;
    if (!home.trim() || !away.trim() || !isValidMatchScore(home, away)) {
      setError("Inserisci entrambi i punteggi con numeri interi da zero in su.");
      return;
    }
    if (!starters.length) {
      setError("Seleziona i titolari prima di salvare.");
      return;
    }
    if (missingMinutes) {
      setError("Completa i minuti di tutti i giocatori. Inserisci 0 per chi non ha giocato.");
      return;
    }

    setError("");
    setSaving(true);
    saveLock.current = true;
    const updates = Object.fromEntries(minutesPlayers
      .map((player) => String(player.id))
      .filter((id) => Object.hasOwn(edits, id) && Number(edits[id]) !== resolveMatchMinutes(saved?.[id]?.minutes_played, match.attendance?.[id]?.minutes, saved?.[id]?.minutes_cleared))
      .map((id) => [id, Number(edits[id])]));
    try {
      if (remote) {
        const results = await Promise.allSettled(Object.entries(updates).map(([id, minutes_played]) =>
          saveMatchMinutes(teamId, id, matchId, minutes_played, Object.hasOwn(saved, id) ? null : match.attendance?.[id])
        ));
        if (results.some((result) => result.status === "rejected" || result.value.error)) {
          throw new Error("minutes");
        }
      }
      setMatches((previous) => previous.map((item) => {
        if (String(item.id) !== String(matchId)) return item;
        const lineup = { ...item.lineup, ready: true };
        if (missingSavedLineup && !item.lineup?.starterIds?.length) {
          lineup.starterIds = starters;
          lineup.benchIds = (lineup.benchIds || []).filter((id) => !starters.includes(String(id)));
          lineup.calledUpIds = [...new Set([...getMatchCompletionPlayerIds(item), ...starters])];
        }
        const attendance = { ...item.attendance };
        for (const [id, minutes] of Object.entries(updates)) attendance[id] = { ...attendance[id], minutes };
        const result = Object.keys(scoreDraft).length ? buildHomeAwayScorePayload(item, home, away) : {};
        return { ...item, ...result, lineup, attendance };
      }));
      writeDraft(draftKey, emptyDraft);
      window.dispatchEvent(new Event("player-match-stats-updated"));
      navigate(rosterReturn || backTo);
    } catch {
      setError("Alcuni minuti potrebbero essere stati salvati. Riprova per completare il tabellino.");
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, marginInline: "auto", display: "grid", gap: 14 }}>
      <PageHeader title="Completa tabellino" subtitle={formatDate(match.date)} />
      <Link to={rosterReturn || backTo}>{rosterReturn ? "Torna al riepilogo settimanale" : state?.fromDashboard ? "Torna alla Dashboard" : "Torna alle gare da completare"}</Link>
      <form onSubmit={save}>
        <fieldset disabled={!canManage || saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "grid", gap: 14 }}>
          {(draft !== emptyDraft || draftError) && (
            <AppCard>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <span role="status">{draftError ? "Impossibile aggiornare la bozza sul dispositivo." : "Bozza salvata su questo dispositivo"}</span>
                {draft !== emptyDraft && <Button type="button" variant="ghost" onClick={() => updateDraft(emptyDraft)}>Scarta bozza</Button>}
              </div>
            </AppCard>
          )}
          <AppCard title="1. Risultato">
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <label style={{ display: "grid", gap: 6 }}>{awayFixture ? match.opponent : clubName} (casa)
                <input style={control} type="number" inputMode="numeric" min="0" step="1" value={home} onChange={(e) => updateDraft({ ...draft, score: { ...scoreDraft, home: e.target.value } })} required />
              </label>
              <label style={{ display: "grid", gap: 6 }}>{awayFixture ? clubName : match.opponent} (trasferta)
                <input style={control} type="number" inputMode="numeric" min="0" step="1" value={away} onChange={(e) => updateDraft({ ...draft, score: { ...scoreDraft, away: e.target.value } })} required />
              </label>
            </div>
          </AppCard>
          <AppCard title="2. Formazione" subtitle="Il salvataggio conferma i titolari.">
            {missingSavedLineup ? <div style={{ display: "grid", gap: 6 }}>
              {lineupPlayers.map((player) => {
                const id = String(player.id);
                return <label key={id} style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 40 }}>
                  <input type="checkbox" checked={starters.includes(id)} onChange={(e) => {
                    const selected = e.target.checked;
                    updateDraft({ ...draft, starters: selected ? [...starterDraft, id] : starterDraft.filter((value) => value !== id) });
                  }} />
                  {playerName(player)}
                </label>;
              })}
            </div> : <p>{savedStarterNames.join(", ")}</p>}
          </AppCard>
          <AppCard title="3. Minuti" subtitle="Inserisci 0 per chi non ha giocato.">
            {(!remote || saved) && minutesPlayers.length > 0 && (
              <p role="status">{minutesPlayers.length - missingMinutes} di {minutesPlayers.length} con minuti registrati o compilati</p>
            )}
            {state?.missingMinutesOnly && (!remote || saved) && <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44 }}>
              <input type="checkbox" checked={missingOnly} onChange={(event) => setMissingOnly(event.target.checked)} />
              Solo minutaggi da completare
            </label>}
            {loadError ? <div role="alert">Impossibile caricare il tabellino.{" "}
              <Button type="button" onClick={() => { setLoadError(false); setRevision((value) => value + 1); }}>Riprova</Button>
            </div> : remote && !saved ? <p role="status">Caricamento del tabellino…</p> :
              visibleMinutesPlayers.map((player) => {
                const id = String(player.id);
                return <label key={id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                  <span>{playerName(player)}{starters.includes(id) ? " · Titolare" : ""}{!hasRecordedMinutes(getMinutes(id)) ? " · Minutaggio da completare" : Number(getMinutes(id)) === 0 ? " · Non impiegato · 0 min" : ""}</span>
                  <input style={control} type="number" inputMode="numeric" min="0" max="120" step="1" required
                    value={getMinutes(id)} autoFocus={id === linkedPlayerId} onChange={(e) => updateDraft({ ...draft, minutes: { ...edits, [id]: e.target.value } })} />
                </label>;
              })}
          </AppCard>
          {error && <p role="alert">{error}</p>}
          <Button type="submit" disabled={saving || !canManage || (remote && !saved)}>{saving ? "Salvataggio…" : rosterReturn ? "Salva e torna al riepilogo" : state?.fromDashboard ? "Salva e torna alla Dashboard" : "Salva e torna alle gare"}</Button>
        </fieldset>
      </form>
    </div>
  );
}
