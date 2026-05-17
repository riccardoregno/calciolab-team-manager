import { useState } from "react";
import AppCard from "../components/ui/AppCard";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import { styles } from "../styles/index.js";
import { createId } from "../utils/helpers";

// ─────────────────────────────────────────────
// Costanti
// ─────────────────────────────────────────────
const INJURY_TYPES = [
  "Muscolare", "Osseo / frattura", "Articolare",
  "Tendineo / legamentoso", "Contusione",
  "Malattia / influenza", "Affaticamento", "Altro",
];

const STATUS_OPTIONS = [
  { value: "Infortunato",   color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)"  },
  { value: "Recupero",      color: "#fb923c", bg: "rgba(251,146,60,0.12)",  border: "rgba(251,146,60,0.3)"   },
  { value: "Differenziato", color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)"   },
  { value: "Squalificato",  color: "#a855f7", bg: "rgba(168,85,247,0.12)",  border: "rgba(168,85,247,0.3)"   },
];

const UNAVAILABLE = STATUS_OPTIONS.map((s) => s.value);

function getStatusStyle(status) {
  return STATUS_OPTIONS.find((s) => s.value === status) || { color: "#94a3b8", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)" };
}

function emptyForm(players) {
  const firstAvailable = players.find((p) => !UNAVAILABLE.includes(p.status || "Disponibile"));
  return {
    playerId:        firstAvailable?.id || "",
    status:          "Infortunato",
    injuryType:      "",
    injuryStartDate: new Date().toISOString().slice(0, 10),
    expectedReturn:  "",
    notes:           "",
  };
}

// Calcola sedute e partite saltate tra due date
function calcMissed(startDate, endDate, sessions, matches) {
  if (!startDate || !endDate) return { sessionsMissed: 0, matchesMissed: 0 };
  const start = new Date(startDate);
  const end   = new Date(endDate);
  const sessionsMissed = sessions.filter((s) => {
    const d = new Date(s.date);
    return d >= start && d <= end;
  }).length;
  const matchesMissed = matches.filter((m) => {
    const d = new Date(m.date);
    return d >= start && d <= end;
  }).length;
  return { sessionsMissed, matchesMissed };
}

// ─────────────────────────────────────────────
// Componente principale
// ─────────────────────────────────────────────
export default function Availability({ players = [], setPlayers, sessions = [], matches = [] }) {
  const [openModal, setOpenModal]       = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [form, setForm]                 = useState(() => emptyForm(players));
  const [historyPlayerId, setHistoryPlayerId] = useState(null);

  const injuredPlayers = players.filter((p) => UNAVAILABLE.includes(p.status || "Disponibile"));
  const availablePlayers = players.filter((p) => !UNAVAILABLE.includes(p.status || "Disponibile"));

  // ── Apri modal aggiungi
  function openAdd() {
    setEditingPlayerId(null);
    setForm(emptyForm(players));
    setOpenModal(true);
  }

  // ── Apri modal modifica infortunio attivo
  function openEdit(player) {
    setEditingPlayerId(player.id);
    // Trova l'infortunio attivo (senza endDate)
    const active = (player.injuries || []).find((i) => !i.endDate);
    setForm({
      playerId:        player.id,
      status:          player.status || "Infortunato",
      injuryType:      active?.injuryType || player.injuryType || "",
      injuryStartDate: active?.startDate  || player.injuryStartDate || new Date().toISOString().slice(0, 10),
      expectedReturn:  player.expectedReturn || "",
      notes:           active?.notes || player.injuryNotes || "",
    });
    setOpenModal(true);
  }

  // ── Salva infortunio (nuovo o modifica)
  function saveInjury() {
    if (!form.playerId) return alert("Seleziona un giocatore");

    setPlayers(players.map((p) => {
      if (String(p.id) !== String(form.playerId)) return p;

      const existingInjuries = p.injuries || [];

      if (editingPlayerId) {
        // Aggiorna infortunio attivo esistente
        return {
          ...p,
          status:          form.status,
          injuryType:      form.injuryType,
          injuryStartDate: form.injuryStartDate,
          expectedReturn:  form.expectedReturn,
          injuryNotes:     form.notes,
          injuries: existingInjuries.map((inj) =>
            !inj.endDate
              ? { ...inj, injuryType: form.injuryType, startDate: form.injuryStartDate, notes: form.notes }
              : inj
          ),
        };
      } else {
        // Nuovo infortunio — aggiungi a storico
        const newInjury = {
          id:          createId("injury"),
          injuryType:  form.injuryType,
          status:      form.status,
          startDate:   form.injuryStartDate,
          endDate:     null,
          expectedReturn: form.expectedReturn,
          notes:       form.notes,
          sessionsMissed: 0,
          matchesMissed:  0,
        };
        return {
          ...p,
          status:          form.status,
          injuryType:      form.injuryType,
          injuryStartDate: form.injuryStartDate,
          expectedReturn:  form.expectedReturn,
          injuryNotes:     form.notes,
          injuries:        [...existingInjuries, newInjury],
        };
      }
    }));

    setOpenModal(false);
  }

  // ── Segna rientro: chiude l'infortunio attivo e aggiorna lo storico
  function markRecovered(playerId) {
    if (!confirm("Segni il giocatore come recuperato?")) return;
    const today = new Date().toISOString().slice(0, 10);

    setPlayers(players.map((p) => {
      if (String(p.id) !== String(playerId)) return p;

      const activeInjury = (p.injuries || []).find((i) => !i.endDate);
      const { sessionsMissed, matchesMissed } = calcMissed(
        activeInjury?.startDate || p.injuryStartDate,
        today,
        sessions,
        matches
      );
      const daysOut = activeInjury?.startDate
        ? Math.max(0, Math.floor((new Date(today) - new Date(activeInjury.startDate)) / 86400000))
        : 0;

      return {
        ...p,
        status:          "Disponibile",
        injuryType:      "",
        injuryStartDate: "",
        expectedReturn:  "",
        injuryNotes:     "",
        injuries: (p.injuries || []).map((inj) =>
          !inj.endDate
            ? { ...inj, endDate: today, sessionsMissed, matchesMissed, daysOut }
            : inj
        ),
      };
    }));
  }

  const selectablePlayers = players.filter(
    (p) => !UNAVAILABLE.includes(p.status || "Disponibile") || String(p.id) === String(editingPlayerId)
  );

  return (
    <div style={styles.page}>
      <PageHeader
        title="Infortuni"
        subtitle="Gestisci stop e recuperi. I giocatori qui sotto non sono disponibili per le sedute."
        action={<Button onClick={openAdd}>+ Aggiungi infortunio</Button>}
      />

      {/* KPI + azione */}
      <div style={av.kpiRow}>
        <KpiPill label="Disponibili" value={availablePlayers.length} color="#22c55e" />
        {STATUS_OPTIONS.map((s) => {
          const n = players.filter((p) => p.status === s.value).length;
          return n > 0 ? <KpiPill key={s.value} label={s.value} value={n} color={s.color} /> : null;
        })}
        <div style={{ flex: 1 }} />
      </div>

      {/* Lista infortuni attivi */}
      {injuredPlayers.length === 0 ? (
        <EmptyState icon="🏥" title="Nessun infortunio attivo" text="Tutti i giocatori sono disponibili per gli allenamenti." />
      ) : (
        <div style={av.grid}>
          {injuredPlayers.map((player) => {
            const name = [player.firstName, player.lastName].filter(Boolean).join(" ") || player.name || "—";
            const st   = getStatusStyle(player.status);
            const activeInj = (player.injuries || []).find((i) => !i.endDate);
            const startDate = activeInj?.startDate || player.injuryStartDate || null;
            const daysOut   = startDate ? Math.floor((new Date() - new Date(startDate)) / 86400000) : null;
            const daysLeft  = player.expectedReturn
              ? Math.ceil((new Date(player.expectedReturn) - new Date()) / 86400000)
              : null;
            const pastInjuries = (player.injuries || []).filter((i) => i.endDate);

            return (
              <div key={player.id} style={{ ...av.card, borderColor: st.border, background: st.bg }}>
                {/* Header */}
                <div style={av.cardHeader}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ ...av.avatar, background: st.bg, border: `1.5px solid ${st.border}` }}>
                      <span style={{ fontSize: 16, fontWeight: 900, color: st.color }}>{name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <strong style={{ fontSize: 15, color: "#e2e8f0" }}>{name}</strong>
                      <p style={av.muted}>{player.role || "—"}{player.shirtNumber ? ` · #${player.shirtNumber}` : ""}</p>
                    </div>
                  </div>
                  <span style={{ ...av.badge, color: st.color, background: "rgba(0,0,0,0.2)", border: `1px solid ${st.border}` }}>
                    {player.status}
                  </span>
                </div>

                {/* Dettagli */}
                <div style={av.details}>
                  {player.injuryType && <InfoRow icon="🏥" label="Tipo" value={player.injuryType} />}
                  {daysOut !== null && (
                    <InfoRow icon="📅" label="Stop iniziato" value={`${startDate} · ${daysOut === 0 ? "oggi" : `${daysOut} gg fa`}`} />
                  )}
                  {player.expectedReturn && (
                    <InfoRow
                      icon="🔄"
                      label="Rientro previsto"
                      value={player.expectedReturn}
                      extra={daysLeft !== null && (
                        <span style={{ fontSize: 12, fontWeight: 800, marginLeft: 8, color: daysLeft <= 0 ? "#22c55e" : daysLeft <= 7 ? "#fb923c" : "#64748b" }}>
                          {daysLeft <= 0 ? "✓ Può rientrare" : `${daysLeft} giorni`}
                        </span>
                      )}
                    />
                  )}
                </div>

                {/* Azioni */}
                <div style={av.actions}>
                  {pastInjuries.length > 0 && (
                    <button
                      onClick={() => setHistoryPlayerId(historyPlayerId === player.id ? null : player.id)}
                      style={av.historyBtn}
                    >
                      Storico ({pastInjuries.length})
                    </button>
                  )}
                  <Button variant="ghost" onClick={() => openEdit(player)} style={{ flex: 1 }}>Modifica</Button>
                  <Button onClick={() => markRecovered(player.id)} style={{ flex: 1 }}>Rientro</Button>
                </div>

                {/* Storico infortuni inline */}
                {historyPlayerId === player.id && pastInjuries.length > 0 && (
                  <div style={av.historyBox}>
                    <p style={av.historyTitle}>Storico infortuni — {name}</p>
                    {[...pastInjuries].reverse().map((inj) => (
                      <div key={inj.id} style={av.historyRow}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{inj.injuryType || "—"}</span>
                          <span style={{ fontSize: 12, color: "#64748b" }}>{inj.startDate} → {inj.endDate}</span>
                        </div>
                        <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                          <StatPill color="#94a3b8" label="Giorni fuori" value={inj.daysOut ?? "—"} />
                          <StatPill color="#f87171" label="Sedute saltate" value={inj.sessionsMissed ?? 0} />
                          <StatPill color="#fb923c" label="Partite saltate" value={inj.matchesMissed ?? 0} />
                        </div>
                        {inj.notes && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>{inj.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Storico giocatori senza infortuni attivi */}
      {players.some((p) => !UNAVAILABLE.includes(p.status || "Disponibile") && (p.injuries || []).some((i) => i.endDate)) && (
        <AppCard>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, lineHeight: 1.2 }}>Storico infortuni risolti</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {players
              .filter((p) => !UNAVAILABLE.includes(p.status || "Disponibile") && (p.injuries || []).some((i) => i.endDate))
              .map((player) => {
                const name = [player.firstName, player.lastName].filter(Boolean).join(" ") || player.name || "—";
                const past = (player.injuries || []).filter((i) => i.endDate);
                const totalDays     = past.reduce((s, i) => s + (i.daysOut || 0), 0);
                const totalSessions = past.reduce((s, i) => s + (i.sessionsMissed || 0), 0);
                const totalMatches  = past.reduce((s, i) => s + (i.matchesMissed || 0), 0);

                return (
                  <div key={player.id} style={av.pastPlayerRow}>
                    <div>
                      <strong style={{ fontSize: 14, color: "#e2e8f0" }}>{name}</strong>
                      <p style={av.muted}>{player.role || "—"}</p>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <StatPill color="#94a3b8" label="Infortuni" value={past.length} />
                      <StatPill color="#64748b" label="Giorni totali" value={totalDays} />
                      <StatPill color="#f87171" label="Sedute saltate" value={totalSessions} />
                      <StatPill color="#fb923c" label="Partite saltate" value={totalMatches} />
                      <button onClick={() => setHistoryPlayerId(historyPlayerId === player.id ? null : player.id)} style={av.historyBtn}>
                        {historyPlayerId === player.id ? "Chiudi" : "Dettaglio"}
                      </button>
                    </div>
                    {historyPlayerId === player.id && (
                      <div style={{ ...av.historyBox, gridColumn: "1 / -1", marginTop: 4 }}>
                        {[...past].reverse().map((inj) => (
                          <div key={inj.id} style={av.historyRow}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{inj.injuryType || "—"}</span>
                              <span style={{ fontSize: 12, color: "#64748b" }}>{inj.startDate} → {inj.endDate}</span>
                            </div>
                            <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                              <StatPill color="#94a3b8" label="Giorni fuori" value={inj.daysOut ?? "—"} />
                              <StatPill color="#f87171" label="Sedute saltate" value={inj.sessionsMissed ?? 0} />
                              <StatPill color="#fb923c" label="Partite saltate" value={inj.matchesMissed ?? 0} />
                            </div>
                            {inj.notes && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>{inj.notes}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </AppCard>
      )}

      {/* Modal aggiungi / modifica */}
      {openModal && (
        <Modal
          title={editingPlayerId ? "Modifica infortunio" : "Aggiungi infortunio"}
          onClose={() => setOpenModal(false)}
        >
          <div style={{ display: "grid", gap: 14 }}>
            {!editingPlayerId && (
              <div style={{ display: "grid", gap: 6 }}>
                <label style={av.fieldLabel}>Giocatore *</label>
                <select value={form.playerId} onChange={(e) => setForm({ ...form, playerId: e.target.value })} style={styles.input}>
                  <option value="">Seleziona giocatore...</option>
                  {selectablePlayers.map((p) => {
                    const n = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "—";
                    return <option key={p.id} value={p.id}>{n}{p.shirtNumber ? ` (#${p.shirtNumber})` : ""}</option>;
                  })}
                </select>
              </div>
            )}

            <div style={{ display: "grid", gap: 6 }}>
              <label style={av.fieldLabel}>Status</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {STATUS_OPTIONS.map((s) => (
                  <button key={s.value} type="button" onClick={() => setForm({ ...form, status: s.value })} style={{
                    borderRadius: 9, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    color: form.status === s.value ? s.color : "#94a3b8",
                    background: form.status === s.value ? s.bg : "rgba(255,255,255,0.04)",
                    border: `1px solid ${form.status === s.value ? s.border : "rgba(255,255,255,0.08)"}`,
                  }}>
                    {s.value}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={av.fieldLabel}>Tipo infortunio</label>
              <select value={form.injuryType} onChange={(e) => setForm({ ...form, injuryType: e.target.value })} style={styles.input}>
                <option value="">Seleziona tipo...</option>
                {INJURY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={av.fieldLabel}>Data inizio</label>
                <input type="date" value={form.injuryStartDate} onChange={(e) => setForm({ ...form, injuryStartDate: e.target.value })} style={styles.input} />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={av.fieldLabel}>Rientro previsto</label>
                <input type="date" value={form.expectedReturn} onChange={(e) => setForm({ ...form, expectedReturn: e.target.value })} style={styles.input} />
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={av.fieldLabel}>Note</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Dettagli, fase di recupero, limitazioni..."
                style={{ ...styles.input, minHeight: 72, resize: "vertical" }} />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <Button variant="ghost" onClick={() => setOpenModal(false)}>Annulla</Button>
            <Button onClick={saveInjury}>{editingPlayerId ? "Aggiorna" : "Aggiungi"}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── UI helpers ───────────────────────────────
function KpiPill({ label, value, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8" }}>{label}</span>
      <strong style={{ fontSize: 15, color: "#e2e8f0" }}>{value}</strong>
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <span style={{ fontSize: 12, color: "#94a3b8", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "3px 9px" }}>
      <strong style={{ color }}>{value}</strong> {label}
    </span>
  );
}

function InfoRow({ icon, label, value, extra }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", whiteSpace: "nowrap" }}>{label}:</span>
      <span style={{ fontSize: 13, color: "#cbd5e1" }}>{value}</span>
      {extra}
    </div>
  );
}

const av = {
  kpiRow:     { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 20, padding: 16, borderRadius: 18, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" },
  grid:       { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 },
  card:       { borderRadius: 14, padding: 18, border: "1px solid", display: "grid", gap: 14 },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  avatar:     { width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", flexShrink: 0 },
  badge:      { fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 8, textTransform: "uppercase", letterSpacing: 0, whiteSpace: "nowrap" },
  details:    { display: "grid", gap: 6, paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.06)" },
  actions:    { display: "flex", gap: 8, flexWrap: "wrap" },
  historyBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "6px 12px", color: "#94a3b8", cursor: "pointer", fontSize: 12, fontWeight: 700 },
  historyBox: { background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: 14, display: "grid", gap: 10, border: "1px solid rgba(255,255,255,0.06)" },
  historyTitle:{ margin: "0 0 6px", fontSize: 13, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0 },
  historyRow: { paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.05)" },
  pastPlayerRow: { display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center", padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", flexWrap: "wrap" },
  muted:      { color: "#64748b", margin: "3px 0 0", fontSize: 12, lineHeight: 1.35 },
  fieldLabel: { fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0, color: "#64748b" },
};
