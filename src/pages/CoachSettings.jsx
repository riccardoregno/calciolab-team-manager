import { useState } from "react";
import AppCard from "../components/ui/AppCard";
import { useIsMobile } from "../hooks/useIsMobile";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/Toast";
import { styles } from "../styles/index.js";
import { createId } from "../utils/helpers";
import { useAppSettings } from "../hooks/useAppSettings";
import { useTranslation } from "../i18n";

export default function CoachSettings({
  appSettings, setAppSettings }) {

  const { t } = useTranslation();
  const widgetLabels = {
    hero: t("pages.coachSettings.widgetHero"),
    nextEvent: t("pages.coachSettings.widgetNextEvent"),
    kpis: t("pages.coachSettings.widgetKpis"),
    weekFocus: t("pages.coachSettings.widgetWeekFocus"),
    rosterStatus: t("pages.coachSettings.widgetRosterStatus"),
    coachAlerts: t("pages.coachSettings.widgetCoachAlerts"),
    recentActivities: t("pages.coachSettings.widgetRecentActivities"),
    quickActions: t("pages.coachSettings.widgetQuickActions"),
    rewardCenter: t("pages.coachSettings.widgetRewardCenter"),
  };
  // FIX #13: useMemo tramite hook — evita riallocazioni O(n) ad ogni render
  const settings   = useAppSettings(appSettings);
  const parameters = settings.coachParameters;
  const metrics    = settings.physicalMetrics;

  const [newMetric, setNewMetric] = useState({ label: "", unit: "", higherIsBetter: true, icon: "📌" });
  const [confirmState, setConfirmState] = useState(null);
  const isMobile = useIsMobile();
  const { showToast, ToastContainer } = useToast();

  function updateMetrics(updated) {
    setAppSettings({ ...settings, physicalMetrics: updated });
  }

  function toggleMetric(key) {
    updateMetrics(metrics.map((m) => m.key === key ? { ...m, enabled: !m.enabled } : m));
  }

  function deleteCustomMetric(key) {
    setConfirmState({
      message: t("pages.coachSettings.deleteMetricConfirm"),
      confirmLabel: t("pages.coachSettings.deleteMetricLabel"),
      confirmTone: "red",
      onConfirm: () => updateMetrics(metrics.filter((m) => m.key !== key)),
    });
  }

  function addCustomMetric() {
    if (!newMetric.label.trim()) {
      showToast(t("pages.coachSettings.metricNameRequired"), "warn");
      return;
    }
    const key = `custom_${createId("m")}`;
    updateMetrics([...metrics, { ...newMetric, key, enabled: true, custom: true }]);
    setNewMetric({ label: "", unit: "", higherIsBetter: true, icon: "📌" });
  }

  function updateParameters(patch) {
    setAppSettings({
      ...settings,
      coachParameters: {
        ...parameters,
        ...patch,
      },
    });
  }

  function updateWidget(key, value) {
    setAppSettings({
      ...settings,
      dashboardWidgets: {
        ...settings.dashboardWidgets,
        [key]: value,
      },
    });
  }

  return (
    <div style={styles.page}>
      <ToastContainer />
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      <PageHeader
        title={t("pages.coachSettings.title")}
        subtitle={t("pages.coachSettings.subtitle")}
      />

      <div style={{ ...coachStyles.grid, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
        <AppCard>
          <h3 style={{ marginTop: 0, lineHeight: 1.2 }}>{t("pages.coachSettings.parametersTitle")}</h3>
          <div style={coachStyles.formGrid}>
            <label style={coachStyles.label}>
              {t("pages.coachSettings.fieldCategory")}
              <select value={parameters.category} onChange={(event) => updateParameters({ category: event.target.value })} style={styles.input}>
                <option value="adulti">{t("pages.coachSettings.catAdulti")}</option>
                <option value="juniores">{t("pages.coachSettings.catJuniores")}</option>
                <option value="allievi">{t("pages.coachSettings.catAllievi")}</option>
                <option value="giovanissimi">{t("pages.coachSettings.catGiovanissimi")}</option>
              </select>
            </label>
            <label style={coachStyles.label}>
              {t("pages.coachSettings.fieldMethod")}
              <select value={parameters.method} onChange={(event) => updateParameters({ method: event.target.value })} style={styles.input}>
                <option value="prudente">{t("pages.coachSettings.methodPrudente")}</option>
                <option value="standard">{t("pages.coachSettings.methodStandard")}</option>
                <option value="aggressivo">{t("pages.coachSettings.methodAggressivo")}</option>
              </select>
            </label>
            <NumberField label={t("pages.coachSettings.groupAThreshold")} value={parameters.groupA} onChange={(value) => updateParameters({ groupA: value })} />
            <NumberField label={t("pages.coachSettings.groupBThreshold")} value={parameters.groupB} onChange={(value) => updateParameters({ groupB: value })} />
            <NumberField label={t("pages.coachSettings.groupCThreshold")} value={parameters.groupC} onChange={(value) => updateParameters({ groupC: value })} />
          </div>
          <Badge tone="blue">{t("pages.coachSettings.thresholdBadge")}</Badge>
        </AppCard>

        <AppCard>
          <h3 style={{ marginTop: 0, lineHeight: 1.2 }}>{t("pages.coachSettings.dashboardTitle")}</h3>
          <div style={coachStyles.widgetList}>
            {Object.entries(widgetLabels).map(([key, label]) => (
              <label key={key} style={coachStyles.widgetRow}>
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={settings.dashboardWidgets[key]}
                  onChange={(event) => updateWidget(key, event.target.checked)}
                />
              </label>
            ))}
          </div>
        </AppCard>
      </div>

      {/* ── Metriche test fisici ── */}
      <AppCard>
        <h3 style={{ marginTop: 0, marginBottom: 4, lineHeight: 1.2 }}>{t("pages.coachSettings.metricsTitle")}</h3>
        <p style={{ color: "#64748b", fontSize: 13, marginTop: 0, marginBottom: 18, lineHeight: 1.45 }}>
          {t("pages.coachSettings.metricsSubtitle")}
        </p>

        {/* Lista metriche default */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10, marginBottom: 22 }}>
          {metrics.map((m) => (
            <div key={m.key} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
              borderRadius: 12,
              background: m.enabled ? "rgba(37,99,235,0.10)" : "rgba(255,255,255,0.04)",
              border: m.enabled ? "1px solid rgba(96,165,250,0.35)" : "1px solid rgba(255,255,255,0.08)",
              transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 18 }}>{m.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: 13, color: m.enabled ? "#e2e8f0" : "#64748b" }}>{m.label}</strong>
                {m.unit && <span style={{ fontSize: 11, color: "#475569", marginLeft: 6 }}>{m.unit}</span>}
                {m.custom && <span style={{ fontSize: 10, marginLeft: 6, color: "#a78bfa", fontWeight: 700 }}>CUSTOM</span>}
              </div>
              {m.higherIsBetter !== null && (
                <span style={{ fontSize: 11, color: m.higherIsBetter ? "#22c55e" : "#f87171", fontWeight: 700 }}>
                  {m.higherIsBetter ? t("pages.coachSettings.trendUp") : t("pages.coachSettings.trendDown")}
                </span>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => toggleMetric(m.key)}
                  style={{
                    borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 800,
                    cursor: "pointer", border: "none",
                    background: m.enabled ? "rgba(37,99,235,0.25)" : "rgba(255,255,255,0.08)",
                    color: m.enabled ? "#93c5fd" : "#475569",
                  }}
                >
                    {m.enabled ? t("pages.coachSettings.metricEnabled") : t("pages.coachSettings.metricDisabled")}
                </button>
                {m.custom && (
                  <button
                    onClick={() => deleteCustomMetric(m.key)}
                    style={{ borderRadius: 8, padding: "4px 8px", fontSize: 11, cursor: "pointer", border: "none", background: "rgba(239,68,68,0.12)", color: "#f87171" }}
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Aggiungi metrica custom */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 18 }}>
          <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0, color: "#64748b" }}>
            {t("pages.coachSettings.addCustomTitle")}
          </p>
          <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end", minWidth: 480 }}>
            <div style={{ display: "grid", gap: 5 }}>
              <label style={coachStyles.label}>{t("pages.coachSettings.fieldMetricName")}</label>
              <input
                placeholder={t("pages.coachSettings.metricNamePlaceholder")}
                value={newMetric.label}
                onChange={(e) => setNewMetric({ ...newMetric, label: e.target.value })}
                style={styles.input}
              />
            </div>
            <div style={{ display: "grid", gap: 5 }}>
              <label style={coachStyles.label}>{t("pages.coachSettings.fieldUnit")}</label>
              <input
                placeholder={t("pages.coachSettings.unitPlaceholder")}
                value={newMetric.unit}
                onChange={(e) => setNewMetric({ ...newMetric, unit: e.target.value })}
                style={styles.input}
              />
            </div>
            <div style={{ display: "grid", gap: 5 }}>
              <label style={coachStyles.label}>{t("pages.coachSettings.fieldIcon")}</label>
              <input
                placeholder={t("pages.coachSettings.iconPlaceholder")}
                value={newMetric.icon}
                onChange={(e) => setNewMetric({ ...newMetric, icon: e.target.value })}
                style={styles.input}
              />
            </div>
            <div style={{ display: "grid", gap: 5 }}>
              <label style={coachStyles.label}>{t("pages.coachSettings.fieldTrend")}</label>
              <select
                value={newMetric.higherIsBetter === null ? "null" : String(newMetric.higherIsBetter)}
                onChange={(e) => setNewMetric({ ...newMetric, higherIsBetter: e.target.value === "null" ? null : e.target.value === "true" })}
                style={styles.input}
              >
                <option value="true">{t("pages.coachSettings.trendHigher")}</option>
                <option value="false">{t("pages.coachSettings.trendLower")}</option>
                <option value="null">{t("pages.coachSettings.trendNeutral")}</option>
              </select>
            </div>
            <Button onClick={addCustomMetric}>{t("pages.coachSettings.addMetric")}</Button>
          </div>
          </div>
        </div>
      </AppCard>

      <AppCard>
        <h3 style={{ marginTop: 0, lineHeight: 1.2 }}>{t("pages.coachSettings.workBlocksTitle")}</h3>
        <div style={coachStyles.blocks}>
          {parameters.workBlocks.map((block) => (
            <div key={block.label} style={coachStyles.block}>
              <strong>{block.label}</strong>
              <span>{block.seconds}s · {Math.round(block.percent * 100)}% MAS · {block.reps} reps · {block.sets} serie</span>
              <span>{block.recovery}</span>
            </div>
          ))}
        </div>
        <Button variant="ghost" onClick={() => showToast(t("pages.coachSettings.advancedEditorToast"), "info")}>
          {t("pages.coachSettings.customizeBlocks")}
        </Button>
      </AppCard>
    </div>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <label style={coachStyles.label}>
      {label}
      <input type="number" step="0.1" value={value} onChange={(event) => onChange(Number(event.target.value))} style={styles.input} />
    </label>
  );
}

const coachStyles = {
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start", marginBottom: 20 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 16 },
  label: { color: "#94a3b8", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0 },
  widgetList: { display: "grid", gap: 10 },
  widgetRow: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", lineHeight: 1.25 },
  blocks: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: 16 },
  block: { display: "grid", gap: 6, padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: "#cbd5e1", lineHeight: 1.35 },
};
