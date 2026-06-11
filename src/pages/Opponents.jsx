import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import SearchBar from "../components/ui/SearchBar";
import { formatShortDate } from "../utils/helpers";
import { useIsMobile } from "../hooks/useIsMobile";
import { useTranslation } from "../i18n";

function normalizeText(value) {
  return String(value || "").trim();
}

function collectLines(matches, field) {
  return matches
    .map((match) => normalizeText(match.opponentScouting?.[field]))
    .filter(Boolean);
}

function buildOpponent(matchList) {
  const sorted = [...matchList].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const formations = new Set();
  const players = new Map();

  sorted.forEach((match) => {
    const scouting = match.opponentScouting || {};
    if (scouting.formation) formations.add(scouting.formation);
    (scouting.lineup || []).forEach((player) => {
      if (!player.name) return;
      const key = player.name.toLowerCase();
      players.set(key, {
        name: player.name,
        role: player.role,
        birthYear: player.birthYear,
        status: player.status,
        notes: player.notes,
      });
    });
  });

  const latest = sorted[0];
  const strengths = collectLines(sorted, "strengths");
  const weaknesses = collectLines(sorted, "weaknesses");
  const setPiecesFor = collectLines(sorted, "setPiecesFor");
  const setPiecesAgainst = collectLines(sorted, "setPiecesAgainst");
  const returnNotes = collectLines(sorted, "returnLegNotes");
  const scoutingScore = [
    formations.size,
    players.size,
    strengths.length,
    weaknesses.length,
    setPiecesFor.length,
    setPiecesAgainst.length,
  ].filter(Boolean).length;

  return {
    name: latest?.opponent || "Avversario",
    matches: sorted,
    latest,
    formations: Array.from(formations),
    players: Array.from(players.values()),
    strengths,
    weaknesses,
    setPiecesFor,
    setPiecesAgainst,
    returnNotes,
    scoutingScore,
  };
}

export default function Opponents({
  matches = [] }) {

  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState("");

  const opponents = useMemo(() => {
    const grouped = matches.reduce((acc, match) => {
      const name = normalizeText(match.opponent) || "Avversario";
      if (!acc[name]) acc[name] = [];
      acc[name].push(match);
      return acc;
    }, {});

    return Object.values(grouped)
      .map(buildOpponent)
      .sort((a, b) => new Date(b.latest?.date || 0) - new Date(a.latest?.date || 0));
  }, [matches]);

  const filtered = opponents.filter((opponent) => {
    const haystack = [
      opponent.name,
      opponent.formations.join(" "),
      opponent.players.map((player) => player.name).join(" "),
      opponent.strengths.join(" "),
      opponent.weaknesses.join(" "),
    ].join(" ").toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const selected = filtered.find((opponent) => opponent.name === selectedName) || filtered[0];

  if (!opponents.length) {
    return (
      <div style={os.page}>
        <PageHeader title={t("pages.opponents.title")} subtitle={t("pages.opponents.subtitle")} />
        <EmptyState
          icon="🕵️"
          title={t("pages.opponents.emptyTitle")}
          text={t("pages.opponents.emptyText")}
          action={<Button onClick={() => navigate("/matches")}>{t("pages.opponents.emptyAction")}</Button>}
        />
      </div>
    );
  }

  return (
    <div style={os.page}>
      <PageHeader
        title={t("pages.opponents.title")}
        subtitle={t("pages.opponents.subtitle")}
        badge={t("pages.opponents.badge", { count: opponents.length })}
        action={<Button onClick={() => navigate("/matches")}>{t("pages.opponents.newMatch")}</Button>}
      />

      <AppCard>
        <div style={os.toolbar}>
          <SearchBar value={search} onChange={setSearch} placeholder={t("pages.opponents.searchPlaceholder")} />
          <div style={os.kpiRow}>
            <MiniKpi label={t("pages.opponents.kpiAnalyzed")} value={matches.length} />
            <MiniKpi label={t("pages.opponents.kpiLineups")} value={matches.filter((m) => m.opponentScouting?.lineup?.length).length} />
            <MiniKpi label={t("pages.opponents.kpiReturnNotes")} value={matches.filter((m) => m.opponentScouting?.returnLegNotes).length} />
          </div>
        </div>
      </AppCard>

      <div style={{ ...os.layout, gridTemplateColumns: isMobile ? "1fr" : "minmax(240px, 320px) minmax(0, 1fr)" }}>
        <div style={os.list}>
          {filtered.map((opponent) => (
            <button
              key={opponent.name}
              type="button"
              onClick={() => setSelectedName(opponent.name)}
              style={{
                ...os.opponentButton,
                ...(selected?.name === opponent.name ? os.opponentButtonActive : {}),
              }}
            >
              <div style={os.opponentButtonTop}>
                <strong>{opponent.name}</strong>
                <Badge tone={opponent.scoutingScore >= 4 ? "green" : "orange"}>
                  {opponent.scoutingScore}/6
                </Badge>
              </div>
              <span>{opponent.matches.length} {t("pages.opponents.matchesLabel")} · {opponent.formations.join(", ") || t("pages.opponents.formationLabel")}</span>
            </button>
          ))}
        </div>

        {selected ? (
          <div style={os.detail}>
            <AppCard>
              <div style={os.hero}>
                <div>
                  <p style={os.eyebrow}>{t("pages.opponents.dossierLabel")}</p>
                  <h2 style={os.title}>{selected.name}</h2>
                  <p style={os.muted}>
                    {t("pages.opponents.lastMatch")} {selected.latest ? formatShortDate(selected.latest.date) : "-"} · {selected.latest?.result || t("pages.opponents.resultFallback")}
                  </p>
                </div>
                <div style={os.heroActions}>
                  {selected.latest && (
                    <Button onClick={() => navigate(`/match-day/${selected.latest.id}`)}>
                      {t("pages.opponents.openMatchDay")}
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => navigate("/set-plays")}>
                    {t("pages.opponents.setPlaysBtn")}
                  </Button>
                </div>
              </div>

              <div style={os.kpiGrid}>
                <MiniKpi label={t("pages.opponents.kpiMatches")} value={selected.matches.length} />
                <MiniKpi label={t("pages.opponents.kpiFormations")} value={selected.formations.length || "-"} />
                <MiniKpi label={t("pages.opponents.kpiPlayers")} value={selected.players.length || "-"} />
                <MiniKpi label={t("pages.opponents.kpiScouting")} value={`${selected.scoutingScore}/6`} />
              </div>
            </AppCard>

            <div style={os.scoutingGrid}>
              <ScoutingBlock title={t("pages.opponents.scoutingStrengths")} tone="red" items={selected.strengths} empty={t("pages.opponents.emptyStrengths")} />
              <ScoutingBlock title={t("pages.opponents.scoutingWeaknesses")} tone="green" items={selected.weaknesses} empty={t("pages.opponents.emptyWeaknesses")} />
              <ScoutingBlock title={t("pages.opponents.scoutingSetFor")} tone="orange" items={selected.setPiecesFor} empty={t("pages.opponents.emptySetFor")} />
              <ScoutingBlock title={t("pages.opponents.scoutingSetAgainst")} tone="blue" items={selected.setPiecesAgainst} empty={t("pages.opponents.emptySetAgainst")} />
            </div>

            <AppCard>
              <div style={os.sectionHead}>
                <div>
                  <h3 style={os.sectionTitle}>{t("pages.opponents.keyPlayersTitle")}</h3>
                  <p style={os.muted}>{t("pages.opponents.keyPlayersSubtitle")}</p>
                </div>
                <Badge tone="blue">{selected.players.length}</Badge>
              </div>
              {selected.players.length ? (
                <div style={os.playerGrid}>
                  {selected.players.slice(0, 16).map((player) => (
                    <div key={`${player.name}-${player.birthYear || ""}`} style={os.playerCard}>
                      <strong>{player.name}</strong>
                      <span>{player.role || t("pages.opponents.roleFallback")} {player.birthYear ? `· ${player.birthYear}` : ""}</span>
                      {player.notes && <small>{player.notes}</small>}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={os.muted}>{t("pages.opponents.noPlayers")}</p>
              )}
            </AppCard>

            <AppCard>
              <div style={os.sectionHead}>
                <div>
                  <h3 style={os.sectionTitle}>{t("pages.opponents.historyTitle")}</h3>
                  <p style={os.muted}>{t("pages.opponents.historySubtitle")}</p>
                </div>
              </div>
              <div style={os.matchList}>
                {selected.matches.map((match) => (
                  <button
                    key={match.id}
                    type="button"
                    onClick={() => navigate(`/match-day/${match.id}`)}
                    style={os.matchItem}
                  >
                    <strong>{formatShortDate(match.date)} · {match.result || t("pages.opponents.historyResultFallback")}</strong>
                    <span>{match.opponentScouting?.returnLegNotes || match.opponentNotes || t("pages.opponents.historyNoReturn")}</span>
                  </button>
                ))}
              </div>
            </AppCard>
          </div>
        ) : (
          <AppCard><p style={os.muted}>{t("pages.opponents.noFilterResults")}</p></AppCard>
        )}
      </div>
    </div>
  );
}

function MiniKpi({ label, value }) {
  return (
    <div style={os.miniKpi}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ScoutingBlock({ title, items, empty, tone }) {
  return (
    <AppCard>
      <div style={os.sectionHead}>
        <h3 style={os.sectionTitle}>{title}</h3>
        <Badge tone={tone}>{items.length || "—"}</Badge>
      </div>
      {items.length ? (
        <div style={os.noteList}>
          {items.slice(0, 4).map((item, index) => (
            <p key={`${title}-${index}`}>{item}</p>
          ))}
        </div>
      ) : (
        <p style={os.muted}>{empty}</p>
      )}
    </AppCard>
  );
}

const os = {
  page: { display: "grid", gap: 18 },
  toolbar: { display: "grid", gap: 14 },
  kpiRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(240px, 320px) minmax(0, 1fr)",
    gap: 18,
    alignItems: "start",
  },
  list: { display: "grid", gap: 10 },
  opponentButton: {
    width: "100%",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(255,255,255,0.04)",
    color: "#cbd5e1",
    display: "grid",
    gap: 8,
    textAlign: "left",
    cursor: "pointer",
  },
  opponentButtonActive: {
    background: "rgba(56,189,248,0.13)",
    border: "1px solid rgba(56,189,248,0.32)",
  },
  opponentButtonTop: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" },
  detail: { display: "grid", gap: 18, minWidth: 0 },
  hero: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" },
  heroActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  eyebrow: { margin: "0 0 6px", color: "#38bdf8", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 },
  title: { margin: "0 0 6px", fontSize: 34, lineHeight: 1.05 },
  muted: { color: "#94a3b8", margin: 0, lineHeight: 1.5 },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginTop: 16 },
  miniKpi: { display: "grid", gap: 6, padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" },
  scoutingGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 18 },
  sectionHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  sectionTitle: { margin: 0, fontSize: 18, lineHeight: 1.2 },
  noteList: { display: "grid", gap: 10 },
  playerGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 },
  playerCard: { display: "grid", gap: 5, padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: "#cbd5e1" },
  matchList: { display: "grid", gap: 10 },
  matchItem: { width: "100%", display: "grid", gap: 5, padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: "#cbd5e1", cursor: "pointer", textAlign: "left" },
};
