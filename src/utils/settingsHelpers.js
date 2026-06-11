export const INVITE_MEMBER_MODAL = "invite-member";
export const INVITE_MEMBER_DRAFT_KEY = "calciolab_invite_member_draft_v1";
export const EMPTY_INVITE_FORM = { email: "", name: "", role: "assistantCoach", customAreas: {} };

export function loadInviteMemberDraft() {
  try {
    const stored = localStorage.getItem(INVITE_MEMBER_DRAFT_KEY);
    return stored ? { ...EMPTY_INVITE_FORM, ...JSON.parse(stored) } : EMPTY_INVITE_FORM;
  } catch {
    return EMPTY_INVITE_FORM;
  }
}

export function clearInviteMemberDraft() {
  try {
    localStorage.removeItem(INVITE_MEMBER_DRAFT_KEY);
  } catch {
    /* localStorage can be unavailable in restricted browsers */
  }
}

export const widgetLabelKeys = {
  hero:             "pages.settings.introOperational",
  nextEvent:        "pages.settings.nextEvent",
  kpis:             "pages.settings.mainKpis",
  weekFocus:        "pages.settings.weekFocus",
  rosterStatus:     "pages.settings.rosterStatus",
  coachAlerts:      "pages.settings.coachAlerts",
  recentActivities: "pages.settings.recentActivities",
  quickActions:     "pages.settings.quickActions",
  rewardCenter:     "pages.settings.rewardPlan",
};

/* ─── Permission areas for custom access overrides ─────────── */
export const PERMISSION_AREAS = [
  { key: "players",    icon: "👥" },
  { key: "sessions",   icon: "📋" },
  { key: "matches",    icon: "⚽" },
  { key: "physical",   icon: "📊" },
  { key: "statistics", icon: "📈" },
  { key: "setPlays",   icon: "🎯" },
  { key: "calendar",   icon: "📅" },
];

export const AREA_ACCESS_LABEL_KEYS = {
  role:   "pages.settings.accessRole",
  view:   "pages.settings.accessView",
  manage: "pages.settings.accessManage",
  none:   "pages.settings.accessNone",
};

export const DEFAULT_WORKSPACE_PROFILE = {
  clubName: "", teamName: "", category: "Prima squadra", logoSize: 100,
  homeFieldName: "", homeFieldAddress: "", homeFieldSurface: "Erba naturale",
  userRole: "headCoach", seasonGoal: "", currentSeason: "2025/26",
};
export const INVITE_EXPIRY_DAYS = 14;

export function getInviteExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);
  return expiresAt.toISOString();
}

export function isInviteExpired(invite) {
  return Boolean(invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now());
}

export function hasWorkspaceProfileContent(profile = {}) {
  return [
    profile.clubName && profile.clubName !== "CalcioLab",
    profile.teamName,
    profile.logo,
    profile.homeFieldName,
    profile.homeFieldAddress,
    profile.seasonGoal,
    profile.currentSeason && profile.currentSeason !== "2025/2026" && profile.currentSeason !== "2025/26",
    profile.homeFieldSurface && profile.homeFieldSurface !== "Erba naturale",
  ].some(Boolean);
}
