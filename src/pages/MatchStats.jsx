import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppCard from "../components/ui/AppCard";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import MatchTabBar from "../components/match/MatchTabBar";
import { loadMatchStatsMatrix, savePlayerMatchStats } from "../services/playerProfile";
import { useAuth } from "../hooks/useAuth";
import { compareMatchDateTime, comparePlayersByName, formatDate, isGoalkeeper, isLeagueStatsMatch, normalizeAppSettings } from "../utils/helpers";
import { useTranslation } from "../i18n";

const COUNTER_FIELDS = [
  { field: "goals", label: "G", name: "Gol" },
  { field: "goals_conceded", label: "GS", name: "Gol subiti", goalkeeperOnly: true },
  { field: "assists", label: "A", name: "Assist" },
  { field: "yellow_cards", label: "🟨", name: "Ammonizioni", max: 2 },
  { field: "red_cards", label: "🟥", name: "Espulsioni", max: 1 },
];

const EMPTY_ROW = {
  minutes_played: "",
  goals: "",
  goals_conceded: "",
  assists: "",
  yellow_cards: "",
  red_cards: "",
  rating: "",
  notes: "",
};
const MATRIX_DRAFT_PREFIX = "calciolab_match_stats_matrix_draft_v1";

function parseNum(val) {
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : Math.max(0, n);
}

function parseRating(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  return Math.min(10, Math.max(0, Math.round(n * 10) / 10));
}

function validateRow(row, t) {
  const errors = [];
  const mins    = parseInt(row.minutes_played, 10);
  const yellows = parseInt(row.yellow_cards,   10);
  const reds    = parseInt(row.red_cards,      10);
  const goals   = parseInt(row.goals,          10);
  const assists = parseInt(row.assists,        10);
  const rating  = parseFloat(row.rating);
  const conceded = row.goals_conceded;

  if (!isNaN(mins)    && (mins    < 0 || mins    > 120)) errors.push(t("pages.matchStats.errMinutes"));
  if (!isNaN(goals)   && goals   < 0)                    errors.push(t("pages.matchStats.errGoalsNeg"));
  if (!isNaN(assists) && assists < 0)                     errors.push(t("pages.matchStats.errAssistsNeg"));
  if (conceded != null && conceded !== "" && (!Number.isInteger(Number(conceded)) || Number(conceded) < 0)) {
    errors.push(t("pages.matchStats.errGoalsConceded"));
  }
  if (!isNaN(yellows) && (yellows < 0 || yellows > 2))   errors.push(t("pages.matchStats.errYellows"));
  if (!isNaN(reds)    && (reds    < 0 || reds    > 1))   errors.push(t("pages.matchStats.errReds"));
  if (!isNaN(rating)  && (rating  < 0 || rating  > 10))  errors.push(t("pages.matchStats.errRating"));

  return errors;
}

function rowToStats(row) {
  return {
    minutes_played: parseNum(row.minutes_played),
    goals:          parseNum(row.goals),
    goals_conceded: row.goals_conceded == null || row.goals_conceded === "" ? null : Number(row.goals_conceded),
    assists:        parseNum(row.assists),
    yellow_cards:   parseNum(row.yellow_cards),
    red_cards:      parseNum(row.red_cards),
    rating:         parseRating(row.rating),
    notes:          (row.notes || "").trim(),
  };
}

function rowHasData(row) {
  if (!row) return false;
  return Object.entries(row).some(([key, value]) => (
    key !== "notes" ? value !== "" && value !== 0 : value !== ""
  ));
}

function getMatchPlayerIds(match) {
  return [...new Set([
    ...(match?.lineup?.starterIds || []),
    ...(match?.lineup?.benchIds || []),
    ...(match?.lineup?.calledUpIds || []),
    ...(match?.convocazione?.playerIds || []),
  ].map(String).filter(Boolean))];
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isLeagueMatch(match) {
  return isLeagueStatsMatch(match);
}

function getMatchHeaderInfo(match, clubName) {
  const opponent = match?.opponent || "Avversario";
  const isAway = normalizeText(match?.location).includes("trasferta");
  const homeTeam = isAway ? opponent : clubName;
  const awayTeam = isAway ? clubName : opponent;

  return {
    homeTeam,
    awayTeam,
    venue: isAway ? "Trasferta" : "Casa",
    isAway,
  };
}

function getRoleSortOrder(player) {
  const role = normalizeText(player?.role || player?.position);

  if (role.includes("portiere") || role === "por" || role === "gk") return 0;
  if (
    role.includes("difensore") ||
    role.includes("terzino") ||
    role.includes("centrale") ||
    role.includes("libero") ||
    role.includes("stopper") ||
    ["cb", "lb", "rb", "wb"].includes(role)
  ) return 1;
  if (
    role.includes("centrocampista") ||
    role.includes("mediano") ||
    role.includes("mezzala") ||
    role.includes("regista") ||
    role.includes("trequartista") ||
    ["cm", "cdm", "cam"].includes(role)
  ) return 2;
  if (
    role.includes("attaccante") ||
    role.includes("punta") ||
    role.includes("ala") ||
    role.includes("esterno") ||
    ["cf", "st", "lw", "rw"].includes(role)
  ) return 3;

  return 99;
}

function comparePlayersByRoleAndSurname(a, b) {
  const roleDiff = getRoleSortOrder(a) - getRoleSortOrder(b);
  if (roleDiff !== 0) return roleDiff;
  return comparePlayersByName(a, b);
}

function isFirstTeamPlayer(player) {
  return normalizeText(player?.gruppo || "prima") !== "juniores";
}

function loadDraftRows(key) {
  if (!key) return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed?.rows && typeof parsed.rows === "object" ? parsed.rows : {};
  } catch {
    return {};
  }
}

function saveDraftRows(key, rows) {
  if (!key) return false;
  try {
    localStorage.setItem(key, JSON.stringify({ rows, updatedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

function clearDraftRows(key) {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

function mergeRows(baseRows, draftRows) {
  const merged = { ...baseRows };
  Object.entries(draftRows || {}).forEach(([matchId, playerRows]) => {
    if (!playerRows || typeof playerRows !== "object") return;
    merged[matchId] = {
      ...(merged[matchId] || {}),
      ...playerRows,
    };
  });
  return merged;
}

export default function MatchStats({ players = [], matches = [], appSettings = {} }) {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const workspaceProfile = normalizeAppSettings(appSettings).workspaceProfile;
  const activeSeason = workspaceProfile.currentSeason;
  const clubName = workspaceProfile.teamName || workspaceProfile.clubName || "CalcioLab";
  const teamId = auth.team?.id || "";

  const match = matches.find((m) => String(m.id) === String(id));
  const matrixMatches = useMemo(
    () => [...matches].filter((item) => item?.id && isLeagueMatch(item)).sort(compareMatchDateTime),
    [matches],
  );
  const matchIds = useMemo(() => matrixMatches.map((item) => String(item.id)), [matrixMatches]);
  const matchIdsKey = useMemo(() => matchIds.join("|"), [matchIds]);
  const stableMatchIdsKey = matchIdsKey ? matchIdsKey.split("|").sort().join("|") : "";
  const statsMatrixKey = teamId && stableMatchIdsKey
    ? `${teamId}:${activeSeason || "season"}:${stableMatchIdsKey}`
    : "";
  const matchPlayerIdSets = useMemo(
    () => Object.fromEntries(matrixMatches.map((item) => [String(item.id), new Set(getMatchPlayerIds(item))])),
    [matrixMatches],
  );

  // rows: { [matchId]: { [playerId]: { ...EMPTY_ROW } } }
  const [rows, setRows] = useState({});
  const [statsPlayerIds, setStatsPlayerIds] = useState([]);
  // savedStats: { [`${matchId}:${playerId}`]: riga player_matches già in DB (o null) }
  const savedRef = useRef({});
  const matrixWrapRef = useRef(null);
  const rowsHydratedRef = useRef(false);
  const loadedStatsMatrixKeyRef = useRef("");
  const [scrollMax, setScrollMax] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryLoad, setRetryLoad] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null); // "ok" | "error"
  const [savedSnapshot, setSavedSnapshot] = useState({});
  const [draftSaved, setDraftSaved] = useState(true);
  const [validationErrors, setValidationErrors] = useState({}); // { [`${matchId}:${pid}`]: string[] }
  const [playerFilter, setPlayerFilter] = useState("all");
  const draftKey = teamId ? `${MATRIX_DRAFT_PREFIX}:${teamId}:${activeSeason}` : "";
  const currentMatchId = String(id);
  const activeMatchIndex = useMemo(
    () => matrixMatches.findIndex((item) => String(item.id) === currentMatchId),
    [currentMatchId, matrixMatches],
  );

  const matrixPlayers = useMemo(() => {
    const firstTeamIds = new Set(
      players
        .filter(isFirstTeamPlayer)
        .map((player) => String(player.id))
        .filter(Boolean),
    );
    const ids = [...new Set([...firstTeamIds, ...statsPlayerIds.filter((pid) => firstTeamIds.has(String(pid)))].map(String))];
    return ids
      .map((pid) => players.find((p) => String(p.id) === String(pid)))
      .filter(Boolean)
      .sort(comparePlayersByRoleAndSurname);
  }, [players, statsPlayerIds]);
  const currentCalledUpIds = useMemo(
    () => matchPlayerIdSets[currentMatchId] || new Set(),
    [currentMatchId, matchPlayerIdSets],
  );
  const currentStarterIds = useMemo(
    () => new Set((match?.lineup?.starterIds || []).map(String).filter(Boolean)),
    [match?.lineup?.starterIds],
  );
  const visibleMatrixPlayers = useMemo(() => {
    if (playerFilter === "called") {
      return matrixPlayers.filter((player) => currentCalledUpIds.has(String(player.id)));
    }
    if (playerFilter === "starters") {
      return matrixPlayers.filter((player) => currentStarterIds.has(String(player.id)));
    }
    return matrixPlayers;
  }, [currentCalledUpIds, currentStarterIds, matrixPlayers, playerFilter]);
  const hasUnsavedRows = matrixMatches.some((item) => matrixPlayers.some((player) => {
    const mid = String(item.id), pid = String(player.id);
    const row = rows[mid]?.[pid];
    const previous = savedSnapshot[`${mid}:${pid}`];
    if (!row || (!previous && !rowHasData(row))) return false;
    const next = rowToStats(row);
    return ["minutes_played", "goals", "goals_conceded", "assists", "yellow_cards", "red_cards", "rating"].some((field) => {
      const nullable = field === "goals_conceded" || field === "rating";
      return String(next[field] ?? (nullable ? "" : 0)) !== String(previous?.[field] ?? (nullable ? "" : 0));
    });
  }));

  useEffect(() => {
    const statsMatchIds = matchIdsKey ? matchIdsKey.split("|") : [];
    if (!auth.team?.id || !statsMatrixKey || statsMatchIds.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    if (loadedStatsMatrixKeyRef.current === statsMatrixKey && rowsHydratedRef.current) {
      return;
    }

    let cancelled = false;
    rowsHydratedRef.current = false;
    if (!loadedStatsMatrixKeyRef.current) setLoading(true);
    setLoadError(false);
    loadMatchStatsMatrix(auth.team.id, statsMatchIds).then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setLoadError(true); setLoading(false); return; }
      const savedByCell = {};
      const savedPlayers = new Set();
      const initial = {};

      (data || []).forEach((row) => {
        const mid = String(row.match_id);
        const pid = String(row.player_id);
        savedByCell[`${mid}:${pid}`] = row;
        savedPlayers.add(pid);
        initial[mid] = {
          ...(initial[mid] || {}),
          [pid]: {
            minutes_played: row.minutes_played ?? "",
            goals:          row.goals          ?? "",
            goals_conceded: row.goals_conceded ?? "",
            assists:        row.assists         ?? "",
            yellow_cards:   row.yellow_cards    ?? "",
            red_cards:      row.red_cards       ?? "",
            rating:         row.rating          ?? "",
            notes:          row.notes           ?? "",
          },
        };
      });

      savedRef.current = savedByCell;
      setSavedSnapshot(savedByCell);
      setStatsPlayerIds([...savedPlayers]);
      rowsHydratedRef.current = true;
      loadedStatsMatrixKeyRef.current = statsMatrixKey;
      setRows(mergeRows(initial, loadDraftRows(draftKey)));
      setLoading(false);
    }).catch(() => {
      if (!cancelled) { setLoadError(true); setLoading(false); }
    });
    return () => {
      cancelled = true;
    };
  }, [auth.team?.id, draftKey, matchIdsKey, statsMatrixKey, retryLoad]);

  useEffect(() => {
    if (!draftKey || !rowsHydratedRef.current) return;
    setDraftSaved(saveDraftRows(draftKey, rows));
  }, [draftKey, rows]);

  function updateCell(matchId, playerId, field, value) {
    const mid = String(matchId);
    const pid = String(playerId);
    setRows((prev) => ({
      ...prev,
      [mid]: {
        ...(prev[mid] || {}),
        [pid]: { ...((prev[mid] || {})[pid] || EMPTY_ROW), [field]: value },
      },
    }));
    setSaveResult(null);
    // Rimuove eventuali errori di validazione per questa cella quando modifica
    setValidationErrors((prev) => {
      const key = `${mid}:${pid}`;
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function bumpCellNumber(matchId, playerId, field, delta, max = null) {
    const current = rows[String(matchId)]?.[String(playerId)]?.[field];
    const rawNext = Math.max(0, parseNum(current) + delta);
    const next = max === null ? rawNext : Math.min(max, rawNext);
    updateCell(matchId, playerId, field, next ? String(next) : "");
  }

  function scrollMatrix(direction) {
    matrixWrapRef.current?.scrollBy({
      left: direction * 520,
      behavior: "smooth",
    });
  }

  const syncScrollState = useCallback(() => {
    const el = matrixWrapRef.current;
    if (!el) return;
    setScrollLeft(Math.round(el.scrollLeft));
    setScrollMax(Math.max(0, el.scrollWidth - el.clientWidth));
  }, []);

  function setMatrixScroll(value) {
    const next = Number(value) || 0;
    if (matrixWrapRef.current) matrixWrapRef.current.scrollLeft = next;
    setScrollLeft(next);
  }

  useEffect(() => {
    const el = matrixWrapRef.current;
    syncScrollState();
    const frame = window.requestAnimationFrame(syncScrollState);
    const onResize = () => syncScrollState();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncScrollState) : null;
    if (observer && el) {
      observer.observe(el);
      if (el.firstElementChild) observer.observe(el.firstElementChild);
    }
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
    };
  }, [matrixMatches.length, syncScrollState, visibleMatrixPlayers.length]);

  useEffect(() => {
    const el = matrixWrapRef.current;
    if (!el || activeMatchIndex < 0) return;

    const frame = window.requestAnimationFrame(() => {
      el.scrollLeft = activeMatchIndex * 168;
      syncScrollState();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeMatchIndex, syncScrollState]);

  async function handleSave() {
    if (!auth.team?.id || loading || loadError) return;

    // Validazione preventiva
    const errors = {};
    for (const matchItem of matrixMatches) {
      const mid = String(matchItem.id);
      for (const player of matrixPlayers) {
      const pid = String(player.id);
      const row = rows[mid]?.[pid];
      if (!row) continue;
      const rowErrors = validateRow(row, t);
        if (rowErrors.length > 0) errors[`${mid}:${pid}`] = rowErrors;
      }
    }
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setSaving(true);
    setSaveResult(null);
    setValidationErrors({});

    let hasError = false;
    for (const matchItem of matrixMatches) {
      const mid = String(matchItem.id);
      for (const player of matrixPlayers) {
      const pid = String(player.id);
      const row = rows[mid]?.[pid];
      if (!row) continue;

      // Salta righe completamente vuote (nessun dato inserito)
      if (!rowHasData(row) && !savedRef.current[`${mid}:${pid}`]) continue;

      const newStats = rowToStats(row);
        const oldStats = savedRef.current[`${mid}:${pid}`] || null;

      const { error } = await savePlayerMatchStats(
          auth.team.id, pid, mid, newStats, oldStats, activeSeason
      ).catch((error) => ({ error }));

      if (error) {
        hasError = true;
      } else {
        // Aggiorna savedRef con i nuovi valori per eventuali salvataggi successivi
          savedRef.current[`${mid}:${pid}`] = { ...newStats, player_id: pid, match_id: mid };
      }
      }
    }

    setSaving(false);
    setSavedSnapshot({ ...savedRef.current });
    window.dispatchEvent(new Event("player-match-stats-updated"));
    setSaveResult(hasError ? "error" : "ok");
    if (!hasError) clearDraftRows(draftKey);
  }

  if (!match) {
    return (
      <div style={s.page}>
        <AppCard>
          <p style={s.muted}>{t("pages.matchStats.notFound")}</p>
          <Button variant="ghost" onClick={() => navigate("/matches")}>{t("pages.matchStats.backToMatches")}</Button>
        </AppCard>
      </div>
    );
  }

  const subtitle = [match.date, match.location, match.result].filter(Boolean).join(" · ");

  return (
    <div style={s.page}>
      <PageHeader
        title="Griglia statistiche partita"
        subtitle={`${subtitle} · solo campionato, minuti nella cella e statistiche individuali`}
        badge={`${visibleMatrixPlayers.length}/${matrixPlayers.length} giocatori · ${matrixMatches.length} campionato`}
      />

      <MatchTabBar
        matchId={id}
        active="statistiche"
        matchLabel={match.opponent ? `vs ${match.opponent}` : undefined}
        matchData={match}
      />
      <div className="match-stats-save-bar" style={s.floatingSave}>
        <span role="status" aria-live="polite" style={{ ...s.floatingSaveText, color: hasUnsavedRows && (!draftKey || !draftSaved) ? "#fca5a5" : s.floatingSaveText.color }}>
          {t(saving ? "pages.matchStats.savingNow" : hasUnsavedRows
            ? draftKey && draftSaved ? saveResult === "error" ? "pages.matchStats.draftRetry" : "pages.matchStats.draftSaved" : "pages.matchStats.draftFailed"
            : saveResult === "ok" ? "pages.matchStats.savedOnline" : "pages.matchStats.noPendingChanges")}
        </span>
        <Button onClick={handleSave} disabled={saving || loading || loadError} style={s.floatingSaveButton}>
          {saving ? "Salvataggio..." : "Salva dati"}
        </Button>
      </div>

      <AppCard style={s.commandCard}>
        <div style={s.topBar}>
          <div style={s.quickGuide}>
            <span style={s.muted}>Inserisci i minuti nell'intersezione. La riga in alto mostra casa/trasferta e ordine delle squadre.</span>
            <span style={s.muted}>{t("pages.matchStats.goalsConcededHint")}</span>
            <div style={s.filterBar} aria-label="Filtro giocatori">
              {[
                ["all", "Tutti"],
                ["called", "Convocati"],
                ["starters", "Titolari"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPlayerFilter(key)}
                  style={{
                    ...s.filterButton,
                    ...(playerFilter === key ? s.filterButtonActive : {}),
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div style={s.topActions}>
            <div style={s.scrollActions} aria-label="Scorri partite">
              <button type="button" style={s.scrollButton} onClick={() => scrollMatrix(-1)} title="Scorri a sinistra">
                ‹
              </button>
              <button type="button" style={s.scrollButton} onClick={() => scrollMatrix(1)} title="Scorri a destra">
                ›
              </button>
            </div>
            <Button variant="ghost" onClick={() => navigate("/matches")}>{t("pages.matchStats.btnBack")}</Button>
            <Button onClick={handleSave} disabled={saving || loading || loadError} style={s.saveButton}>
              {saving ? "Salvataggio..." : "Salva dati"}
            </Button>
          </div>
        </div>

        {saveResult === "ok" && (
          <p style={s.successMsg}>{t("pages.matchStats.successMsg")}</p>
        )}
        {saveResult === "error" && (
          <p style={s.errorMsg}>{t("pages.matchStats.errorMsg")}</p>
        )}
      </AppCard>

      {loadError ? (
        <AppCard><p role="alert" style={s.errorMsg}>{t("pages.matchStats.loadError")}</p>
          <Button onClick={() => setRetryLoad((value) => value + 1)}>{t("pages.matchStats.retryLoad")}</Button>
        </AppCard>
      ) : loading ? (
        <AppCard><p style={s.muted}>{t("pages.matchStats.loading")}</p></AppCard>
      ) : matrixPlayers.length === 0 ? (
        <AppCard>
          <p style={s.muted}>
            Nessun giocatore disponibile in rosa.
          </p>
        </AppCard>
      ) : visibleMatrixPlayers.length === 0 ? (
        <AppCard>
          <p style={s.muted}>Nessun giocatore in questo filtro per la partita selezionata.</p>
        </AppCard>
      ) : matrixMatches.length === 0 ? (
        <AppCard><p style={s.muted}>Nessuna partita di campionato disponibile.</p></AppCard>
      ) : (
        <AppCard style={s.matrixCard}>
          <div style={s.matrixHint}>
            <span>Scorri orizzontalmente per vedere le altre partite</span>
            <div className="no-mobile-override match-stats-scroll-controls" style={s.matrixScrollControls}>
              <button type="button" style={s.inlineScrollButton} onClick={() => scrollMatrix(-1)} title="Scorri a sinistra">
                ‹
              </button>
              <input
                type="range"
                min="0"
                max={scrollMax}
                value={Math.min(scrollLeft, scrollMax)}
                onChange={(event) => setMatrixScroll(event.target.value)}
                style={s.scrollRange}
                aria-label="Scorrimento partite"
              />
              <button type="button" style={s.inlineScrollButton} onClick={() => scrollMatrix(1)} title="Scorri a destra">
                ›
              </button>
            </div>
          </div>
          <div ref={matrixWrapRef} tabIndex={0} role="region" aria-label="Statistiche giocatori per partita, scorri orizzontalmente" className="match-stats-matrix-scroll" style={s.matrixWrap} onScroll={syncScrollState}>
            <div
              className="no-mobile-override match-stats-matrix"
              style={{
                ...s.matrix,
                gridTemplateColumns: `var(--match-player-width, 220px) repeat(${matrixMatches.length}, 168px)`,
              }}
            >
              <div style={{ ...s.cornerCell, ...s.stickyLeft }}>Giocatore</div>
              {matrixMatches.map((matchItem) => {
                const active = String(matchItem.id) === String(id);
                const headerInfo = getMatchHeaderInfo(matchItem, clubName);
                return (
                  <div
                    key={matchItem.id}
                    style={{
                      ...s.matchHeaderCell,
                      ...(active ? s.matchHeaderActive : {}),
                    }}
                    title={[headerInfo.homeTeam, "vs", headerInfo.awayTeam, formatDate(matchItem.date), matchItem.result].filter(Boolean).join(" · ")}
                  >
                    <span style={{ ...s.venuePill, ...(headerInfo.isAway ? s.venueAway : s.venueHome) }}>
                      {headerInfo.venue}
                    </span>
                    <strong style={s.matchTeams}>
                      <span>{headerInfo.homeTeam || t("pages.matchStats.defaultOpponent")}</span>
                      <small style={s.matchVs}>vs</small>
                      <span>{headerInfo.awayTeam || t("pages.matchStats.defaultOpponent")}</span>
                    </strong>
                    <span style={s.matchDate}>{formatDate(matchItem.date)}</span>
                    {matchItem.result && <em style={s.matchResult}>{matchItem.result}</em>}
                  </div>
                );
              })}

              {visibleMatrixPlayers.map((player) => {
                const pid = String(player.id);
                const displayName = [player.firstName, player.lastName].filter(Boolean).join(" ") || player.name || "-";

                return (
                  <div key={pid} style={{ display: "contents" }}>
                    <div style={{ ...s.playerCell, ...s.stickyLeft }} title={displayName}>
                      <strong>{displayName}</strong>
                      {player.position && <span>{player.position}</span>}
                    </div>
                    {matrixMatches.map((matchItem) => {
                      const mid = String(matchItem.id);
                      const row = rows[mid]?.[pid] || EMPTY_ROW;
                      const cellKey = `${mid}:${pid}`;
                      const hasError = Boolean(validationErrors[cellKey]?.length);
                      const isInMatch = Boolean(matchPlayerIdSets[mid]?.has(pid));
                      const isActiveMatch = mid === String(id);

                      return (
                        <div
                          key={cellKey}
                          style={{
                            ...s.statCell,
                            ...(isInMatch ? s.statCellInMatch : {}),
                            ...(isActiveMatch ? s.statCellActiveMatch : {}),
                            ...(hasError ? s.statCellError : {}),
                          }}
                        >
                          <input
                            style={s.minutesInput}
                            disabled={saving}
                            type="number"
                            min="0"
                            max="120"
                            placeholder="-"
                            value={row.minutes_played}
                            onChange={(event) => updateCell(mid, pid, "minutes_played", event.target.value)}
                            aria-label={`${displayName} minuti ${matchItem.opponent || ""}`}
                          />
                          <div className="no-mobile-override" style={s.cellCounters}>
                            {COUNTER_FIELDS.filter((field) => !field.goalkeeperOnly || isGoalkeeper(player)).map(({ field, label, name, max, goalkeeperOnly }) => (
                              <Counter
                                key={field}
                                label={label}
                                ariaLabel={`${name}: ${displayName}, ${matchItem.opponent || ""}, ${formatDate(matchItem.date)}`}
                                value={row[field]}
                                max={max}
                                allowUnknown={goalkeeperOnly}
                                disabled={saving}
                                onMinus={() => bumpCellNumber(mid, pid, field, -1, max)}
                                onPlus={() => bumpCellNumber(mid, pid, field, 1, max)}
                                onChange={(value) => updateCell(mid, pid, field, value)}
                              />
                            ))}
                          </div>
                          {hasError && <span role="alert" style={{ color: "#f87171", fontSize: 11, lineHeight: 1.4 }}>{validationErrors[cellKey].join(". ")}</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </AppCard>
      )}
    </div>
  );
}

function Counter({ label, ariaLabel, value, max, onMinus, onPlus, onChange, allowUnknown = false, disabled = false }) {
  if (allowUnknown) {
    return (
      <label className="no-mobile-override match-stat-counter" style={{ ...s.counter, gridTemplateColumns: "14px minmax(0, 1fr)" }}>
        <span style={s.counterLabel}>{label}</span>
        <input disabled={disabled} type="number" inputMode="numeric" min="0" step="1" aria-label={ariaLabel}
          value={value ?? ""} placeholder="—" onChange={(event) => onChange(event.target.value)}
          style={{ ...s.minutesInput, width: 50 }} />
      </label>
    );
  }
  return (
    <div className="no-mobile-override match-stat-counter" style={s.counter}>
      <span style={s.counterLabel} aria-hidden="true">{label}</span>
      <button className="mobile-hide" disabled={disabled} type="button" aria-label={`Riduci ${ariaLabel}`} onClick={onMinus} style={s.counterButton}>−</button>
      <strong className="mobile-hide" style={s.counterValue}>{value || 0}</strong>
      <button className="mobile-hide" disabled={disabled} type="button" aria-label={`Aumenta ${ariaLabel}`} onClick={onPlus} style={s.counterButton}>+</button>
      <input
        className="mobile-only match-stat-counter-input"
        disabled={disabled}
        type="number"
        inputMode="numeric"
        min="0"
        max={max}
        step="1"
        aria-label={ariaLabel}
        value={value}
        placeholder="0"
        onChange={(event) => onChange(event.target.value)}
        style={s.minutesInput}
      />
    </div>
  );
}

const s = {
  page:       { display: "grid", gap: 18, paddingBottom: 86 },
  muted:      { color: "#94a3b8", margin: 0, lineHeight: 1.45 },
  floatingSave: {
    position: "fixed",
    right: 28,
    bottom: 22,
    zIndex: 60,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 16,
    border: "1px solid rgba(96,165,250,0.28)",
    background: "rgba(15,23,42,0.94)",
    boxShadow: "0 18px 45px rgba(0,0,0,0.38)",
    backdropFilter: "blur(14px)",
  },
  floatingSaveText: {
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.25,
  },
  floatingSaveButton: {
    minWidth: 140,
    boxShadow: "0 12px 30px rgba(37,99,235,0.42)",
  },
  commandCard: {
    position: "sticky",
    top: 12,
    zIndex: 8,
  },
  topBar:     { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 },
  topActions: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  scrollActions: {
    display: "flex",
    gap: 6,
    padding: 3,
    borderRadius: 12,
    background: "rgba(15,23,42,0.82)",
    border: "1px solid rgba(148,163,184,0.14)",
  },
  scrollButton: {
    width: 34,
    height: 34,
    minHeight: 34,
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.16)",
    background: "rgba(255,255,255,0.05)",
    color: "#e2e8f0",
    cursor: "pointer",
    fontSize: 24,
    fontWeight: 900,
    lineHeight: 1,
    padding: 0,
  },
  saveButton: {
    minWidth: 132,
    boxShadow: "0 12px 26px rgba(37,99,235,0.34)",
  },
  quickGuide: {
    display: "grid",
    gap: 10,
    minWidth: 240,
  },
  filterBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  filterButton: {
    minHeight: 32,
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.16)",
    background: "rgba(15,23,42,0.82)",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 900,
    padding: "0 12px",
  },
  filterButtonActive: {
    border: "1px solid rgba(96,165,250,0.48)",
    background: "rgba(37,99,235,0.2)",
    color: "#bfdbfe",
  },
  successMsg: { margin: "12px 0 0", color: "#22c55e", fontSize: 14, lineHeight: 1.4 },
  errorMsg:   { margin: "12px 0 0", color: "#f87171", fontSize: 14, lineHeight: 1.4 },
  link:       { background: "none", border: "none", color: "#38bdf8", cursor: "pointer", padding: 0, fontSize: "inherit" },

  matrixCard: {
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },
  matrixHint: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: 800,
    flexWrap: "wrap",
  },
  matrixScrollControls: {
    display: "grid",
    gridTemplateColumns: "44px minmax(0, 1fr) 44px",
    alignItems: "center",
    gap: 8,
    flex: "1 1 360px",
    maxWidth: 520,
  },
  inlineScrollButton: {
    width: 44,
    height: 44,
    minHeight: 44,
    borderRadius: 10,
    border: "1px solid rgba(96,165,250,0.28)",
    background: "rgba(37,99,235,0.18)",
    color: "#dbeafe",
    cursor: "pointer",
    fontSize: 22,
    fontWeight: 900,
    lineHeight: 1,
    padding: 0,
  },
  scrollRange: {
    width: "100%",
    minHeight: 30,
    accentColor: "#60a5fa",
    cursor: "pointer",
  },
  matrixWrap: {
    overflow: "auto",
    overflowX: "auto",
    overflowY: "auto",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    maxHeight: "calc(100vh - 270px)",
    paddingBottom: 10,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.14)",
    background: "rgba(2,6,23,0.2)",
    scrollbarWidth: "thin",
    scrollbarColor: "#60a5fa rgba(15,23,42,0.82)",
    WebkitOverflowScrolling: "touch",
    overscrollBehaviorX: "contain",
  },
  matrix: {
    display: "grid",
    minWidth: "max-content",
    alignItems: "stretch",
  },
  stickyLeft: {
    position: "sticky",
    left: 0,
    zIndex: 2,
  },
  cornerCell: {
    position: "sticky",
    top: 0,
    zIndex: 4,
    minHeight: 112,
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    background: "#111827",
    borderRight: "1px solid rgba(148,163,184,0.18)",
    borderBottom: "1px solid rgba(148,163,184,0.18)",
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  matchHeaderCell: {
    position: "sticky",
    top: 0,
    zIndex: 3,
    minHeight: 112,
    padding: "10px 12px",
    display: "grid",
    alignContent: "center",
    gap: 7,
    background: "#111827",
    borderRight: "1px solid rgba(148,163,184,0.12)",
    borderBottom: "1px solid rgba(148,163,184,0.18)",
    color: "#e2e8f0",
  },
  matchHeaderActive: {
    background: "linear-gradient(180deg, rgba(37,99,235,0.28), #111827)",
    boxShadow: "inset 0 2px 0 #60a5fa",
  },
  venuePill: {
    justifySelf: "start",
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 10,
    fontWeight: 900,
    lineHeight: 1,
  },
  venueHome: {
    color: "#86efac",
    background: "rgba(34,197,94,0.13)",
    border: "1px solid rgba(34,197,94,0.25)",
  },
  venueAway: {
    color: "#fbbf24",
    background: "rgba(245,158,11,0.13)",
    border: "1px solid rgba(245,158,11,0.25)",
  },
  matchTeams: {
    display: "grid",
    gap: 2,
    minWidth: 0,
    color: "#f8fafc",
    fontSize: 13,
    lineHeight: 1.15,
  },
  matchVs: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  matchDate: {
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 1.2,
  },
  matchResult: {
    justifySelf: "start",
    color: "#cbd5e1",
    fontSize: 12,
    fontStyle: "normal",
    fontWeight: 900,
  },
  playerCell: {
    minHeight: 92,
    padding: "12px 14px",
    display: "grid",
    alignContent: "center",
    gap: 4,
    background: "#0f172a",
    borderRight: "1px solid rgba(148,163,184,0.18)",
    borderBottom: "1px solid rgba(148,163,184,0.1)",
    color: "#e2e8f0",
  },
  statCell: {
    position: "relative",
    minHeight: 92,
    padding: 8,
    display: "grid",
    alignContent: "center",
    gap: 7,
    background: "rgba(255,255,255,0.018)",
    borderRight: "1px solid rgba(148,163,184,0.08)",
    borderBottom: "1px solid rgba(148,163,184,0.08)",
  },
  statCellInMatch: {
    background: "rgba(59,130,246,0.045)",
  },
  statCellActiveMatch: {
    boxShadow: "inset 0 0 0 1px rgba(96,165,250,0.18)",
  },
  statCellError: {
    background: "rgba(248,113,113,0.08)",
  },
  minutesInput: {
    width: "100%",
    height: 38,
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(15,23,42,0.82)",
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: 900,
    textAlign: "center",
    outline: "none",
    boxSizing: "border-box",
  },
  cellCounters: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 5,
  },
  counter: {
    display: "grid",
    gridTemplateColumns: "14px 18px 18px 18px",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minWidth: 0,
    color: "#cbd5e1",
  },
  counterLabel: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: 900,
  },
  counterButton: {
    width: 18,
    height: 18,
    borderRadius: 6,
    border: "1px solid rgba(148,163,184,0.16)",
    background: "rgba(255,255,255,0.04)",
    color: "#e2e8f0",
    cursor: "pointer",
    fontSize: 12,
    lineHeight: 1,
    padding: 0,
  },
  counterValue: {
    color: "#f8fafc",
    fontSize: 11,
    textAlign: "center",
  },
  cellErrorMark: {
    position: "absolute",
    top: 5,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    background: "#ef4444",
    color: "white",
    fontSize: 10,
    fontWeight: 900,
  },

  playerStatsList: {
    display: "grid",
    gap: 12,
  },
  playerStatsCard: {
    border: "1px solid",
    borderRadius: 16,
    background: "rgba(255,255,255,0.025)",
    transition: "border-color 0.2s, background 0.2s",
    display: "grid",
    gap: 14,
    padding: 14,
  },
  playerStatsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  playerIdentity: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    minWidth: 0,
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(86px, 1fr))",
    gap: 10,
  },
  statField: {
    display: "grid",
    gap: 5,
    minWidth: 0,
  },
  notesField: {
    display: "grid",
    gap: 6,
  },
  rowErrors: {
    gridColumn: "1 / -1",
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    padding: "4px 4px 10px",
  },
  rowError: {
    fontSize: 12,
    fontWeight: 700,
    color: "#f87171",
    background: "rgba(248,113,113,0.1)",
    border: "1px solid rgba(248,113,113,0.25)",
    borderRadius: 8,
    padding: "2px 8px",
  },
  playerName: { fontSize: 15, fontWeight: 800, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 },
  fieldLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  fieldHint: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.2,
  },

  input: {
    width: "100%",
    minHeight: 40,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "#e2e8f0",
    fontSize: 14,
    textAlign: "center",
    outline: "none",
    boxSizing: "border-box",
  },
  inputRating: { border: "1px solid rgba(56,189,248,0.3)" },
  inputNotes:  { textAlign: "left" },
};
