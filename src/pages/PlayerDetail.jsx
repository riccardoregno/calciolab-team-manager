import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import PageHeader from "../components/ui/PageHeader";
import AppCard from "../components/ui/AppCard";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";

import { styles } from "../styles/index.js";
import { formatShortDate, getPhysicalReference, getPlayerSummary } from "../utils/helpers";

function PlayerDetail({ players, setPlayers, sessions = [], matches = [], physicalTests = [] }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const player = useMemo(
    () => players.find((p) => String(p.id) === String(id)),
    [players, id]
  );

  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({
    ...player,
  });

  const summary = useMemo(
    () => getPlayerSummary(player, { sessions, matches, physicalTests }),
    [player, sessions, matches, physicalTests]
  );

  if (!player) {
    return (
      <div style={styles.page}>
        <PageHeader
          title="Giocatore non trovato"
          subtitle="Il profilo richiesto non esiste"
        />
      </div>
    );
  }

  function updateField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleImageUpload(file) {
    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      setForm((prev) => ({
        ...prev,
        photo: reader.result,
      }));
    };

    reader.readAsDataURL(file);
  }

  function savePlayer() {
    setPlayers(
      players.map((p) =>
        p.id === player.id ? form : p
      )
    );

    setEditing(false);
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title={player.name}
        subtitle="Scheda giocatore e database individuale"
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "340px 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        <AppCard>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            {form.photo ? (
              <img
                src={form.photo}
                alt={form.name}
                style={{
                  width: 180,
                  height: 180,
                  borderRadius: 28,
                  objectFit: "cover",
                  marginBottom: 18,
                  border: "2px solid rgba(255,255,255,0.08)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 180,
                  height: 180,
                  borderRadius: 28,
                  background:
                    "linear-gradient(135deg,#2563eb,#38bdf8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 52,
                  fontWeight: 900,
                  marginBottom: 18,
                }}
              >
                {form.name?.[0] || "P"}
              </div>
            )}

            <h2 style={{ marginBottom: 6 }}>
              {form.name}
            </h2>

            <p style={{ color: "#94a3b8" }}>
              {form.role || "Ruolo"}
            </p>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                justifyContent: "center",
                marginTop: 12,
              }}
            >
              <Badge tone="blue">
                #{form.shirtNumber || "-"}
              </Badge>

              <Badge
                tone={
                  form.status === "Infortunato"
                    ? "red"
                    : form.status === "Recupero"
                    ? "orange"
                    : "green"
                }
              >
                {form.status || "Disponibile"}
              </Badge>
            </div>

            {editing && (
              <div style={{ marginTop: 20, width: "100%" }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleImageUpload(e.target.files[0])
                  }
                  style={styles.input}
                />
              </div>
            )}
          </div>
          </AppCard>

          <AppCard>
            <h3 style={{ marginTop: 0 }}>Alert individuali</h3>
            {summary.alerts.length ? (
              <div style={detailStyles.alertList}>
                {summary.alerts.map((alert) => (
                  <Badge key={alert} tone="orange">{alert}</Badge>
                ))}
              </div>
            ) : (
              <p style={detailStyles.muted}>Nessun alert prioritario.</p>
            )}
          </AppCard>

        <div style={{ display: "grid", gap: 20 }}>
          <div style={detailStyles.kpiGrid}>
            <MiniKpi label="Presenze" value={summary.stats.presences} />
            <MiniKpi label="Minuti" value={summary.stats.minutes} />
            <MiniKpi label="Gol" value={summary.stats.goals} />
            <MiniKpi label="Assist" value={summary.stats.assists} />
            <MiniKpi label="RPE medio" value={summary.stats.avgRpe || "-"} />
            <MiniKpi label="Carico" value={summary.stats.load || "-"} />
          </div>

          <AppCard>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>
                  Informazioni giocatore
                </h3>

                <p
                  style={{
                    color: "#94a3b8",
                    margin: "6px 0 0",
                  }}
                >
                  Database tecnico e anagrafico
                </p>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                {editing ? (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => setEditing(false)}
                    >
                      Annulla
                    </Button>

                    <Button onClick={savePlayer}>
                      Salva
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => {
                      setForm({ ...player });
                      setEditing(true);
                    }}
                  >
                    Modifica
                  </Button>
                )}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(220px,1fr))",
                gap: 14,
              }}
            >
              <Field
                label="Nome"
                value={form.name}
                editing={editing}
                onChange={(value) =>
                  updateField("name", value)
                }
              />

              <Field
                label="Ruolo"
                value={form.role}
                editing={editing}
                onChange={(value) =>
                  updateField("role", value)
                }
              />

              <Field
                label="Numero maglia"
                value={form.shirtNumber}
                editing={editing}
                onChange={(value) =>
                  updateField("shirtNumber", value)
                }
              />

              <Field
                label="Piede"
                value={form.foot}
                editing={editing}
                onChange={(value) =>
                  updateField("foot", value)
                }
              />

              <Field
                label="Altezza"
                value={form.height}
                editing={editing}
                onChange={(value) =>
                  updateField("height", value)
                }
              />

              <Field
                label="Peso"
                value={form.weight}
                editing={editing}
                onChange={(value) =>
                  updateField("weight", value)
                }
              />

              <Field
                label="Nazionalità"
                value={form.nationality}
                editing={editing}
                onChange={(value) =>
                  updateField("nationality", value)
                }
              />

              <Field
                label="Data nascita"
                value={form.birthDate}
                editing={editing}
                onChange={(value) =>
                  updateField("birthDate", value)
                }
              />
            </div>
          </AppCard>

          <AppCard>
            <h3 style={{ marginTop: 0 }}>
              Area tecnica
            </h3>

            <div
              style={{
                display: "grid",
                gap: 14,
              }}
            >
              <TextAreaField
                label="Punti di forza"
                value={form.strengths}
                editing={editing}
                onChange={(value) =>
                  updateField("strengths", value)
                }
              />

              <TextAreaField
                label="Da migliorare"
                value={form.improvements}
                editing={editing}
                onChange={(value) =>
                  updateField("improvements", value)
                }
              />

              <TextAreaField
                label="Obiettivi individuali"
                value={form.individualGoals}
                editing={editing}
                onChange={(value) =>
                  updateField("individualGoals", value)
                }
              />

              <TextAreaField
                label="Obiettivo settimanale"
                value={form.weeklyGoal}
                editing={editing}
                onChange={(value) =>
                  updateField("weeklyGoal", value)
                }
              />
            </div>
          </AppCard>

          <AppCard>
            <h3 style={{ marginTop: 0 }}>
              Stato fisico
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(220px,1fr))",
                gap: 14,
              }}
            >
            
            <div>
  <div
    style={{
      color: "#94a3b8",
      fontSize: 12,
      fontWeight: 800,
      marginBottom: 8,
      textTransform: "uppercase",
    }}
  >
    Status
  </div>

  {editing ? (
    <select
      value={form.status || "Disponibile"}
      onChange={(e) =>
        updateField("status", e.target.value)
      }
      style={styles.input}
    >
      <option>Disponibile</option>
      <option>Recupero</option>
      <option>Infortunato</option>
      <option>Permesso</option>
    </select>
  ) : (
    <div
      style={{
        borderRadius: 16,
        padding: 14,
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {form.status || "Disponibile"}
    </div>
  )}
</div>

              <Field
                label="Problema fisico"
                value={form.injuryType}
                editing={editing}
                onChange={(value) =>
                  updateField("injuryType", value)
                }
              />

              <Field
                label="Rientro previsto"
                value={form.expectedReturn}
                editing={editing}
                onChange={(value) =>
                  updateField("expectedReturn", value)
                }
              />
            </div>
          </AppCard>

          <div style={detailStyles.twoGrid}>
            <AppCard>
              <h3 style={{ marginTop: 0 }}>Test fisici recenti</h3>
              {summary.latestTests.length ? (
                <div style={detailStyles.list}>
                  {summary.latestTests.map((test) => {
                    const reference = getPhysicalReference(test);
                    return (
                      <div key={test.id} style={detailStyles.listItem}>
                        <Badge tone="blue">{formatShortDate(test.date)}</Badge>
                        <strong>{reference.group} · MAS {reference.mas || "-"}</strong>
                        <span>Gacon {test.gaconLevel || "-"} · 10m {test.sprint10m || "-"} · salto {test.jumpCm || "-"}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={detailStyles.muted}>Nessun test registrato.</p>
              )}
            </AppCard>

            <AppCard>
              <h3 style={{ marginTop: 0 }}>Storico recente</h3>
              {summary.recentEvents.length ? (
                <div style={detailStyles.list}>
                  {summary.recentEvents.map(({ event, data }) => (
                    <div key={`${event.type}-${event.id}`} style={detailStyles.listItem}>
                      <Badge tone={event.type === "Partita" ? "orange" : "green"}>{event.type}</Badge>
                      <strong>{event.title}</strong>
                      <span>{formatShortDate(event.date)} · {data.status} · {data.minutes || 0} min · {data.goals || 0} gol · {data.assists || 0} assist</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={detailStyles.muted}>Nessun evento registrato.</p>
              )}
            </AppCard>
          </div>

          <Button
            variant="ghost"
            onClick={() => navigate("/players")}
          >
            ← Torna alla rosa
          </Button>
        </div>
      </div>
    </div>
  );
}

function MiniKpi({ label, value }) {
  return (
    <AppCard>
      <span style={detailStyles.kpiLabel}>{label}</span>
      <strong style={detailStyles.kpiValue}>{value}</strong>
    </AppCard>
  );
}

function Field({
  label,
  value,
  editing,
  onChange,
}) {
  return (
    <div>
      <div
        style={{
          color: "#94a3b8",
          fontSize: 12,
          fontWeight: 800,
          marginBottom: 8,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>

      {editing ? (
        <input
          value={value || ""}
          onChange={(e) =>
            onChange(e.target.value)
          }
          style={styles.input}
        />
      ) : (
        <div
          style={{
            borderRadius: 16,
            padding: 14,
            background:
              "rgba(255,255,255,0.045)",
            border:
              "1px solid rgba(255,255,255,0.08)",
            minHeight: 48,
            display: "flex",
            alignItems: "center",
          }}
        >
          {value || "-"}
        </div>
      )}
    </div>
  );
}

function TextAreaField({
  label,
  value,
  editing,
  onChange,
}) {
  return (
    <div>
      <div
        style={{
          color: "#94a3b8",
          fontSize: 12,
          fontWeight: 800,
          marginBottom: 8,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>

      {editing ? (
        <textarea
          value={value || ""}
          onChange={(e) =>
            onChange(e.target.value)
          }
          style={{
            ...styles.input,
            minHeight: 100,
          }}
        />
      ) : (
        <div
          style={{
            borderRadius: 16,
            padding: 16,
            background:
              "rgba(255,255,255,0.045)",
            border:
              "1px solid rgba(255,255,255,0.08)",
            lineHeight: 1.6,
            color: "#cbd5e1",
          }}
        >
          {value || "-"}
        </div>
      )}
    </div>
  );
}

const detailStyles = {
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
    gap: 12,
  },
  kpiLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  kpiValue: {
    display: "block",
    marginTop: 8,
    fontSize: 26,
  },
  twoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
  },
  list: {
    display: "grid",
    gap: 10,
  },
  listItem: {
    display: "grid",
    gap: 6,
    padding: 12,
    borderRadius: 14,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#cbd5e1",
  },
  alertList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  muted: {
    color: "#94a3b8",
    margin: 0,
  },
};

export default PlayerDetail;
