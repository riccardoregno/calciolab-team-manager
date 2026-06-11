import AppCard from "../ui/AppCard";
import Button from "../ui/Button";
import { normalizeAppSettings } from "../../utils/helpers";
import { useNotifications } from "../../hooks/useNotifications";
import { useTranslation } from "../../i18n";
import { NotifPreviewRow } from "./SettingsElements";

export function NotificationsTab({ appSettings, setAppSettings, sessions = [], matches = [], players = [] }) {
  const { t } = useTranslation();
  const settings = normalizeAppSettings(appSettings);
  const notifSettings = settings.notifications || { enabled: false, remindersEnabled: false };

  const { supported, permission, requestPermission, notify } = useNotifications();

  function updateNotif(patch) {
    setAppSettings?.((prev) => {
      const s = normalizeAppSettings(prev);
      return { ...s, notifications: { ...(s.notifications || {}), ...patch } };
    });
  }

  async function handleEnable() {
    const result = await requestPermission();
    if (result === "granted") {
      updateNotif({ enabled: true });
      notify({ title: t("pages.settings.notifGranted"), body: t("pages.settings.notifEnabledLabel") });
    }
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(tomorrow.getDate() + 1);

  const tomorrowMatches = matches.filter((m) => { const d = new Date(m.date); return d >= tomorrow && d < dayAfter; });
  const tomorrowSessions = sessions.filter((s) => { const d = new Date(s.date); return d >= tomorrow && d < dayAfter; });
  const injuredPlayers = players.filter((p) => p.status === "Infortunato");

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <AppCard>
        <h3 style={{ margin: "0 0 6px", fontSize: 17 }}>{t("pages.settings.notifTitle")}</h3>
        <p style={{ color: "#94a3b8", margin: "0 0 18px", fontSize: 14, lineHeight: 1.5 }}>
          Ricevi avvisi per partite imminenti, sedute programmate e stato infortuni — direttamente nel browser o come notifica sul telefono (se aggiungi l&apos;app alla schermata Home).
        </p>

        {!supported ? (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fca5a5", fontSize: 14 }}>
            {t("pages.settings.notifUnsupported")}
          </div>
        ) : permission === "denied" ? (
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#fca5a5", fontSize: 14 }}>
            {t("pages.settings.notifDenied")}
          </div>
        ) : permission === "granted" ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#86efac", fontSize: 14, display: "flex", gap: 10, alignItems: "center" }}>
              {t("pages.settings.notifGranted")}
            </div>

            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
              <div>
                <strong style={{ fontSize: 14 }}>{t("pages.settings.notifEnabledLabel")}</strong>
                <p style={{ margin: "2px 0 0", color: "#94a3b8", fontSize: 13 }}>Ricevi avvisi per partite, sedute e infortuni il giorno prima</p>
              </div>
              <input
                type="checkbox"
                checked={notifSettings.enabled}
                onChange={(e) => updateNotif({ enabled: e.target.checked })}
                style={{ width: 20, height: 20, accentColor: "#22c55e", cursor: "pointer" }}
              />
            </label>

            {notifSettings.enabled && (
              <Button
                variant="ghost"
                onClick={() => {
                  if (tomorrowMatches.length > 0) {
                    notify({ title: `⚽ ${t("pages.settings.notifMatchTomorrow")}`, body: `${tomorrowMatches[0].opponent}`, tag: "test-match" });
                  } else if (tomorrowSessions.length > 0) {
                    notify({ title: `📋 ${t("pages.settings.notifSessionTomorrow")}`, body: tomorrowSessions[0].title || "Seduta programmata", tag: "test-session" });
                  } else if (injuredPlayers.length > 0) {
                    notify({ title: `🚑 ${t("pages.settings.notifInjuredPlayer")}`, body: injuredPlayers[0].name, tag: "test-injury" });
                  } else {
                    notify({ title: "🔔 CalcioLab", body: "Notifiche funzionanti correttamente!", tag: "test" });
                  }
                }}
              >
                {t("pages.settings.notifBtnTest")}
              </Button>
            )}
          </div>
        ) : (
          <Button onClick={handleEnable}>
            {t("pages.settings.notifBtnEnable")}
          </Button>
        )}
      </AppCard>

      {/* Preview eventi prossimi */}
      <AppCard>
        <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>{t("pages.settings.notifUpcomingTitle")}</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {tomorrowMatches.map((m) => (
            <NotifPreviewRow key={m.id} icon="⚽" title={t("pages.settings.notifMatchTomorrow")} desc={m.opponent || "Avversario"} tone="blue" />
          ))}
          {tomorrowSessions.map((s) => (
            <NotifPreviewRow key={s.id} icon="📋" title={t("pages.settings.notifSessionTomorrow")} desc={s.title || "Seduta"} tone="purple" />
          ))}
          {injuredPlayers.map((p) => (
            <NotifPreviewRow key={p.id} icon="🚑" title={t("pages.settings.notifInjuredPlayer")} desc={p.name} tone="red" />
          ))}
          {tomorrowMatches.length === 0 && tomorrowSessions.length === 0 && injuredPlayers.length === 0 && (
            <p style={{ color: "#475569", fontSize: 14 }}>{t("pages.settings.notifNone")}</p>
          )}
        </div>
      </AppCard>
    </div>
  );
}
