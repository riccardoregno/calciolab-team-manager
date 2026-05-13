import { theme } from "./theme";

export const layout = {
  appShell: {
    display: "flex",
    minHeight: "100vh",
    background: theme.colors.bg,
    color: theme.colors.text,
    fontFamily: "Inter, sans-serif",
  },

  topbarProfileButton: {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "7px 10px 7px 7px",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.09)",
  background: "rgba(255,255,255,0.045)",
  cursor: "pointer",
},

topbarChevron: {
  color: "#94a3b8",
  fontSize: 14,
  fontWeight: 900,
},

topbarProfileMenu: {
  position: "absolute",
  top: "calc(100% + 10px)",
  right: 0,
  width: 260,
  background: "rgba(15,23,42,0.98)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 18,
  padding: 10,
  zIndex: 70,
  boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
},

topbarProfileMenuHeader: {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "10px 12px 14px",
  color: "white",
  fontSize: 13,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  marginBottom: 8,
},

topbarProfileMenuItem: {
  display: "block",
  padding: "11px 12px",
  borderRadius: 13,
  color: "#e5e7eb",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 700,
},

topbarProfileLogout: {
  width: "100%",
  marginTop: 8,
  padding: "11px 12px",
  borderRadius: 13,
  border: "1px solid rgba(239,68,68,0.25)",
  background: "rgba(239,68,68,0.1)",
  color: "#fca5a5",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
},

  content: {
    flex: 1,
    padding: "28px 36px",
    overflowX: "hidden",
  },

  storageStatus: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    margin: "-12px 0 22px",
    flexWrap: "wrap",
  },

  storageStatusText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 700,
  },

  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },

topbarSearchResults: {
  position: "absolute",
  top: "calc(100% + 10px)",
  left: 0,
  width: "100%",
  minWidth: "unset",
  background: "rgba(15,23,42,0.98)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 18,
  padding: 8,
  zIndex: 50,
  boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
},

topbarSearchResult: {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "12px 13px",
  borderRadius: 14,
  color: "white",
  textDecoration: "none",
  fontSize: 13,
  background: "transparent",
},

topbarSearchEmpty: {
  padding: "14px 13px",
  color: "#94a3b8",
  fontSize: 13,
},

topbarNotificationsPanel: {
  position: "absolute",
  top: "calc(100% + 10px)",
  right: 0,
  width: 310,
  background: "rgba(15,23,42,0.98)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 18,
  padding: 10,
  zIndex: 60,
  boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
},

topbarNotificationsHeader: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  color: "white",
  padding: "8px 10px 12px",
  fontSize: 13,
},

topbarNotificationItem: {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "12px",
  borderRadius: 14,
  color: "white",
  textDecoration: "none",
  fontSize: 13,
  background: "rgba(255,255,255,0.035)",
  marginBottom: 6,
},

topbarNotificationEmpty: {
  padding: "14px 12px",
  color: "#94a3b8",
  fontSize: 13,
},
  pageTitle: {
    fontSize: 38,
    fontWeight: 800,
    margin: 0,
    color: theme.colors.text,
  },

  pageSubtitle: {
    color: theme.colors.muted,
    marginTop: 6,
  },

  topbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
    marginBottom: 28,
    padding: "16px 4px",
    flexWrap: "wrap",
  },

  topbarLeft: {
    minWidth: 220,
  },

  topbarEyebrow: {
    margin: 0,
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.3,
  },

  topbarTitle: {
    margin: "5px 0 0",
    fontSize: 24,
    lineHeight: 1.15,
    fontWeight: 900,
    color: theme.colors.text,
  },

 topbarActions: {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 12,
  flexWrap: "wrap",
  maxWidth: "100%",
},

topbarSearchWrapper: {
  position: "relative",
  width: "min(340px, 100%)",
},

  topbarSearchBox: {
    width: 340,
    maxWidth: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 18,
    padding: "0 14px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },

  topbarSearchIcon: {
    color: "#64748b",
    fontSize: 18,
    fontWeight: 900,
  },

  topbarSearchInput: {
    width: "100%",
    background: "transparent",
    border: "none",
    padding: "13px 0",
    color: "white",
    outline: "none",
    fontSize: 14,
  },

  topbarPrimaryAction: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "white",
    textDecoration: "none",
    borderRadius: 18,
    padding: "13px 17px",
    fontWeight: 900,
    fontSize: 14,
    boxShadow: "0 14px 30px rgba(37,99,235,0.32)",
    whiteSpace: "nowrap",
  },

  topbarPlus: {
    width: 20,
    height: 20,
    borderRadius: 999,
    background: "rgba(255,255,255,0.18)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
  },

  topbarIconButton: {
    position: "relative",
    width: 46,
    height: 46,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.09)",
    background: "rgba(255,255,255,0.045)",
    color: "white",
    cursor: "pointer",
    fontSize: 17,
  },

  topbarNotificationDot: {
    position: "absolute",
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "#22c55e",
    boxShadow: "0 0 0 4px rgba(34,197,94,0.13)",
  },

  topbarProfile: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "7px 10px 7px 7px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.09)",
    background: "rgba(255,255,255,0.045)",
  },

  topbarAvatar: {
    width: 34,
    height: 34,
    borderRadius: 14,
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#052e16",
    fontWeight: 950,
  },

  topbarProfileText: {
    display: "flex",
    flexDirection: "column",
    lineHeight: 1.1,
  },

  topbarProfileName: {
    color: theme.colors.text,
    fontSize: 13,
  },

  topbarProfileRole: {
    color: "#86efac",
    fontSize: 11,
    fontWeight: 800,
  },

  muted: {
    color: theme.colors.muted,
  },
};
