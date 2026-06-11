import { useState } from "react";
import AppCard from "../ui/AppCard";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { styles } from "../../styles/index.js";
import { createId } from "../../utils/helpers";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useTranslation } from "../../i18n";
import { sharedStyles } from "../../styles/settings";
import { widgetLabelKeys } from "../../utils/settingsHelpers";
import { NumberField } from "./SettingsElements";

export function CoachTab({ appSettings, setAppSettings, setConfirmState, showToast }) {
  const { t } = useTranslation();
  const settings   = useAppSettings(appSettings);
  const parameters = settings.coachParameters   || {};
  const metrics    = settings.physicalMetrics    || [];

  const [newMetric, setNewMetric] = useState({
    label: "", unit: "", higherIsBetter: true, icon: "📌",
  });

  function updateMetrics(updated) {
    setAppSettings({ ...settings, physicalMetrics: updated });
  }

  function toggleMetric(key) {
    updateMetrics(metrics.map((m) => m.key === key ? { ...m, enabled: !m.enabled } : m));
  }

  function deleteCustomMetric(key) {
    setConfirmState({
      message: t("pages.settings.coachDeleteMetricMsg"),
      confirmLabel: t("pages.settings.coachDeleteMetricConfirm"),
      confirmTone: "red",
      onConfirm: () => updateMetrics(metrics.filter((m) => m.key !== key)),
    });
  }

  function addCustomMetric() {
    if (!newMetric.label.trim()) {
      showToast(t("pages.settings.coachMetricNameRequired"), "warn");
      return;
    }
    const key = `custom_${createId("m")}`;
    updateMetrics([...metrics, { ...newMetric, key, enabled: true, custom: true }]);
    setNewMetric({ label: "", unit: "", higherIsBetter: true, icon: "📌" });
  }

  function updateParameters(patch) {
    setAppSettings({ ...settings, coachParameters: { ...parameters, ...patch } });
  }

  function updateWidget(key, value) {
    setAppSettings({ ...settings, dashboardWidgets: { ...settings.dashboardWidgets, [key]: value } });
  }

  return (
    <div style={sharedStyles.panel}>
      <div style={sharedStyles.grid2}>
        <AppCard>
          <h3 style={{ marginTop: 0, lineHeight: 1.2 }}>{t("pages.settings.coachParamsTitle")}</h3>
          <div style={sharedStyles.formGrid}>
            <label style={sharedStyles.label}>
              {t("pages.settings.coachCategoryLabel")}
              <select
                value={parameters.category}
                onChange={(e) => updateParameters({ category: e.target.value })}
                style={styles.input}
              >
                <option value="adulti">{t("pages.settings.clubCategoryPrima")}</option>
                <option value="juniores">{t("pages.settings.clubCategoryJuniores")}</option>
                <option value="allievi">{t("pages.settings.clubCategoryAllievi")}</option>
                <option value="giovanissimi">{t("pages.settings.clubCategoryGiovanissimi")}</option>
              </select>
            </label>
            <label style={sharedStyles.label}>
              {t("pages.settings.coachMethodLabel")}
              <select
                value={parameters.method}
                onChange={(e) => updateParameters({ method: e.target.value })}
                style={styles.input}
              >
                <option value="prudente">{t("pages.settings.coachMethodPrudent")}</option>
                <option value="standard">{t("pages.settings.coachMethodStandard")}</option>
                <option value="aggressivo">{t("pages.settings.coachMethodAggressive")}</option>
              </select>
            </label>
            <NumberField label={t("pages.settings.coachGroupA")} value={parameters.groupA} onChange={(v) => updateParameters({ groupA: v })} />
            <NumberField label={t("pages.settings.coachGroupB")} value={parameters.groupB} onChange={(v) => updateParameters({ groupB: v })} />
            <NumberField label={t("pages.settings.coachGroupC")} value={parameters.groupC} onChange={(v) => updateParameters({ groupC: v })} />
          </div>
          <Badge tone="blue">{t("pages.settings.coachThresholdsHint")}</Badge>
        </AppCard>

        <AppCard>
          <h3 style={{ marginTop: 0, lineHeight: 1.2 }}>{t("pages.settings.coachWidgetsTitle")}</h3>
          <div style={sharedStyles.widgetList}>
            {Object.entries(widgetLabelKeys).map(([key, labelKey]) => (
              <label key={key} style={sharedStyles.widgetRow}>
                <span>{t(labelKey)}</span>
                <input
                  type="checkbox"
                  checked={settings.dashboardWidgets[key]}
                  onChange={(e) => updateWidget(key, e.target.checked)}
                />
              </label>
            ))}
          </div>
        </AppCard>
      </div>

      <AppCard>
        <h3 style={{ marginTop: 0, marginBottom: 4, lineHeight: 1.2 }}>{t("pages.settings.coachMetricsTitle")}</h3>
        <p style={{ color: "#64748b", fontSize: 13, marginTop: 0, marginBottom: 18, lineHeight: 1.45 }}>
          Scegli quali metriche mostrare nelle schede giocatore. Puoi anche aggiungerne di personalizzate.
        </p>

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
                  {m.higherIsBetter ? t("pages.settings.coachMetricHigherBetter") : t("pages.settings.coachMetricLowerBetter")}
                </span>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => toggleMetric(m.key)}
                  style={{
                    borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 800,
                    cursor: "pointer", border: "none",
                    background: m.enabled ? "rgba(37,99,235,0.25)" : "rgba(255,255,255,0.08)",
                    color: m.enabled ? "#93c5fd" : "#475569",
                  }}
                >
                  {m.enabled ? t("pages.settings.coachMetricActive") : t("pages.settings.coachMetricInactive")}
                </button>
                {m.custom && (
                  <button
                    type="button"
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

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 18 }}>
          <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0, color: "#64748b" }}>
            {t("pages.settings.coachCustomMetricTitle")}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
            <label style={sharedStyles.label}>
              {t("pages.settings.coachMetricName")}
              <input
                placeholder="es. Cooper, Forza squat..."
                value={newMetric.label}
                onChange={(e) => setNewMetric({ ...newMetric, label: e.target.value })}
                style={styles.input}
              />
            </label>
            <label style={sharedStyles.label}>
              {t("pages.settings.coachMetricUnit")}
              <input
                placeholder="es. m, kg, s"
                value={newMetric.unit}
                onChange={(e) => setNewMetric({ ...newMetric, unit: e.target.value })}
                style={styles.input}
              />
            </label>
            <label style={sharedStyles.label}>
              {t("pages.settings.coachMetricIcon")}
              <input
                placeholder="emoji"
                value={newMetric.icon}
                onChange={(e) => setNewMetric({ ...newMetric, icon: e.target.value })}
                style={styles.input}
              />
            </label>
            <label style={sharedStyles.label}>
              {t("pages.settings.coachMetricTrend")}
              <select
                value={newMetric.higherIsBetter === null ? "null" : String(newMetric.higherIsBetter)}
                onChange={(e) => setNewMetric({
                  ...newMetric,
                  higherIsBetter: e.target.value === "null" ? null : e.target.value === "true",
                })}
                style={styles.input}
              >
                <option value="true">{t("pages.settings.coachMetricTrendUp")}</option>
                <option value="false">{t("pages.settings.coachMetricTrendDown")}</option>
                <option value="null">{t("pages.settings.coachMetricTrendNeutral")}</option>
              </select>
            </label>
            <Button onClick={addCustomMetric}>{t("pages.settings.coachBtnAdd")}</Button>
          </div>
        </div>
      </AppCard>

      <AppCard>
        <h3 style={{ marginTop: 0, lineHeight: 1.2 }}>{t("pages.settings.coachWorkBlocksTitle")}</h3>
        <div style={sharedStyles.blocksGrid}>
          {parameters.workBlocks.map((block) => (
            <div key={block.label} style={sharedStyles.block}>
              <strong>{block.label}</strong>
              <span>{block.seconds}s · {Math.round(block.percent * 100)}% MAS · {block.reps} reps · {block.sets} serie</span>
              <span>{block.recovery}</span>
            </div>
          ))}
        </div>
        <Button variant="ghost" onClick={() => showToast(t("pages.settings.coachBlocksComingSoon"), "info")}>
          {t("pages.settings.coachBtnCustomize")}
        </Button>
      </AppCard>
    </div>
  );
}
