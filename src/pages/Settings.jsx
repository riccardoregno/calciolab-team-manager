import { useMemo, useState } from "react";

import ConfirmDialog from "../components/ui/ConfirmDialog";
import PageHeader from "../components/ui/PageHeader";
import { useToast } from "../components/ui/Toast";
import { useTabState } from "../hooks/useTabState";
import { useTranslation } from "../i18n";
import { styles } from "../styles/index.js";
import { sharedStyles as s } from "../styles/settings";
import { isRoleAllowed, normalizeAppSettings } from "../utils/helpers";
import { AccountTab } from "../components/settings/AccountTab";
import { CoachTab } from "../components/settings/CoachTab";
import { ClubTab } from "../components/settings/ClubTab";
import { NotificationsTab } from "../components/settings/NotificationsTab";

const TABS = [
  { key: "account", labelKey: "pages.settings.account" },
  { key: "coach", labelKey: "pages.settings.coachParams" },
  { key: "club", labelKey: "pages.settings.clubProfile", roles: ["owner", "headCoach", "director"] },
  { key: "notifications", labelKey: "pages.settings.notifications" },
];

export default function Settings({
  authConfigured,
  authLoading,
  user,
  team,
  authError,
  storageSource,
  appSettings = {},
  setAppSettings,
  currentUserRole,
  players = [],
  exercises = [],
  sessions = [],
  matches = [],
}) {
  const { t } = useTranslation();
  const { showToast, ToastContainer } = useToast();
  const [confirmState, setConfirmState] = useState(null);
  const [activeTab, setActiveTab] = useTabState("tab", "account");

  const role = currentUserRole || team?.role || normalizeAppSettings(appSettings).currentUserRole;
  const availableTabs = useMemo(
    () => TABS.filter((tab) => isRoleAllowed(role, tab.roles)),
    [role]
  );
  const safeActiveTab = availableTabs.some((tab) => tab.key === activeTab)
    ? activeTab
    : availableTabs[0]?.key || "account";

  return (
    <div style={styles.page}>
      <ToastContainer />
      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />

      <PageHeader
        title={t("pages.settings.title")}
        subtitle={t("pages.settings.subtitle")}
      />

      <div style={s.tabBar}>
        {availableTabs.map((tab) => {
          const selected = safeActiveTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                ...s.tab,
                ...(selected ? s.tabActive : s.tabInactive),
              }}
            >
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {safeActiveTab === "account" && (
        <AccountTab
          authConfigured={authConfigured}
          authLoading={authLoading}
          user={user}
          team={team}
          authError={authError}
          storageSource={storageSource}
          appSettings={appSettings}
          showToast={showToast}
        />
      )}

      {safeActiveTab === "coach" && (
        <CoachTab
          appSettings={appSettings}
          setAppSettings={setAppSettings}
          setConfirmState={setConfirmState}
          showToast={showToast}
        />
      )}

      {safeActiveTab === "club" && (
        <ClubTab
          appSettings={appSettings}
          setAppSettings={setAppSettings}
          team={team}
          showToast={showToast}
          players={players}
          exercises={exercises}
          sessions={sessions}
          matches={matches}
        />
      )}

      {safeActiveTab === "notifications" && (
        <NotificationsTab
          appSettings={appSettings}
          setAppSettings={setAppSettings}
          sessions={sessions}
          matches={matches}
          players={players}
        />
      )}
    </div>
  );
}
