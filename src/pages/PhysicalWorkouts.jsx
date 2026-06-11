import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import { generatePhysicalWorkout, normalizeAppSettings, formatDate } from "../utils/helpers";
import { useIsMobile } from "../hooks/useIsMobile";
import { useTranslation } from "../i18n";

const GROUP_TONE = {
  "Gruppo A": "green",
  "Gruppo B": "blue",
  "Gruppo C": "orange",
  "Gruppo D": "red",
  "Da testare": "purple",
};

const GROUP_COLOR = {
  "Gruppo A": "#22c55e",
  "Gruppo B": "#38bdf8",
  "Gruppo C": "#fbbf24",
  "Gruppo D": "#f87171",
  "Da testare": "#a78bfa",
};

// Maps internal Italian group keys → i18n paths (data never changes; display is translated)
const GROUP_LABEL_KEYS = {
  "Gruppo A":   "pages.physicalWorkouts.groupA",
  "Gruppo B":   "pages.physicalWorkouts.groupB",
  "Gruppo C":   "pages.physicalWorkouts.groupC",
  "Gruppo D":   "pages.physicalWorkouts.groupD",
  "Da testare": "pages.physicalWorkouts.groupUntested",
  "Tutti":      "pages.physicalWorkouts.groupAll",
};

export default function PhysicalWorkouts({
  players = [], physicalTests = [], appSettings }) {

  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const settings = useMemo(() => normalizeAppSettings(appSettings), [appSettings]);
  const [groupFilter, setGroupFilter] = useState("Tutti");

  // Returns a translated label for a group tab. Extracts the letter for "Gruppo X" / "Group X"
  // so tabs show compact "A / B / C / D" in any language; "Untested" for the fifth group.
  function getGroupLabel(g) {
    return t(GROUP_LABEL_KEYS[g] || "pages.physicalWorkouts.groupA");
  }
  function getGroupTabLabel(g) {
    if (g === "Tutti") return t("pages.physicalWorkouts.tabAll", { count: rows.length });
    const letter = getGroupLabel(g).match(/\b([A-D])\b/)?.[1];
    return letter || getGroupLabel(g);
  }
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const rows = generatePhysicalWorkout(players, physicalTests, settings.coachParameters);
  const filtered = rows.filter((row) => {
    const matchGroup = groupFilter === "Tutti" || row.reference.group === groupFilter;
    const matchSearch = row.player.name.toLowerCase().includes(search.toLowerCase());
    return matchGroup && matchSearch;
  });

  // KPI
  const tested = rows.filter((r) => r.reference.mas > 0).length;
  const untested = rows.length - tested;
  const groupCounts = rows.reduce((acc, r) => {
    acc[r.reference.group] = (acc[r.reference.group] || 0) + 1;
    return acc;
  }, {});
  const avgMas = tested > 0
    ? (rows.filter((r) => r.reference.mas > 0).reduce((s, r) => s + r.reference.mas, 0) / tested).toFixed(1)
    : null;

  if (players.length === 0) {
    return (
      <div>
        <PageHeader title={t("pages.physicalWorkouts.title")} subtitle={t("pages.physicalWorkouts.subtitle")} />
        <EmptyState
          icon="🏃"
          title={t("pages.physicalWorkouts.emptyTitle")}
          text={t("pages.physicalWorkouts.emptyText")}
        />
      </div>
    );
  }

  const GROUPS = ["Tutti", "Gruppo A", "Gruppo B", "Gruppo C", "Gruppo D", "Da testare"];

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <PageHeader
        title={t("pages.physicalWorkouts.title")}
        subtitle={t("pages.physicalWorkouts.subtitle")}
        action={
          <Button variant="ghost" onClick={() => navigate("/physical-tests")}>
            {t("pages.physicalWorkouts.updateTestsBtn")}
          </Button>
        }
      />

      {/* KPI */}
      <div style={pw.kpiRow} className="no-mobile-override">
        <KpiBox label={t("pages.physicalWorkouts.kpiTotal")} value={rows.length} icon="👥" color="#38bdf8" />
        <KpiBox label={t("pages.physicalWorkouts.kpiTested")} value={tested} icon="✅" color="#22c55e" />
        <KpiBox label={t("pages.physicalWorkouts.kpiUntested")} value={untested} icon="⚠️" color="#fbbf24" />
        {avgMas && <KpiBox label={t("pages.physicalWorkouts.kpiAvgMas")} value={`${avgMas} km/h`} icon="⚡" color="#a78bfa" />}
      </div>

      {/* Distribuzione gruppi */}
      <AppCard>
        <p style={pw.eyebrow}>{t("pages.physicalWorkouts.groupDistribution")}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
          {["Gruppo A", "Gruppo B", "Gruppo C", "Gruppo D", "Da testare"].map((g) => (
            <div key={g} style={pw.groupChip}>
              <span style={{ ...pw.groupDot, background: GROUP_COLOR[g] }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1" }}>{getGroupLabel(g)}</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: GROUP_COLOR[g], marginLeft: 4 }}>
                {groupCounts[g] || 0}
              </span>
            </div>
          ))}
        </div>
        <div style={pw.progressBar}>
          {["Gruppo A", "Gruppo B", "Gruppo C", "Gruppo D", "Da testare"].map((g) => {
            const pct = rows.length ? ((groupCounts[g] || 0) / rows.length) * 100 : 0;
            return pct > 0 ? (
              <div
                key={g}
                title={`${getGroupLabel(g)}: ${groupCounts[g] || 0}`}
                style={{ width: `${pct}%`, background: GROUP_COLOR[g], height: "100%", borderRadius: 4 }}
              />
            ) : null;
          })}
        </div>
      </AppCard>

      {/* Filtri */}
      <div style={pw.filtersRow}>
        <div style={{ position: "relative", flex: 1, minWidth: 180, maxWidth: 320 }}>
          <span style={pw.searchIcon}>⌕</span>
          <input
            placeholder={t("pages.physicalWorkouts.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...pw.searchInput, paddingLeft: 36 }}
          />
        </div>
        <div style={pw.groupTabs}>
          {GROUPS.map((g) => (
            <button
              key={g}
              onClick={() => setGroupFilter(g)}
              style={{
                ...pw.tab,
                background: groupFilter === g ? `${GROUP_COLOR[g] || "#38bdf8"}22` : "rgba(255,255,255,0.04)",
                border: `1px solid ${groupFilter === g ? (GROUP_COLOR[g] || "#38bdf8") + "55" : "rgba(255,255,255,0.08)"}`,
                color: groupFilter === g ? (GROUP_COLOR[g] || "#38bdf8") : "#94a3b8",
              }}
            >
              {getGroupTabLabel(g)}
            </button>
          ))}
        </div>
      </div>

      {/* Griglia player cards */}
      {filtered.length === 0 ? (
        <EmptyState icon="🔍" title={t("pages.physicalWorkouts.emptyFilter")} text={t("pages.physicalWorkouts.emptyFilterText")} />
      ) : (
        <div style={pw.grid}>
          {filtered.map(({ player, latest, reference }) => {
            const isExpanded = expandedId === player.id;
            const hasMas = reference.mas > 0;

            return (
              <AppCard key={player.id} style={{ cursor: "pointer" }}>
                {/* Header */}
                <div style={pw.cardHeader}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <div style={{ ...pw.avatar, background: `${GROUP_COLOR[reference.group]}22`, border: `1px solid ${GROUP_COLOR[reference.group]}44` }}>
                      <span style={{ fontSize: 18 }}>
                        {hasMas ? "🏃" : "⚠️"}
                      </span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: 15, display: "block", lineHeight: 1.2 }}>{player.name}</strong>
                      <span style={{ fontSize: 12, color: "#64748b" }}>{player.role || t("pages.physicalWorkouts.roleFallback")}</span>
                    </div>
                  </div>
                  <Badge tone={GROUP_TONE[reference.group]}>{getGroupLabel(reference.group)}</Badge>
                </div>

                {/* Info principali */}
                <div style={pw.infoRow}>
                  {hasMas ? (
                    <>
                      <InfoChip label={t("pages.physicalWorkouts.masLabel")} value={`${reference.mas} km/h`} color="#38bdf8" />
                      <InfoChip label={t("pages.physicalWorkouts.intensityLabel")} value={reference.intensity} color={GROUP_COLOR[reference.group]} />
                      {latest?.date && <InfoChip label={t("pages.physicalWorkouts.testLabel")} value={formatDate(latest.date)} color="#64748b" />}
                    </>
                  ) : (
                    <p style={{ color: "#64748b", fontSize: 13, margin: 0, lineHeight: 1.4 }}>
                      {t("pages.physicalWorkouts.noTestText")}
                    </p>
                  )}
                </div>

                {/* Blocchi lavoro */}
                {hasMas && reference.reps.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : player.id)}
                      style={pw.expandBtn}
                    >
                      {isExpanded ? t("pages.physicalWorkouts.hideDetails") : t("pages.physicalWorkouts.showPrescription")}
                    </button>

                    {isExpanded && (
                      <div style={pw.repGrid}>
                        <div style={{ ...pw.repHeader, gridTemplateColumns: isMobile ? "1fr 60px 80px 55px" : "1fr 80px 100px 80px" }}>
                          <span>{t("pages.physicalWorkouts.repHeaderBlock")}</span>
                          <span>{t("pages.physicalWorkouts.repHeaderMeters")}</span>
                          <span>{t("pages.physicalWorkouts.repHeaderReps")}</span>
                          <span>{t("pages.physicalWorkouts.repHeaderRecovery")}</span>
                        </div>
                        {reference.reps.map((rep, i) => (
                          <div key={i} style={{ ...pw.repRow, gridTemplateColumns: isMobile ? "1fr 60px 80px 55px" : "1fr 80px 100px 80px" }}>
                            <span style={{ fontWeight: 700 }}>{rep.label}</span>
                            <span style={{ color: "#38bdf8", fontWeight: 800 }}>{rep.meters}m</span>
                            <span style={{ color: "#cbd5e1" }}>{rep.reps} × {rep.sets}</span>
                            <span style={{ color: "#94a3b8" }}>{rep.recovery}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </AppCard>
            );
          })}
        </div>
      )}

      {/* Call to action se ci sono giocatori da testare */}
      {untested > 0 && (
        <AppCard>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <strong style={{ fontSize: 15 }}>{t("pages.physicalWorkouts.untestedBanner", { count: untested })}</strong>
              <p style={{ color: "#94a3b8", margin: "4px 0 0", fontSize: 13, lineHeight: 1.4 }}>
                {t("pages.physicalWorkouts.untestedDesc")}
              </p>
            </div>
            <Button onClick={() => navigate("/physical-tests")}>
              {t("pages.physicalWorkouts.untestedBtn")}
            </Button>
          </div>
        </AppCard>
      )}
    </div>
  );
}

function KpiBox({ label, value, icon, color }) {
  return (
    <div style={{ ...pw.kpiBox, borderColor: `${color}33` }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>{label}</p>
        <strong style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</strong>
      </div>
    </div>
  );
}

function InfoChip({ label, value, color }) {
  return (
    <div style={pw.infoChip}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#475569" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: color || "#e2e8f0" }}>{value}</span>
    </div>
  );
}

const pw = {
  kpiRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 14,
  },
  kpiBox: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "16px 18px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid",
  },
  eyebrow: {
    margin: "0 0 12px",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0,
    color: "#475569",
  },
  groupChip: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  groupDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  },
  progressBar: {
    display: "flex",
    gap: 3,
    height: 8,
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 14,
    background: "rgba(255,255,255,0.06)",
  },
  filtersRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  searchIcon: {
    position: "absolute",
    left: 11,
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 14,
    color: "#475569",
    pointerEvents: "none",
  },
  searchInput: {
    width: "100%",
    height: 40,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "white",
    fontSize: 14,
    padding: "0 12px",
  },
  groupTabs: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  tab: {
    height: 36,
    padding: "0 14px",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: 16,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },
  infoRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  infoChip: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "7px 10px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    flex: "0 0 auto",
  },
  expandBtn: {
    width: "100%",
    padding: "8px 0",
    background: "none",
    border: "none",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "center",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    marginTop: 4,
  },
  repGrid: {
    display: "grid",
    gap: 6,
    marginTop: 10,
  },
  repHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 80px 100px 80px",
    gap: 8,
    padding: "6px 10px",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    color: "#475569",
  },
  repRow: {
    display: "grid",
    gridTemplateColumns: "1fr 80px 100px 80px",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    fontSize: 13,
    alignItems: "center",
  },
};
