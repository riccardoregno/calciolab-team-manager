import AppCard from "../ui/AppCard";
import Badge from "../ui/Badge";
import Button from "../ui/Button";

import { styles } from "../../styles/index.js";
import { formatShortDate, getPhysicalReference } from "../../utils/helpers";

const PLAYER_TABS = [
  { key: "profilo", label: "Profilo" },
  { key: "statistiche", label: "Statistiche" },
  { key: "fisico", label: "Stato fisico" },
  { key: "medico", label: "Storico medico" },
  { key: "sviluppo", label: "Sviluppo" },
];

export function PlayerSidebar({ form, editing, onImageUpload, summary }) {
  return (
    <>
      <AppCard>
        <div style={sectionStyles.sidebarProfile}>
          {form.photo ? (
            <img src={form.photo} alt={form.name} style={sectionStyles.avatarImage} />
          ) : (
            <div style={sectionStyles.avatarFallback}>{form.name?.[0] || "P"}</div>
          )}

          <h2 style={{ marginBottom: 6 }}>{form.name}</h2>
          <p style={{ color: "#94a3b8" }}>{form.role || "Ruolo"}</p>

          <div style={sectionStyles.badgeRow}>
            <Badge tone="blue">#{form.shirtNumber || "-"}</Badge>
            <Badge tone={getStatusTone(form.status)}>{form.status || "Disponibile"}</Badge>
          </div>

          {editing && (
            <div style={{ marginTop: 20, width: "100%" }}>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => onImageUpload(event.target.files[0])}
                style={styles.input}
              />
            </div>
          )}
        </div>
      </AppCard>

      <AppCard>
        <h3 style={{ marginTop: 0 }}>Alert individuali</h3>
        {summary.alerts.length ? (
          <div style={sectionStyles.alertList}>
            {summary.alerts.map((alert) => (
              <Badge key={alert} tone="orange">{alert}</Badge>
            ))}
          </div>
        ) : (
          <p style={sectionStyles.muted}>Nessun alert prioritario.</p>
        )}
      </AppCard>
    </>
  );
}

export function PlayerTabs({ activeTab, onChange }) {
  return (
    <div style={sectionStyles.tabRow}>
      {PLAYER_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          style={{
            ...sectionStyles.tabButton,
            ...(activeTab === tab.key ? sectionStyles.tabButtonActive : {}),
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function PlayerKpiStrip({ summary }) {
  return (
    <div style={sectionStyles.kpiGrid}>
      <MiniKpi label="Presenze" value={summary.stats.presences} />
      <MiniKpi label="Minuti" value={summary.stats.minutes} />
      <MiniKpi label="Gol" value={summary.stats.goals} />
      <MiniKpi label="Assist" value={summary.stats.assists} />
      <MiniKpi label="RPE medio" value={summary.stats.avgRpe || "-"} />
      <MiniKpi label="Carico" value={summary.stats.load || "-"} />
    </div>
  );
}

export function PlayerProfileTab({ form, player, editing, onEdit, onCancel, onSave, onFieldChange }) {
  return (
    <AppCard>
      <div style={sectionStyles.cardHeader}>
        <div>
          <h3 style={{ margin: 0 }}>Informazioni giocatore</h3>
          <p style={sectionStyles.cardSubtitle}>Database tecnico e anagrafico</p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {editing ? (
            <>
              <Button variant="ghost" onClick={onCancel}>Annulla</Button>
              <Button onClick={onSave}>Salva</Button>
            </>
          ) : (
            <Button onClick={() => onEdit(player)}>Modifica</Button>
          )}
        </div>
      </div>

      <div style={sectionStyles.formGrid}>
        <Field label="Nome" value={form.name} editing={editing} onChange={(value) => onFieldChange("name", value)} />
        <Field label="Ruolo" value={form.role} editing={editing} onChange={(value) => onFieldChange("role", value)} />
        <Field label="Numero maglia" value={form.shirtNumber} editing={editing} onChange={(value) => onFieldChange("shirtNumber", value)} />
        <Field label="Piede" value={form.foot} editing={editing} onChange={(value) => onFieldChange("foot", value)} />
        <Field label="Altezza" value={form.height} editing={editing} onChange={(value) => onFieldChange("height", value)} />
        <Field label="Peso" value={form.weight} editing={editing} onChange={(value) => onFieldChange("weight", value)} />
        <Field label="Nazionalità" value={form.nationality} editing={editing} onChange={(value) => onFieldChange("nationality", value)} />
        <Field label="Data nascita" value={form.birthDate} editing={editing} onChange={(value) => onFieldChange("birthDate", value)} />
      </div>
    </AppCard>
  );
}

export function PlayerDevelopmentTab({ form, editing, onFieldChange }) {
  return (
    <AppCard>
      <h3 style={{ marginTop: 0 }}>Area tecnica</h3>
      <div style={{ display: "grid", gap: 14 }}>
        <TextAreaField label="Punti di forza" value={form.strengths} editing={editing} onChange={(value) => onFieldChange("strengths", value)} />
        <TextAreaField label="Da migliorare" value={form.improvements} editing={editing} onChange={(value) => onFieldChange("improvements", value)} />
        <TextAreaField label="Obiettivi individuali" value={form.individualGoals} editing={editing} onChange={(value) => onFieldChange("individualGoals", value)} />
        <TextAreaField label="Obiettivo settimanale" value={form.weeklyGoal} editing={editing} onChange={(value) => onFieldChange("weeklyGoal", value)} />
      </div>
    </AppCard>
  );
}

export function PlayerPhysicalTab({ form, editing, latestTests, onFieldChange }) {
  return (
    <>
      <AppCard>
        <h3 style={{ marginTop: 0 }}>Stato fisico</h3>
        <div style={sectionStyles.formGrid}>
          <StatusField value={form.status} editing={editing} onChange={(value) => onFieldChange("status", value)} />
          <Field label="Problema fisico" value={form.injuryType} editing={editing} onChange={(value) => onFieldChange("injuryType", value)} />
          <Field label="Lavoro differenziato" value={form.differentiatedType} editing={editing} onChange={(value) => onFieldChange("differentiatedType", value)} />
          <Field label="Rientro previsto" value={form.expectedReturn} editing={editing} onChange={(value) => onFieldChange("expectedReturn", value)} />
        </div>
      </AppCard>

      <AppCard>
        <h3 style={{ marginTop: 0 }}>Test fisici recenti</h3>
        {latestTests.length ? (
          <div style={sectionStyles.list}>
            {latestTests.map((test) => {
              const reference = getPhysicalReference(test);
              return (
                <div key={test.id} style={sectionStyles.listItem}>
                  <Badge tone="blue">{formatShortDate(test.date)}</Badge>
                  <strong>{reference.group} · MAS {reference.mas || "-"}</strong>
                  <span>Gacon {test.gaconLevel || "-"} · 10m {test.sprint10m || "-"} · salto {test.jumpCm || "-"}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={sectionStyles.muted}>Nessun test registrato.</p>
        )}
      </AppCard>
    </>
  );
}

export function PlayerMedicalTab({
  activeInjuries,
  injuryHistory,
  pastInjuries,
  totalDaysOut,
  totalSessionsMissed,
  totalMatchesMissed,
  generalInjuryNotes,
  preventionRecommendations,
  onCreateDifferentiatedWork,
  onAddMedicalNote,
  onMarkRecovered,
}) {
  return (
    <AppCard>
      <div style={sectionStyles.cardHeader}>
        <div>
          <h3 style={{ margin: 0 }}>Storico medico</h3>
          <p style={sectionStyles.cardSubtitle}>Infortuni, rientri, sedute saltate e lavoro differenziato</p>
        </div>
        <Badge tone={activeInjuries.length ? "red" : "green"}>
          {activeInjuries.length ? `${activeInjuries.length} attivi` : "Nessun attivo"}
        </Badge>
      </div>

      <div style={sectionStyles.quickActions}>
        <Button variant="ghost" onClick={onCreateDifferentiatedWork}>Crea lavoro differenziato</Button>
        <Button variant="ghost" onClick={onAddMedicalNote}>Aggiungi nota</Button>
        <Button variant="ghost" onClick={onMarkRecovered} disabled={!activeInjuries.length}>Segna rientro</Button>
      </div>

      <div style={sectionStyles.medicalKpiGrid}>
        <MiniKpi label="Totale infortuni" value={injuryHistory.length} />
        <MiniKpi label="Rientrati" value={pastInjuries.length} />
        <MiniKpi label="Giorni out" value={totalDaysOut} />
        <MiniKpi label="Sedute perse" value={totalSessionsMissed} />
        <MiniKpi label="Partite perse" value={totalMatchesMissed} />
      </div>

      <div style={sectionStyles.preventionBox}>
        <div style={sectionStyles.preventionHeader}>
          <strong>Prevenzione consigliata</strong>
          <Badge tone="blue">{preventionRecommendations.length} schede</Badge>
        </div>
        {preventionRecommendations.length ? (
          <div style={sectionStyles.preventionGrid}>
            {preventionRecommendations.map((item) => (
              <div key={item.title} style={sectionStyles.preventionCard}>
                <div style={sectionStyles.preventionCardTop}>
                  <strong>{item.title}</strong>
                  <span style={sectionStyles.preventionTag}>{item.reason}</span>
                </div>
                <ul style={sectionStyles.preventionList}>
                  {item.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p style={sectionStyles.muted}>Nessuna scheda suggerita: aggiungi uno storico medico per generare indicazioni mirate.</p>
        )}
      </div>

      {generalInjuryNotes && (
        <div style={sectionStyles.generalNotes}>
          <strong>Note generali</strong>
          <p>{generalInjuryNotes}</p>
        </div>
      )}

      {injuryHistory.length ? (
        <div style={sectionStyles.injuryTimeline}>
          {injuryHistory.map((injury, index) => (
            <div key={injury.id || `${injury.startDate}-${injury.injuryType}-${index}`} style={sectionStyles.injuryItem}>
              <div style={sectionStyles.injuryItemTop}>
                <div>
                  <strong style={sectionStyles.injuryTitle}>{injury.injuryType || "Infortunio"}</strong>
                  <p style={sectionStyles.injuryDates}>
                    {injury.startDate || "Data non inserita"} → {injury.endDate || injury.expectedReturn || "in corso"}
                  </p>
                </div>
                <Badge tone={injury.endDate ? "green" : "red"}>{injury.endDate ? "Rientrato" : "Attivo"}</Badge>
              </div>

              <div style={sectionStyles.injuryMeta}>
                {injury.daysOut != null && <span>{injury.daysOut} giorni fuori</span>}
                {injury.sessionsMissed != null && <span>{injury.sessionsMissed} sedute saltate</span>}
                {injury.matchesMissed != null && <span>{injury.matchesMissed} partite saltate</span>}
                {injury.differentiatedType && <span>Lavoro: {injury.differentiatedType}</span>}
              </div>

              {injury.notes && <p style={sectionStyles.injuryNotes}>{injury.notes}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p style={sectionStyles.muted}>Nessun infortunio registrato per questo giocatore.</p>
      )}
    </AppCard>
  );
}

export function PlayerStatsTab({ summary }) {
  return (
    <AppCard>
      <h3 style={{ marginTop: 0 }}>Storico recente</h3>
      {summary.recentEvents.length ? (
        <div style={sectionStyles.list}>
          {summary.recentEvents.map(({ event, data }) => (
            <div key={`${event.type}-${event.id}`} style={sectionStyles.listItem}>
              <Badge tone={event.type === "Partita" ? "orange" : "green"}>{event.type}</Badge>
              <strong>{event.title}</strong>
              <span>{formatShortDate(event.date)} · {data.status} · {data.minutes || 0} min · {data.goals || 0} gol · {data.assists || 0} assist</span>
            </div>
          ))}
        </div>
      ) : (
        <p style={sectionStyles.muted}>Nessun evento registrato.</p>
      )}
    </AppCard>
  );
}

function MiniKpi({ label, value }) {
  return (
    <AppCard>
      <span style={sectionStyles.kpiLabel}>{label}</span>
      <strong style={sectionStyles.kpiValue}>{value}</strong>
    </AppCard>
  );
}

function StatusField({ value, editing, onChange }) {
  return (
    <div>
      <FieldLabel>Status</FieldLabel>
      {editing ? (
        <select value={value || "Disponibile"} onChange={(event) => onChange(event.target.value)} style={styles.input}>
          <option>Disponibile</option>
          <option>Recupero</option>
          <option>Differenziato</option>
          <option>Infortunato</option>
          <option>Squalificato</option>
          <option>Permesso</option>
        </select>
      ) : (
        <ReadOnlyBox>{value || "Disponibile"}</ReadOnlyBox>
      )}
    </div>
  );
}

function Field({ label, value, editing, onChange }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {editing ? (
        <input value={value || ""} onChange={(event) => onChange(event.target.value)} style={styles.input} />
      ) : (
        <ReadOnlyBox>{value || "-"}</ReadOnlyBox>
      )}
    </div>
  );
}

function TextAreaField({ label, value, editing, onChange }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {editing ? (
        <textarea
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          style={{ ...styles.input, minHeight: 100 }}
        />
      ) : (
        <div style={sectionStyles.readOnlyText}>{value || "-"}</div>
      )}
    </div>
  );
}

function FieldLabel({ children }) {
  return <div style={sectionStyles.fieldLabel}>{children}</div>;
}

function ReadOnlyBox({ children }) {
  return <div style={sectionStyles.readOnlyBox}>{children}</div>;
}

function getStatusTone(status) {
  if (status === "Infortunato") return "red";
  if (status === "Recupero" || status === "Differenziato") return "orange";
  if (status === "Squalificato") return "purple";
  return "green";
}

const sectionStyles = {
  sidebarProfile: { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" },
  avatarImage: { width: 180, height: 180, borderRadius: 28, objectFit: "cover", marginBottom: 18, border: "2px solid rgba(255,255,255,0.08)" },
  avatarFallback: {
    width: 180,
    height: 180,
    borderRadius: 28,
    background: "linear-gradient(135deg,#2563eb,#38bdf8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 52,
    fontWeight: 900,
    marginBottom: 18,
  },
  badgeRow: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 12 },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12 },
  kpiLabel: { color: "#94a3b8", fontSize: 12, fontWeight: 900, textTransform: "uppercase" },
  kpiValue: { display: "block", marginTop: 8, fontSize: 26 },
  tabRow: { display: "flex", gap: 8, flexWrap: "wrap", padding: 6, borderRadius: 16, background: "rgba(15,23,42,0.55)", border: "1px solid rgba(255,255,255,0.08)" },
  tabButton: { minHeight: 38, border: "1px solid transparent", borderRadius: 12, background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 800, padding: "0 14px" },
  tabButtonActive: { background: "rgba(56,189,248,0.16)", borderColor: "rgba(56,189,248,0.35)", color: "#f8fafc" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 16, flexWrap: "wrap" },
  cardSubtitle: { color: "#94a3b8", margin: "6px 0 0", lineHeight: 1.45 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 },
  fieldLabel: { color: "#94a3b8", fontSize: 12, fontWeight: 800, marginBottom: 8, textTransform: "uppercase" },
  readOnlyBox: { borderRadius: 16, padding: 14, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", minHeight: 48, display: "flex", alignItems: "center" },
  readOnlyText: { borderRadius: 16, padding: 16, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", lineHeight: 1.6, color: "#cbd5e1" },
  medicalKpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12, marginBottom: 16 },
  quickActions: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 },
  preventionBox: { display: "grid", gap: 12, padding: 14, borderRadius: 14, background: "rgba(56,189,248,0.055)", border: "1px solid rgba(56,189,248,0.16)", marginBottom: 16 },
  preventionHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", color: "#e2e8f0" },
  preventionGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 },
  preventionCard: { padding: 12, borderRadius: 12, background: "rgba(15,23,42,0.55)", border: "1px solid rgba(255,255,255,0.08)" },
  preventionCardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8, color: "#f8fafc", fontSize: 13 },
  preventionTag: { flexShrink: 0, color: "#38bdf8", fontSize: 10, fontWeight: 900, textTransform: "uppercase" },
  preventionList: { margin: 0, paddingLeft: 18, display: "grid", gap: 5, color: "#94a3b8", fontSize: 12, lineHeight: 1.45 },
  list: { display: "grid", gap: 10 },
  listItem: { display: "grid", gap: 6, padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: "#cbd5e1" },
  alertList: { display: "flex", flexWrap: "wrap", gap: 8 },
  muted: { color: "#94a3b8", margin: 0 },
  injuryTimeline: { display: "grid", gap: 10 },
  generalNotes: {
    display: "grid",
    gap: 6,
    padding: 14,
    borderRadius: 14,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#cbd5e1",
    marginBottom: 16,
  },
  injuryItem: { padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" },
  injuryItemTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  injuryTitle: { color: "#e2e8f0", fontSize: 14 },
  injuryDates: { margin: "4px 0 0", color: "#94a3b8", fontSize: 12 },
  injuryMeta: { display: "flex", flexWrap: "wrap", gap: 8, color: "#94a3b8", fontSize: 12 },
  injuryNotes: { margin: "10px 0 0", color: "#64748b", fontSize: 12, lineHeight: 1.5 },
};
