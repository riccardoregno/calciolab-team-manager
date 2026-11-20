import { getRosterReturnPath, getRosterWeekPath } from "../utils/rosterNavigation";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import AppCard from "../components/ui/AppCard";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import MatchTabBar from '../components/match/MatchTabBar';
import MatchMinutesProposal from '../components/match/MatchMinutesProposal';
import { useTranslation } from '../i18n';
import { analyzeMatchTimeline, getMatchParticipation, proposeMinutesDraft, editMinutesDraft } from '../utils/matchTimeline';
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
  const { t } = useTranslation();
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
  const recordedStarters = getMatchParticipation(match).starters;
  const missingSavedLineup = !recordedStarters.length;
  const starters = missingSavedLineup ? starterDraft : recordedStarters;
  const [duration, setDuration] = useState(String(draft.minutesProposal?.duration || 90));
  const timeline = analyzeMatchTimeline(match, duration, players.filter(player => !hasPlayerTransferred(player, match.date)).map(player => player.id));
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
  const { state, search } = useLocation();
  const linkedPlayerId = new URLSearchParams(search).get('player') || state?.minutesPlayerId;
  const [missingOnly, setMissingOnly] = useState(Boolean(state?.missingMinutesOnly));
  const backTo = state?.fromDashboard ? "/" : "/matches?view=pending";
  const rosterReturn = getRosterReturnPath(state, search);
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
    const destination = rosterReturn || (event.nativeEvent.submitter?.value === 'quadro' ? getRosterWeekPath(match.date) : backTo);
    if (!canManage || saveLock.current || (remote && !saved)) return;
    if (draft.minutesProposal && (!timeline.valid || draft.minutesProposal.fingerprint !== timeline.fingerprint)) {
      setError(t('matchFlow.staleProposal'));
      return;
    }
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
        // Recheck generated values immediately before writing: another staff member
        // may have completed the same player since this page was loaded.
        const generated = new Set(draft.minutesProposal?.ids || []);
        if (Object.keys(updates).some(id => generated.has(id))) {
          const fresh = await loadMatchStats(teamId, matchId);
          if (fresh.error) throw new Error('minutes-refresh');
          const freshRows = Object.fromEntries((fresh.data || []).map(row => [String(row.player_id), row]));
          const protectedIds = Object.keys(updates).filter(id => generated.has(id) &&
            resolveMatchMinutes(freshRows[id]?.minutes_played, match.attendance?.[id]?.minutes, freshRows[id]?.minutes_cleared) !== null);
          if (protectedIds.length) {
            const next = { ...draft, minutes: { ...edits } };
            for (const id of protectedIds) delete next.minutes[id];
            const remaining = draft.minutesProposal.ids.filter(id => !protectedIds.includes(id));
            if (remaining.length) next.minutesProposal = { ...draft.minutesProposal, ids: remaining };
            else delete next.minutesProposal;
            updateDraft(next);
            setSaved(freshRows);
            setError(t('matchFlow.minutesChanged'));
            return;
          }
        }
        const results = await Promise.allSettled(Object.entries(updates).map(([id, minutes_played]) =>
          saveMatchMinutes(teamId, id, matchId, minutes_played, Object.hasOwn(saved, id) ? null : match.attendance?.[id],
            { onlyIfMissing: (draft.minutesProposal?.ids || []).includes(id) })
        ));
        if (results.some((result) => result.status === "rejected" || result.value.error || result.value.unchanged)) {
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
      navigate(destination);
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
      <MatchTabBar matchId={match.id} active="tabellino" matchLabel={match.opponent} matchData={match} />
      <Link to={rosterReturn || backTo}>{rosterReturn ? t('dailyUi.backQuadro') : state?.fromDashboard ? "Torna alla Dashboard" : "Torna alle gare da completare"}</Link>
      {!rosterReturn && <Link to={getRosterWeekPath(match.date)}>{t('dailyUi.sessionQuadro')}</Link>}
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
            {(!remote || saved) && !loadError && <MatchMinutesProposal key={timeline.timelineFingerprint} matchId={match.id} analysis={timeline}
              duration={duration} onDuration={setDuration} canManage={canManage} proposal={draft.minutesProposal}
              hasTargets={minutesPlayers.some(player => !hasRecordedMinutes(getSavedMinutes(String(player.id))) &&
                (!Object.hasOwn(edits, String(player.id)) || draft.minutesProposal?.ids.includes(String(player.id))))}
              onApply={() => updateDraft(proposeMinutesDraft(draft, timeline,
                Object.fromEntries(minutesPlayers.map(player => [String(player.id), getSavedMinutes(String(player.id))]))))} />}
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
                    aria-label={t('matchFlow.playerMinutes', { name: playerName(player) })}
                    value={getMinutes(id)} autoFocus={id === linkedPlayerId} onChange={(e) => updateDraft(editMinutesDraft(draft, id, e.target.value))} />
                </label>;
              })}
          </AppCard>
          {error && <p role="alert">{error}</p>}
          <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
            <Button type="submit" disabled={saving || !canManage || (remote && !saved)}>{saving ? "Salvataggio…" : rosterReturn ? t('dailyUi.saveMatchQuadro') : state?.fromDashboard ? "Salva e torna alla Dashboard" : "Salva e torna alle gare"}</Button>
            {!rosterReturn && <Button type="submit" value="quadro" variant="ghost" disabled={saving || !canManage || (remote && !saved)}>{t('dailyUi.saveMatchQuadro')}</Button>}
          </div>
        </fieldset>
      </form>
    </div>
  );
}
