import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import SearchBar from "../components/ui/SearchBar";
import { formatShortDate } from "../utils/helpers";
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
        <PageHeader title={t("pages.opponents.title")} subtitle="Archivio scouting, distinte, principi e piano gara" />
        <EmptyState
          icon="🕵️"
          title="Nessun avversario tracciato"
          text="Crea una partita e compila lo scouting nel Match Day per costruire automaticamente l'archivio."
          action={<Button onClick={() => navigate("/matches")}>Crea partita</Button>}
        />
      </div>
    );
  }

  return (
    <div style={os.page}>
      <PageHeader
        title="Avversari"
        subtitle="Archivio scouting, distinte, principi, punti forti/deboli e palle inattive"
        badge={`${opponents.length} avversari`}
        action={<Button onClick={() => navigate("/matches")}>Nuova partita</Button>}
      />

      <AppCard>
        <div style={os.toolbar}>
          <SearchBar value={search} onChange={setSearch} placeholder="Cerca avversario, modulo, giocatore..." />
          <div style={os.kpiRow}>
            <MiniKpi label="Gare analizzate" value={matches.length} />
            <MiniKpi label="Distinte" value={matches.filter((m) => m.opponentScouting?.lineup?.length).length} />
            <MiniKpi label="Con note ritorno" value={matches.filter((m) => m.opponentScouting?.returnLegNotes).length} />
          </div>
        </div>
      </AppCard>

      <div style={os.layout}>
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
              <span>{opponent.matches.length} gare · {opponent.formations.join(", ") || "Modulo -"}</span>
            </button>
          ))}
        </div>

        {selected ? (
          <div style={os.detail}>
            <AppCard>
              <div style={os.hero}>
                <div>
                  <p style={os.eyebrow}>Dossier avversario</p>
                  <h2 style={os.title}>{selected.name}</h2>
                  <p style={os.muted}>
                    Ultima gara: {selected.latest ? formatShortDate(selected.latest.date) : "-"} · {selected.latest?.result || "Risultato -"}
                  </p>
                </div>
                <div style={os.heroActions}>
                  {selected.latest && (
                    <Button onClick={() => navigate(`/match-day/${selected.latest.id}`)}>
                      Apri Match Day
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => navigate("/set-plays")}>
                    Palle inattive
                  </Button>
                </div>
              </div>

              <div style={os.kpiGrid}>
                <MiniKpi label="Gare" value={selected.matches.length} />
                <MiniKpi label="Moduli" value={selected.formations.length || "-"} />
                <MiniKpi label="Giocatori visti" value={selected.players.length || "-"} />
                <MiniKpi label="Scouting" value={`${selected.scoutingScore}/6`} />
              </div>
            </AppCard>

            <div style={os.scoutingGrid}>
              <ScoutingBlock title="Punti forti" tone="red" items={selected.strengths} empty="Nessun punto forte inserito." />
              <ScoutingBlock title="Dove attaccarli" tone="green" items={selected.weaknesses} empty="Nessuna vulnerabilita inserita." />
              <ScoutingBlock title="Palle inattive a favore" tone="orange" items={selected.setPiecesFor} empty="Nessuna nota su piazzati offensivi." />
              <ScoutingBlock title="Palle inattive contro" tone="blue" items={selected.setPiecesAgainst} empty="Nessuna nota su piazzati difensivi." />
            </div>

            <AppCard>
              <div style={os.sectionHead}>
                <div>
                  <h3 style={os.sectionTitle}>Giocatori chiave / distinta</h3>
                  <p style={os.muted}>Aggregati dalle distinte compilate in Match Day.</p>
                </div>
                <Badge tone="blue">{selected.players.length}</Badge>
              </div>
              {selected.players.length ? (
                <div style={os.playerGrid}>
                  {selected.players.slice(0, 16).map((player) => (
                    <div key={`${player.name}-${player.birthYear || ""}`} style={os.playerCard}>
                      <strong>{player.name}</strong>
                      <span>{player.role || "Ruolo -"} {player.birthYear ? `· ${player.birthYear}` : ""}</span>
                      {player.notes && <small>{player.notes}</small>}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={os.muted}>Nessun giocatore avversario inserito.</p>
              )}
            </AppCard>

            <AppCard>
              <div style={os.sectionHead}>
                <div>
                  <h3 style={os.sectionTitle}>Storico gare</h3>
                  <p style={os.muted}>Risultati, note ritorno e apprendimento accumulato.</p>
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
                    <strong>{formatShortDate(match.date)} · {match.result || "Risultato -"}</strong>
                    <span>{match.opponentScouting?.returnLegNotes || match.opponentNotes || "Nessuna nota ritorno"}</span>
                  </button>
                ))}
              </div>
            </AppCard>
          </div>
        ) : (
          <AppCard><p style={os.muted}>Nessun avversario trovato con questi filtri.</p></AppCard>
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
  eyebrow: { margin: "0 0 6px", color: "#38bdf8", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.6 },
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
