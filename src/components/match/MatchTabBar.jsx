import { useNavigate } from "react-router-dom";

const TABS = [
  {
    key: "convocazione",
    label: "Convocazione",
    path: (id) => `/match-convocation/${id}`,
    getStatus(d) {
      if (!d) return null;
      if (d.convocazione?.published) return "done";
      if (d.convocazione?.playerIds?.length > 0) return "draft";
      return null;
    },
    getCount(d) {
      const n = d?.convocazione?.playerIds?.length;
      return n ? String(n) : null;
    },
  },
  {
    key: "scheda",
    label: "Scheda Gara",
    path: (id) => `/match-day/${id}`,
    getStatus(d) {
      if (!d) return null;
      if (d.lineup?.ready) return "done";
      if (d.lineup?.starterIds?.length > 0) return "draft";
      return null;
    },
    getCount(d) {
      const n = d?.lineup?.starterIds?.length || 0;
      return n > 0 ? `${n}/11` : null;
    },
  },
  {
    key: "live",
    label: "⚡ Live",
    path: (id) => `/match-live/${id}`,
    getStatus(d) {
      if (!d) return null;
      return Array.isArray(d.liveEvents) && d.liveEvents.length > 0 ? "draft" : null;
    },
    getCount(d) {
      const n = Array.isArray(d?.liveEvents) ? d.liveEvents.length : 0;
      return n > 0 ? String(n) : null;
    },
  },
  {
    key: "statistiche",
    label: "Statistiche",
    path: (id) => `/match-stats/${id}`,
    getStatus: () => null,
    getCount:  () => null,
  },
  {
    key: "postgara",
    label: "Post Gara",
    path: (id) => `/post-match/${id}`,
    getStatus(d) {
      if (!d) return null;
      const r = d.postMatch || {};
      const filled = Object.values(r).some(
        (v) => typeof v === "string" && v.trim().length > 0
      );
      return filled ? "draft" : null;
    },
    getCount: () => null,
  },
];

export default function MatchTabBar({ matchId, active, matchLabel, matchData }) {
  const navigate = useNavigate();

  if (!matchId) return null;

  return (
    <div style={s.wrap}>
      {matchLabel && <span style={s.label}>{matchLabel}</span>}

      <div style={s.tabRow}>
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          const status   = tab.getStatus(matchData);
          const count    = tab.getCount(matchData);
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => navigate(tab.path(matchId))}
              style={{
                ...s.tab,
                ...(isActive ? s.tabActive : s.tabInactive),
              }}
            >
              {tab.label}
              {status === "done" && (
                <span style={s.badgeDone}>✓</span>
              )}
              {status === "draft" && count && (
                <span style={s.badgeDraft}>{count}</span>
              )}
              {status === "draft" && !count && (
                <span style={s.dotDraft} />
              )}
              {isActive && <span style={s.activeDot} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const s = {
  wrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    padding: "12px 16px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: 700,
    color: "#94a3b8",
    letterSpacing: 0,
    lineHeight: 1.2,
  },
  tabRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  tab: {
    position: "relative",
    border: "1px solid transparent",
    borderRadius: 12,
    padding: "9px 18px",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
    transition: "background 0.18s, border-color 0.18s",
    lineHeight: 1.2,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  tabActive: {
    background: "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(37,99,235,0.16))",
    border: "1px solid rgba(56,189,248,0.38)",
    color: "#38bdf8",
  },
  tabInactive: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#94a3b8",
  },
  activeDot: {
    position: "absolute",
    bottom: -1,
    left: "50%",
    transform: "translateX(-50%)",
    width: 20,
    height: 2,
    borderRadius: 2,
    background: "#38bdf8",
  },
  badgeDone: {
    fontSize: 11,
    fontWeight: 900,
    color: "#22c55e",
    background: "rgba(34,197,94,0.15)",
    border: "1px solid rgba(34,197,94,0.3)",
    borderRadius: 6,
    padding: "1px 5px",
    lineHeight: 1.4,
  },
  badgeDraft: {
    fontSize: 11,
    fontWeight: 900,
    color: "#f59e0b",
    background: "rgba(245,158,11,0.15)",
    border: "1px solid rgba(245,158,11,0.3)",
    borderRadius: 6,
    padding: "1px 5px",
    lineHeight: 1.4,
  },
  dotDraft: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#f59e0b",
    display: "inline-block",
    flexShrink: 0,
  },
};
