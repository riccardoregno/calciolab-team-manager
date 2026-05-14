import { useState } from "react";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import { styles } from "../styles/index.js";
import { createId, normalizeAppSettings, normalizeSponsor } from "../utils/helpers";

const emptySponsor = {
  name: "",
  package: "Bronze",
  contact: "",
  website: "",
  logo: "",
  offer: "",
  visibility: "Dashboard, report PDF, pagina squadra",
  notes: "",
  active: true,
};

const packageValues = {
  Bronze: 500,
  Silver: 1200,
  Gold: 2500,
  Main: 5000,
};

export default function Sponsors({ appSettings = {}, setAppSettings }) {
  const settings = normalizeAppSettings(appSettings);
  const hub = settings.sponsorHub;
  const [form, setForm] = useState(emptySponsor);
  const [editingId, setEditingId] = useState("");

  const activeSponsors = hub.sponsors.filter((sponsor) => sponsor.active);
  const yearlyValue = activeSponsors.reduce(
    (sum, sponsor) => sum + (packageValues[sponsor.package] || 0),
    0
  );
  const mainSponsor = hub.sponsors.find((sponsor) => String(sponsor.id) === String(hub.mainSponsorId));

  function updateHub(patch) {
    setAppSettings?.({
      ...settings,
      sponsorHub: {
        ...hub,
        ...patch,
      },
    });
  }

  function submitSponsor(event) {
    event.preventDefault();

    const sponsor = normalizeSponsor({
      ...form,
      id: editingId || createId("sponsor"),
    });
    const sponsors = editingId
      ? hub.sponsors.map((item) => (String(item.id) === String(editingId) ? sponsor : item))
      : [...hub.sponsors, sponsor];

    updateHub({ sponsors });
    setForm(emptySponsor);
    setEditingId("");
  }

  function editSponsor(sponsor) {
    setEditingId(sponsor.id);
    setForm(sponsor);
  }

  function toggleSponsor(sponsor) {
    updateHub({
      sponsors: hub.sponsors.map((item) =>
        String(item.id) === String(sponsor.id)
          ? { ...item, active: !item.active }
          : item
      ),
    });
  }

  return (
    <div style={sponsorStyles.page}>
      <PageHeader
        title="Sponsor Hub"
        subtitle="Gestisci partner, pacchetti commerciali e informazioni da usare in report, export e comunicazioni societarie."
        badge="Piano Club"
      />

      <div style={sponsorStyles.kpiGrid}>
        <Kpi label="Sponsor attivi" value={activeSponsors.length} />
        <Kpi label="Valore annuo stimato" value={`€ ${yearlyValue.toLocaleString("it-IT")}`} />
        <Kpi label="Main sponsor" value={mainSponsor?.name || "Da scegliere"} />
      </div>

      <div style={sponsorStyles.grid}>
        <AppCard title={editingId ? "Modifica sponsor" : "Nuovo sponsor"} subtitle="Prepara slot vendibili e offerte locali.">
          <form onSubmit={submitSponsor} style={sponsorStyles.form}>
            <label style={sponsorStyles.label}>
              Nome sponsor
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                style={styles.input}
              />
            </label>

            <div style={sponsorStyles.two}>
              <label style={sponsorStyles.label}>
                Pacchetto
                <select
                  value={form.package}
                  onChange={(event) => setForm({ ...form, package: event.target.value })}
                  style={styles.input}
                >
                  <option>Bronze</option>
                  <option>Silver</option>
                  <option>Gold</option>
                  <option>Main</option>
                </select>
              </label>

              <label style={sponsorStyles.label}>
                Contatto
                <input
                  value={form.contact}
                  onChange={(event) => setForm({ ...form, contact: event.target.value })}
                  style={styles.input}
                />
              </label>
            </div>

            <label style={sponsorStyles.label}>
              Sito / link
              <input
                value={form.website}
                onChange={(event) => setForm({ ...form, website: event.target.value })}
                style={styles.input}
              />
            </label>

            <label style={sponsorStyles.label}>
              Offerta per community
              <textarea
                value={form.offer}
                onChange={(event) => setForm({ ...form, offer: event.target.value })}
                style={{ ...styles.input, minHeight: 90 }}
              />
            </label>

            <label style={sponsorStyles.label}>
              Visibilita promessa
              <textarea
                value={form.visibility}
                onChange={(event) => setForm({ ...form, visibility: event.target.value })}
                style={{ ...styles.input, minHeight: 90 }}
              />
            </label>

            <Button type="submit">
              {editingId ? "Salva sponsor" : "Aggiungi sponsor"}
            </Button>
          </form>
        </AppCard>

        <AppCard title="Sponsor attivi" subtitle="Schede pronte per comunicazione, PDF e report societa'.">
          <div style={sponsorStyles.sponsorList}>
            {hub.sponsors.length ? (
              hub.sponsors.map((sponsor) => (
                <div key={sponsor.id} style={sponsorStyles.sponsorCard}>
                  <div style={sponsorStyles.sponsorHeader}>
                    <div>
                      <Badge tone={sponsor.active ? "green" : "orange"}>
                        {sponsor.active ? "Attivo" : "Pausa"}
                      </Badge>
                      <h3 style={{ margin: "10px 0 4px" }}>{sponsor.name}</h3>
                      <p style={sponsorStyles.muted}>
                        {sponsor.package} · € {(packageValues[sponsor.package] || 0).toLocaleString("it-IT")} stimati
                      </p>
                    </div>
                    <div style={sponsorStyles.actions}>
                      <Button variant="ghost" onClick={() => editSponsor(sponsor)}>Modifica</Button>
                      <Button variant="ghost" onClick={() => toggleSponsor(sponsor)}>
                        {sponsor.active ? "Pausa" : "Riattiva"}
                      </Button>
                    </div>
                  </div>
                  <p style={sponsorStyles.bodyText}>{sponsor.offer || "Nessuna offerta inserita."}</p>
                  <p style={sponsorStyles.bodyText}>
                    <strong>Visibilita:</strong> {sponsor.visibility}
                  </p>
                  <div style={sponsorStyles.footerActions}>
                    <Button
                      variant={String(hub.mainSponsorId) === String(sponsor.id) ? "primary" : "ghost"}
                      onClick={() => updateHub({ mainSponsorId: sponsor.id })}
                    >
                      {String(hub.mainSponsorId) === String(sponsor.id) ? "Main sponsor" : "Imposta main"}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p style={sponsorStyles.muted}>Nessuno sponsor inserito.</p>
            )}
          </div>
        </AppCard>
      </div>

      <AppCard title="Report sponsor" subtitle="Traccia il valore da comunicare a societa' e partner.">
        <div style={sponsorStyles.reportGrid}>
          <div style={sponsorStyles.reportBox}>
            <strong>Asset inclusi</strong>
            <p>Dashboard club, export PDF, report post gara, pagina sponsor e offerte community.</p>
          </div>
          <label style={sponsorStyles.label}>
            Note report visibilita
            <textarea
              value={hub.reportNotes}
              onChange={(event) => updateHub({ reportNotes: event.target.value })}
              placeholder="Es. Logo presente nei PDF gara, 4 comunicazioni mensili, offerta dedicata alle famiglie..."
              style={{ ...styles.input, minHeight: 120 }}
            />
          </label>
        </div>
      </AppCard>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <AppCard>
      <p style={sponsorStyles.muted}>{label}</p>
      <h2 style={{ margin: "8px 0 0" }}>{value}</h2>
    </AppCard>
  );
}

const sponsorStyles = {
  page: { display: "grid", gap: 22 },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16 },
  grid: { display: "grid", gridTemplateColumns: "390px 1fr", gap: 22, alignItems: "start" },
  form: { display: "grid", gap: 12 },
  two: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  label: { display: "grid", gap: 6, color: "#94a3b8", fontSize: 12, fontWeight: 900, textTransform: "uppercase" },
  muted: { color: "#94a3b8", margin: 0 },
  sponsorList: { display: "grid", gap: 14 },
  sponsorCard: { padding: 16, borderRadius: 18, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" },
  sponsorHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" },
  actions: { display: "flex", gap: 8, flexWrap: "wrap" },
  bodyText: { color: "#cbd5e1", lineHeight: 1.55 },
  footerActions: { display: "flex", justifyContent: "flex-end" },
  reportGrid: { display: "grid", gridTemplateColumns: "0.7fr 1.3fr", gap: 18, alignItems: "start" },
  reportBox: { padding: 16, borderRadius: 18, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.18)", color: "#cbd5e1" },
};
