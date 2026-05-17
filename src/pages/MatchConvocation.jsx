import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import MatchTabBar from "../components/match/MatchTabBar";
import { formatDate } from "../utils/helpers";

const MAX_PLAYERS = 22;

const ROLE_ORDER = ["Portiere", "Difensore", "Centrocampista", "Attaccante"];
const ROLE_LABEL = {
  Portiere:       { short: "POR", tone: "orange" },
  Difensore:      { short: "DIF", tone: "blue" },
  Centrocampista: { short: "CEN", tone: "green" },
  Attaccante:     { short: "ATT", tone: "red" },
};

function groupByRole(players) {
  const groups = {};
  players.forEach((p) => {
    const role = ROLE_ORDER.includes(p.role) ? p.role : "Altro";
    if (!groups[role]) groups[role] = [];
    groups[role].push(p);
  });
  // ordina i gruppi per ruolo
  const ordered = {};
  [...ROLE_ORDER, "Altro"].forEach((r) => {
    if (groups[r]?.length) ordered[r] = groups[r];
  });
  return ordered;
}

export default function MatchConvocation({ players = [], matches = [], setMatches }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const match = matches.find((m) => String(m.id) === String(id));
  const existing = match?.convocazione || {};

  const [selectedIds, setSelectedIds] = useState(() =>
    Array.isArray(existing.playerIds) ? existing.playerIds.map(String) : []
  );
  const [notes, setNotes]       = useState(existing.notes || "");
  const [published, setPublished] = useState(Boolean(existing.published));
  const [saved, setSaved]       = useState(false);

  // resync se il match cambia dall'esterno
  useEffect(() => {
    const c = match?.convocazione || {};
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIds(Array.isArray(c.playerIds) ? c.playerIds.map(String) : []);
    setNotes(c.notes || "");
    setPublished(Boolean(c.published));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!match) {
    return (
      <div style={s.page}>
        <AppCard>
          <p style={s.muted}>Partita non trovata.</p>
          <Button variant="ghost" onClick={() => navigate("/matches")}>
            Torna alle partite
          </Button>
        </AppCard>
      </div>
    );
  }

  const groups = groupByRole(players);
  const count  = selectedIds.length;
  const full   = count >= MAX_PLAYERS;

  function toggle(pid) {
    const key = String(pid);
    setSaved(false);
    setSelectedIds((prev) =>
      prev.includes(key)
        ? prev.filter((x) => x !== key)
        : full ? prev : [...prev, key]
    );
  }

  function selectAll() {
    setSaved(false);
    setSelectedIds(players.slice(0, MAX_PLAYERS).map((p) => String(p.id)));
  }

  function clearAll() {
    setSaved(false);
    setSelectedIds([]);
  }

  function persistConvocazione(pub) {
    const newConv = {
      playerIds:   selectedIds,
      notes:       notes.trim(),
      published:   pub,
      publishedAt: pub ? (existing.publishedAt || new Date().toISOString()) : (existing.publishedAt || null),
    };
    setMatches(
      matches.map((m) =>
        String(m.id) === String(id) ? { ...m, convocazione: newConv } : m
      )
    );
    setPublished(pub);
    setSaved(true);
  }

  const subtitle = [
    formatDate(match.date),
    match.location,
    match.result || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const convocati = selectedIds
    .map((pid) => players.find((p) => String(p.id) === pid))
    .filter(Boolean);

  return (
    <div style={s.page}>
      <PageHeader
        title={`Convocazione — ${match.opponent || "Partita"}`}
        subtitle={subtitle}
        badge={published ? "Pubblicata" : "Bozza"}
      />

      <MatchTabBar
        matchId={id}
        active="convocazione"
        matchLabel={match.opponent ? `vs ${match.opponent}` : undefined}
      />

      {/* ── Barra stato ── */}
      <AppCard>
        <div style={s.topBar}>
          <div style={s.counter}>
            <span style={{ ...s.countNum, color: full ? "#f87171" : "#22c55e" }}>
              {count}
            </span>
            <span style={s.countOf}>/ {MAX_PLAYERS} convocati</span>
            {published && (
              <Badge tone="green" style={{ marginLeft: 8 }}>✓ Pubblicata</Badge>
            )}
            {!published && count > 0 && (
              <Badge tone="orange" style={{ marginLeft: 8 }}>Bozza</Badge>
            )}
          </div>

          <div style={s.topActions}>
            <Button variant="ghost" onClick={clearAll}>Deseleziona tutti</Button>
            <Button variant="ghost" onClick={selectAll}>Seleziona tutti</Button>
            <Button variant="ghost" onClick={() => navigate("/matches")}>Indietro</Button>
            <Button variant="ghost" onClick={() => persistConvocazione(false)} disabled={count === 0}>
              Salva bozza
            </Button>
            <Button onClick={() => persistConvocazione(true)} disabled={count === 0}>
              {published ? "Aggiorna pubblicazione" : "Pubblica convocazione"}
            </Button>
          </div>
        </div>

        {saved && (
          <p style={s.savedMsg}>
            {published ? "✓ Convocazione pubblicata — visibile ai giocatori nel portale." : "✓ Bozza salvata."}
          </p>
        )}
      </AppCard>

      {/* ── Note per i giocatori ── */}
      <AppCard>
        <h3 style={{ margin: "0 0 10px", lineHeight: 1.2 }}>Note convocazione</h3>
        <p style={s.muted}>
          Visibili ai giocatori nel portale (es. orario raduno, campo, spogliatoio).
        </p>
        <textarea
          style={s.textarea}
          rows={3}
          placeholder="Es: Raduno ore 14:30 presso spogliatoio 3 — campo sintetico via Roma 12"
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
        />
      </AppCard>

      {/* ── Selezione giocatori ── */}
      <AppCard>
        <h3 style={{ margin: "0 0 4px", lineHeight: 1.2 }}>Seleziona convocati</h3>
        <p style={s.muted}>
          Clicca per selezionare/deselezionare. Massimo {MAX_PLAYERS} giocatori.
          {full && <span style={{ color: "#f87171", marginLeft: 6 }}>Limite raggiunto.</span>}
        </p>

        <div style={s.groups}>
          {Object.entries(groups).map(([role, rolePlayers]) => {
            const meta = ROLE_LABEL[role] || { short: "?", tone: "blue" };
            return (
              <div key={role} style={s.roleGroup}>
                <div style={s.roleHeader}>
                  <Badge tone={meta.tone}>{meta.short}</Badge>
                  <span style={s.roleLabel}>{role}</span>
                  <span style={s.roleCount}>
                    {rolePlayers.filter((p) => selectedIds.includes(String(p.id))).length}/{rolePlayers.length}
                  </span>
                </div>

                <div style={s.playerGrid}>
                  {rolePlayers.map((player) => {
                    const pid      = String(player.id);
                    const selected = selectedIds.includes(pid);
                    const disabled = !selected && full;
                    const displayName =
                      [player.firstName, player.lastName].filter(Boolean).join(" ") ||
                      player.name || "—";

                    return (
                      <button
                        key={pid}
                        onClick={() => !disabled && toggle(pid)}
                        style={{
                          ...s.playerBtn,
                          ...(selected ? s.playerBtnSelected : {}),
                          ...(disabled ? s.playerBtnDisabled : {}),
                        }}
                      >
                        <span style={s.shirtNum}>
                          {player.shirtNumber || "—"}
                        </span>
                        <span style={s.playerBtnName}>{displayName}</span>
                        {selected && <span style={s.checkMark}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </AppCard>

      {/* ── Anteprima foglio convocazione ── */}
      {count > 0 && (
        <AppCard>
          <h3 style={{ margin: "0 0 16px", lineHeight: 1.2 }}>
            Anteprima foglio convocazione
            {!published && <span style={{ ...s.muted, marginLeft: 8, fontSize: 13 }}>(bozza)</span>}
          </h3>

          {/* Header foglio */}
          <div style={s.sheetHeader}>
            <div>
              <p style={s.sheetLabel}>Partita</p>
              <h2 style={s.sheetTitle}>
                CalcioLab <span style={{ color: "#64748b" }}>vs</span> {match.opponent}
              </h2>
            </div>
            <div style={s.sheetMeta}>
              <MetaItem icon="Data" value={formatDate(match.date)} />
              {match.location && <MetaItem icon="Campo" value={match.location} />}
              {notes && <MetaItem icon="Note" value={notes} />}
            </div>
          </div>

          {/* Lista convocati */}
          <div style={s.sheetList}>
            {convocati.map((player, index) => {
              const displayName =
                [player.firstName, player.lastName].filter(Boolean).join(" ") ||
                player.name || "—";
              const meta = ROLE_LABEL[player.role] || { short: "—", tone: "blue" };

              return (
                <div key={player.id} style={s.sheetRow}>
                  <span style={s.sheetIndex}>{index + 1}</span>
                  <span style={s.sheetShirt}>#{player.shirtNumber || "—"}</span>
                  <span style={s.sheetName}>{displayName}</span>
                  <Badge tone={meta.tone}>{meta.short}</Badge>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 18, display: "flex", gap: 12 }}>
            <Button onClick={() => persistConvocazione(true)} disabled={count === 0}>
              {published ? "Aggiorna pubblicazione" : "Pubblica adesso"}
            </Button>
            <Button variant="ghost" onClick={() => persistConvocazione(false)}>
              Salva bozza
            </Button>
          </div>
        </AppCard>
      )}
    </div>
  );
}

function MetaItem({ icon, value }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
      <span style={{ color: "#64748b", fontSize: 12, fontWeight: 800, minWidth: 42 }}>
        {icon}
      </span>
      <span style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.5 }}>{value}</span>
    </div>
  );
}

const s = {
  page:    { display: "grid", gap: 18 },
  muted:   { color: "#94a3b8", margin: 0 },

  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  counter: { display: "flex", alignItems: "center", gap: 6 },
  countNum: { fontSize: 36, fontWeight: 900, lineHeight: 1 },
  countOf:  { fontSize: 16, color: "#64748b", fontWeight: 600 },
  topActions: { display: "flex", gap: 8, flexWrap: "wrap" },

  savedMsg: {
    marginTop: 12,
    marginBottom: 0,
    color: "#22c55e",
    fontSize: 14,
    fontWeight: 600,
  },

  textarea: {
    marginTop: 10,
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "#e2e8f0",
    fontSize: 14,
    lineHeight: 1.6,
    outline: "none",
    resize: "vertical",
  },

  groups: { display: "grid", gap: 18, marginTop: 16 },

  roleGroup: {},
  roleHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  roleLabel: { fontSize: 14, fontWeight: 700, color: "#cbd5e1" },
  roleCount: { fontSize: 12, color: "#475569", marginLeft: "auto" },

  playerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 8,
  },
  playerBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    cursor: "pointer",
    textAlign: "left",
    transition: "background 0.15s, border-color 0.15s",
  },
  playerBtnSelected: {
    background: "rgba(34,197,94,0.15)",
    border: "1px solid rgba(34,197,94,0.4)",
  },
  playerBtnDisabled: {
    opacity: 0.35,
    cursor: "not-allowed",
  },
  shirtNum: {
    minWidth: 26,
    textAlign: "center",
    fontSize: 12,
    fontWeight: 900,
    color: "#64748b",
  },
  playerBtnName: {
    flex: 1,
    fontSize: 13,
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  checkMark: { color: "#22c55e", fontWeight: 900, fontSize: 14 },

  // Anteprima foglio
  sheetHeader: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 20,
    alignItems: "start",
    padding: "16px 0 20px",
    borderBottom: "2px solid rgba(255,255,255,0.1)",
    marginBottom: 12,
  },
  sheetLabel: {
    margin: "0 0 4px",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
    color: "#64748b",
  },
  sheetTitle: { margin: 0, fontSize: 24, fontWeight: 900, lineHeight: 1.12 },
  sheetMeta:  { display: "grid", gap: 6, textAlign: "right" },

  sheetList: {
    display: "grid",
    gap: 4,
  },
  sheetRow: {
    display: "grid",
    gridTemplateColumns: "28px 44px 1fr auto",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.05)",
  },
  sheetIndex: { color: "#475569", fontSize: 12, fontWeight: 700, textAlign: "right" },
  sheetShirt: { color: "#64748b", fontSize: 12, fontWeight: 800, textAlign: "center" },
  sheetName:  { fontSize: 14, fontWeight: 600, color: "#e2e8f0" },
};
