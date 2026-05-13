import { useMemo, useState } from "react";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import { emptyPhysicalTest } from "../data/initialData";
import { styles } from "../styles/index.js";
import { createId, formatShortDate, getPhysicalReference, normalizeAppSettings } from "../utils/helpers";

export default function PhysicalTests({ players = [], physicalTests = [], setPhysicalTests, appSettings }) {
  const [form, setForm] = useState(emptyPhysicalTest());
  const settings = normalizeAppSettings(appSettings);

  const latestByPlayer = useMemo(() => {
    return players.map((player) => {
      const latest = physicalTests
        .filter((test) => String(test.playerId) === String(player.id))
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      return { player, latest };
    });
  }, [players, physicalTests]);

  const referenceRows = useMemo(
    () =>
      latestByPlayer.map(({ player, latest }) => ({
        player,
        latest,
        reference: getPhysicalReference(latest, settings.coachParameters),
      })),
    [latestByPlayer, settings.coachParameters]
  );

  function saveTest() {
    if (!form.playerId) {
      alert("Seleziona un giocatore");
      return;
    }

    setPhysicalTests([
      ...physicalTests,
      {
        ...form,
        id: createId("physical-test"),
      },
    ]);
    setForm(emptyPhysicalTest());
  }

  function deleteTest(id) {
    if (!confirm("Eliminare questo test fisico?")) return;
    setPhysicalTests(physicalTests.filter((test) => test.id !== id));
  }

  return (
    <div style={styles.page}>
      <PageHeader
        title="Test fisici"
        subtitle="Sprint, salto, Yo-Yo, peso e note atletiche per giocatore"
      />

      <div style={testStyles.grid}>
        <AppCard>
          <h3 style={{ marginTop: 0 }}>Nuovo test</h3>
          <div style={testStyles.form}>
            <select value={form.playerId} onChange={(event) => setForm({ ...form, playerId: event.target.value })} style={styles.input}>
              <option value="">Giocatore</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
            <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} style={styles.input} />
            <input placeholder="Gacon livello es. 22" value={form.gaconLevel} onChange={(event) => setForm({ ...form, gaconLevel: event.target.value })} style={styles.input} />
            <input placeholder="10m sprint" value={form.sprint10m} onChange={(event) => setForm({ ...form, sprint10m: event.target.value })} style={styles.input} />
            <input placeholder="30m sprint" value={form.sprint30m} onChange={(event) => setForm({ ...form, sprint30m: event.target.value })} style={styles.input} />
            <input placeholder="Salto cm" value={form.jumpCm} onChange={(event) => setForm({ ...form, jumpCm: event.target.value })} style={styles.input} />
            <input placeholder="Yo-Yo" value={form.yoYo} onChange={(event) => setForm({ ...form, yoYo: event.target.value })} style={styles.input} />
            <input placeholder="Peso" value={form.weight} onChange={(event) => setForm({ ...form, weight: event.target.value })} style={styles.input} />
            <input placeholder="% massa grassa" value={form.bodyFat} onChange={(event) => setForm({ ...form, bodyFat: event.target.value })} style={styles.input} />
            <textarea placeholder="Note" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} style={{ ...styles.input, minHeight: 90, gridColumn: "1 / -1" }} />
          </div>
          <Button onClick={saveTest}>Salva test</Button>
        </AppCard>

        <AppCard>
          <h3 style={{ marginTop: 0 }}>Gruppi e riferimenti</h3>
          <div style={testStyles.latestList}>
            {referenceRows.map(({ player, latest, reference }) => (
              <div key={player.id} style={testStyles.latestRow}>
                <div style={testStyles.rowHeader}>
                  <strong>{player.name}</strong>
                  <Badge tone={reference.group === "Gruppo A" ? "green" : reference.group === "Gruppo D" ? "red" : "blue"}>
                    {reference.group}
                  </Badge>
                </div>
                {latest ? (
                  <>
                    <span>
                      {formatShortDate(latest.date)} · MAS {reference.mas || "-"} km/h · {reference.intensity}
                    </span>
                    <div style={testStyles.repGrid}>
                      {reference.reps.map((rep) => (
                        <span key={rep.label}>{rep.label}: {rep.meters}m</span>
                      ))}
                    </div>
                  </>
                ) : (
                  <span>Nessun test registrato</span>
                )}
              </div>
            ))}
          </div>
        </AppCard>
      </div>

      <AppCard>
        <h3 style={{ marginTop: 0 }}>Storico test</h3>
        {physicalTests.length === 0 ? (
          <EmptyState title="Nessun test fisico" text="Registra il primo test per iniziare lo storico atletico." />
        ) : (
          <div style={testStyles.history}>
            {physicalTests.map((test) => {
              const player = players.find((item) => String(item.id) === String(test.playerId));
              return (
                <div key={test.id} style={testStyles.testCard}>
                  <Badge tone="blue">{formatShortDate(test.date)}</Badge>
                  <strong>{player?.name || "Giocatore"}</strong>
                  <span>Gacon {test.gaconLevel || "-"} · 10m {test.sprint10m || "-"} · 30m {test.sprint30m || "-"} · salto {test.jumpCm || "-"} · Yo-Yo {test.yoYo || "-"}</span>
                  <PhysicalReference test={test} parameters={settings.coachParameters} />
                  {test.notes && <p>{test.notes}</p>}
                  <Button variant="danger" onClick={() => deleteTest(test.id)}>Elimina</Button>
                </div>
              );
            })}
          </div>
        )}
      </AppCard>
    </div>
  );
}

function PhysicalReference({ test, parameters }) {
  const reference = getPhysicalReference(test, parameters);

  if (!reference.mas) {
    return <span>Inserisci Gacon o Yo-Yo per generare riferimenti.</span>;
  }

  return (
    <div style={testStyles.referenceBox}>
      <strong>{reference.group} · MAS {reference.mas} km/h</strong>
      <span>{reference.intensity}</span>
      <div style={testStyles.repGrid}>
        {reference.reps.map((rep) => (
          <span key={rep.label}>{rep.label}: {rep.meters}m</span>
        ))}
      </div>
    </div>
  );
}

const testStyles = {
  grid: { display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 22, alignItems: "start", marginBottom: 22 },
  form: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 16 },
  latestList: { display: "grid", gap: 10 },
  latestRow: { display: "grid", gap: 5, padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: "#cbd5e1" },
  rowHeader: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" },
  repGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 6, color: "#94a3b8", fontSize: 12 },
  referenceBox: { display: "grid", gap: 6, padding: 10, borderRadius: 12, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)" },
  history: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 },
  testCard: { display: "grid", gap: 9, padding: 14, borderRadius: 16, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" },
};
