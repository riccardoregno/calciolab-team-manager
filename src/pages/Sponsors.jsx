import { useState } from "react";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import { styles } from "../styles/index.js";
import { createId, normalizeAppSettings, normalizeSponsor } from "../utils/helpers";
import { useTranslation } from "../i18n";
import { useIsMobile } from "../hooks/useIsMobile";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/Toast";

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

export default function Sponsors({
  appSettings = {}, setAppSettings }) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const settings = normalizeAppSettings(appSettings);
  const hub = settings.sponsorHub;
  const [form, setForm] = useState(emptySponsor);
  const [editingId, setEditingId] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const { showToast, ToastContainer } = useToast();

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

  function deleteSponsor(sponsor) {
    setConfirmState({
      message: t("pages.sponsors.deleteConfirm"),
      confirmLabel: t("common.delete"),
      confirmTone: "red",
      onConfirm: () => {
        updateHub({
          sponsors: hub.sponsors.filter((item) => String(item.id) !== String(sponsor.id)),
          mainSponsorId: String(hub.mainSponsorId) === String(sponsor.id) ? "" : hub.mainSponsorId,
        });
        if (editingId === sponsor.id) {
          setEditingId("");
          setForm(emptySponsor);
        }
        showToast(t("pages.sponsors.sponsorDeleted"), "info");
      },
    });
  }

  return (
    <div style={sponsorStyles.page}>
      <ToastContainer />
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      <PageHeader
        title={t("pages.sponsors.title")}
        subtitle={t("pages.sponsors.subtitle")}
        badge={t("pages.sponsors.badgePlan")}
      />

      <div style={{ ...sponsorStyles.kpiGrid, gridTemplateColumns: isMobile ? "1fr" : "repeat(3,minmax(0,1fr))" }}>
        <Kpi label={t("pages.sponsors.kpiActive")} value={activeSponsors.length} />
        <Kpi label={t("pages.sponsors.kpiYearlyValue")} value={`€ ${yearlyValue.toLocaleString("it-IT")}`} />
        <Kpi label={t("pages.sponsors.kpiMainSponsor")} value={mainSponsor?.name || t("pages.sponsors.kpiMainSponsorFallback")} />
      </div>

      <div style={{ ...sponsorStyles.grid, gridTemplateColumns: isMobile ? "1fr" : "390px 1fr" }}>
        <AppCard title={editingId ? t("pages.sponsors.formTitleEdit") : t("pages.sponsors.formTitleNew")} subtitle={t("pages.sponsors.formSubtitle")}>
          <form onSubmit={submitSponsor} style={sponsorStyles.form}>
            <label style={sponsorStyles.label}>
              {t("pages.sponsors.fieldName")}
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                style={styles.input}
              />
            </label>

            <div style={{ ...sponsorStyles.two, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
              <label style={sponsorStyles.label}>
                {t("pages.sponsors.fieldPackage")}
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
                {t("pages.sponsors.fieldContact")}
                <input
                  value={form.contact}
                  onChange={(event) => setForm({ ...form, contact: event.target.value })}
                  style={styles.input}
                />
              </label>
            </div>

            <label style={sponsorStyles.label}>
              {t("pages.sponsors.fieldWebsite")}
              <input
                value={form.website}
                onChange={(event) => setForm({ ...form, website: event.target.value })}
                style={styles.input}
              />
            </label>

            <label style={sponsorStyles.label}>
              {t("pages.sponsors.fieldOffer")}
              <textarea
                value={form.offer}
                onChange={(event) => setForm({ ...form, offer: event.target.value })}
                style={{ ...styles.input, minHeight: 90 }}
              />
            </label>

            <label style={sponsorStyles.label}>
              {t("pages.sponsors.fieldVisibility")}
              <textarea
                value={form.visibility}
                onChange={(event) => setForm({ ...form, visibility: event.target.value })}
                style={{ ...styles.input, minHeight: 90 }}
              />
            </label>

            <Button type="submit">
              {editingId ? t("pages.sponsors.saveSponsor") : t("pages.sponsors.addSponsor")}
            </Button>
          </form>
        </AppCard>

        <AppCard title={t("pages.sponsors.activeTitle")} subtitle={t("pages.sponsors.activeSubtitle")}>
          <div style={sponsorStyles.sponsorList}>
            {hub.sponsors.length ? (
              hub.sponsors.map((sponsor) => (
                <div key={sponsor.id} style={sponsorStyles.sponsorCard}>
                  <div style={sponsorStyles.sponsorHeader}>
                    <div>
                      <Badge tone={sponsor.active ? "green" : "orange"}>
                        {sponsor.active ? t("pages.sponsors.statusActive") : t("pages.sponsors.statusPaused")}
                      </Badge>
                      <h3 style={{ margin: "10px 0 4px" }}>{sponsor.name}</h3>
                      <p style={sponsorStyles.muted}>
                        {sponsor.package} · {t("pages.sponsors.estimatedValue", { value: (packageValues[sponsor.package] || 0).toLocaleString("it-IT") })}
                      </p>
                    </div>
                    <div style={sponsorStyles.actions}>
                      <Button variant="ghost" onClick={() => editSponsor(sponsor)}>{t("pages.sponsors.editSponsor")}</Button>
                      <Button variant="ghost" onClick={() => toggleSponsor(sponsor)}>
                        {sponsor.active ? t("pages.sponsors.pauseSponsor") : t("pages.sponsors.reactivateSponsor")}
                      </Button>
                      <Button variant="ghost" onClick={() => deleteSponsor(sponsor)}>
                        {t("common.delete")}
                      </Button>
                    </div>
                  </div>
                  <p style={sponsorStyles.bodyText}>{sponsor.offer || t("pages.sponsors.noOffer")}</p>
                  <p style={sponsorStyles.bodyText}>
                    <strong>{t("pages.sponsors.visibilityLabel")}</strong> {sponsor.visibility}
                  </p>
                  <div style={sponsorStyles.footerActions}>
                    <Button
                      variant={String(hub.mainSponsorId) === String(sponsor.id) ? "primary" : "ghost"}
                      onClick={() => updateHub({ mainSponsorId: sponsor.id })}
                    >
                      {String(hub.mainSponsorId) === String(sponsor.id) ? t("pages.sponsors.isMain") : t("pages.sponsors.setMain")}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p style={sponsorStyles.muted}>{t("pages.sponsors.noSponsors")}</p>
            )}
          </div>
        </AppCard>
      </div>

      <AppCard title={t("pages.sponsors.reportTitle")} subtitle={t("pages.sponsors.reportSubtitle")}>
        <div style={{ ...sponsorStyles.reportGrid, gridTemplateColumns: isMobile ? "1fr" : "0.7fr 1.3fr" }}>
          <div style={sponsorStyles.reportBox}>
            <strong>{t("pages.sponsors.assetTitle")}</strong>
            <p>{t("pages.sponsors.assetText")}</p>
          </div>
          <label style={sponsorStyles.label}>
            {t("pages.sponsors.reportNotesLabel")}
            <textarea
              value={hub.reportNotes}
              onChange={(event) => updateHub({ reportNotes: event.target.value })}
              placeholder={t("pages.sponsors.reportNotesPlaceholder")}
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
  label: { display: "grid", gap: 6, color: "#94a3b8", fontSize: 12, fontWeight: 700, textTransform: "uppercase" },
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
