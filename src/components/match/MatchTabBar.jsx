import { useNavigate } from "react-router-dom";

const TABS = [
  {
    key: "convocazione",
    label: "Convocazione",
    path: (id) => `/match-convocation/${id}`,
  },
  {
    key: "scheda",
    label: "Scheda Gara",
    path: (id) => `/match-day/${id}`,
  },
  {
    key: "statistiche",
    label: "Statistiche",
    path: (id) => `/match-stats/${id}`,
  },
  {
    key: "postgara",
    label: "Post Gara",
    path: (id) => `/post-match/${id}`,
  },
];

export default function MatchTabBar({ matchId, active, matchLabel }) {
  const navigate = useNavigate();

  if (!matchId) return null;

  return (
    <div style={s.wrap}>
      {matchLabel && <span style={s.label}>{matchLabel}</span>}

      <div style={s.tabRow}>
        {TABS.map((tab) => {
          const isActive = active === tab.key;
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
};
