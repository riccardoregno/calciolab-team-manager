import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AppCard from "../components/ui/AppCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import SearchBar from "../components/ui/SearchBar";
import { styles } from "../styles/index.js";
import { isFeatureUnlocked } from "../utils/helpers";

const filterDefaults = {
  category: "Tutte",
  intensity: "Tutte",
  phase: "Tutte",
};

export default function ExerciseLibrary({ appSettings = {} }) {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(filterDefaults);
  const [expandedId, setExpandedId] = useState(null);

  const premiumUnlocked = isFeatureUnlocked("exerciseLibrary", appSettings);

  // Carica gli 893 esercizi FP5 in lazy load al mount
  useEffect(() => {
    import("../data/eserciziarioFp5.js")
      .then(({ eserciziarioFp5 }) => {
        setCatalog(eserciziarioFp5);
      })
      .catch(() => {
        setCatalog([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const options = useMemo(() => ({
    categories: ["Tutte", ...Array.from(new Set(catalog.map((e) => e.category).filter(Boolean))).sort()],
    intensities: ["Tutte", ...Array.from(new Set(catalog.map((e) => e.intensity).filter(Boolean))).sort()],
    phases:      ["Tutte", ...Array.from(new Set(catalog.map((e) => e.phase).filter(Boolean))).sort()],
  }), [catalog]);

  const filtered = useMemo(() => catalog.filter((ex) => {
    const haystack = [ex.title, ex.category, ex.objective, ex.description, ...(ex.tags || [])]
      .join(" ").toLowerCase();
    return (
      haystack.includes(search.toLowerCase()) &&
      (filters.category  === "Tutte" || ex.category  === filters.category) &&
      (filters.intensity === "Tutte" || ex.intensity === filters.intensity) &&
      (filters.phase     === "Tutte" || ex.phase     === filters.phase)
    );
  }), [catalog, search, filters]);

  if (loading) {
    return (
      <div style={{ display: "grid", gap: 22 }}>
        <PageHeader title="Eserciziario" subtitle="Caricamento catalogo esercizi..." />
        <AppCard>
          <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p style={{ margin: 0 }}>Caricamento 893 esercizi...</p>
          </div>
        </AppCard>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <PageHeader
        title="Eserciziario"
        subtitle={`${catalog.length} esercizi · ${premiumUnlocked ? "Accesso completo" : "Sblocca Premium per vedere diagrammi e descrizioni"}`}
        action={
          !premiumUnlocked && (
            <Button onClick={() => navigate("/premium")}>
              🔓 Sblocca Premium
            </Button>
          )
        }
      />

      {/* Filtri */}
      <AppCard>
        <div style={libStyles.toolbar}>
          <SearchBar value={search} onChange={setSearch} placeholder="Cerca per titolo, categoria, tag..." />
          <FilterSelect label="Categoria"  value={filters.category}  options={options.categories}  onChange={(v) => setFilters({ ...filters, category: v })} />
          <FilterSelect label="Fase"       value={filters.phase}     options={options.phases}      onChange={(v) => setFilters({ ...filters, phase: v })} />
          <FilterSelect label="Intensità"  value={filters.intensity} options={options.intensities} onChange={(v) => setFilters({ ...filters, intensity: v })} />
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Badge tone="blue">{filtered.length} esercizi</Badge>
          {!premiumUnlocked && (
            <Badge tone="orange">🔒 Dettagli e diagrammi riservati agli abbonati Premium</Badge>
          )}
        </div>
      </AppCard>

      {/* Lista esercizi */}
      {filtered.length === 0 ? (
        <EmptyState icon="🎯" title="Nessun esercizio trovato" text="Prova a modificare i filtri di ricerca." />
      ) : (
        <div style={libStyles.grid}>
          {filtered.map((ex) => {
            const isExpanded = expandedId === ex.id;
            const locked = !premiumUnlocked;

            return (
              <AppCard key={ex.id}>
                {/* Header card */}
                <div style={libStyles.cardHead}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                      <Badge tone={locked ? "orange" : "green"}>{locked ? "🔒 Premium" : "✓ Premium"}</Badge>
                      <Badge tone={ex.intensity === "Alta" ? "red" : ex.intensity === "Bassa" ? "blue" : "default"}>
                        {ex.intensity || "Media"}
                      </Badge>
                      {ex.phase && <Badge tone="default">{ex.phase}</Badge>}
                    </div>
                    <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>
                      {ex.title}
                    </h3>
                    <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                      {ex.category} · {ex.duration ? `${ex.duration} min` : ""}{ex.players ? ` · ${ex.players} gioc.` : ""}
                    </p>
                  </div>

                  {/* Thumbnail SVG — visibile a tutti (teaser) */}
                  {ex.image && (
                    <div style={libStyles.thumb}>
                      <img src={ex.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
                      {locked && (
                        <div style={libStyles.thumbOverlay}>🔒</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Tag */}
                {(ex.tags || []).length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                    {(ex.tags || []).slice(0, 5).map((tag) => (
                      <span key={tag} style={libStyles.tag}>{tag}</span>
                    ))}
                  </div>
                )}

                {/* Contenuto premium o lock banner */}
                {locked ? (
                  <div style={libStyles.lockBanner}>
                    <p style={{ margin: "0 0 10px", fontSize: 13, color: "#94a3b8" }}>
                      Sblocca Premium per accedere a descrizione completa, diagramma tattico, varianti e coaching points.
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => navigate("/premium")}>
                      Scopri Premium →
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Descrizione con espandi/comprimi */}
                    {ex.description && (
                      <div style={{ marginTop: 12 }}>
                        <p style={{ margin: 0, fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                          {isExpanded || ex.description.length <= 140
                            ? ex.description
                            : `${ex.description.slice(0, 140)}…`}
                        </p>
                        {ex.description.length > 140 && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : ex.id)}
                            style={libStyles.expandBtn}
                          >
                            {isExpanded ? "Mostra meno ▲" : "Mostra tutto ▼"}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Dettagli */}
                    <div style={libStyles.details}>
                      {ex.fieldSize  && <Info label="Campo"     value={ex.fieldSize} />}
                      {ex.material   && <Info label="Materiale" value={ex.material} />}
                      {ex.ageGroup   && <Info label="Età"       value={ex.ageGroup} />}
                      {ex.goal       && <Info label="Focus"     value={ex.goal} />}
                      {ex.objective  && <Info label="Obiettivo" value={ex.objective} />}
                    </div>

                    {/* Varianti */}
                    {isExpanded && ex.variants && (
                      <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Varianti</p>
                        <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.55 }}>{ex.variants}</p>
                      </div>
                    )}
                  </>
                )}
              </AppCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <label style={{ display: "grid", gap: 4, color: "#94a3b8", fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={styles.input}>
        {options.map((opt) => <option key={opt}>{opt}</option>)}
      </select>
    </label>
  );
}

function Info({ label, value }) {
  return (
    <div style={{ padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: "#94a3b8" }}>{value}</div>
    </div>
  );
}

const libStyles = {
  toolbar: {
    display: "grid",
    gridTemplateColumns: "1.4fr repeat(3, minmax(120px, 1fr))",
    gap: 12,
    alignItems: "end",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
    gap: 18,
  },
  cardHead: {
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
  },
  thumb: {
    position: "relative",
    width: 90,
    height: 64,
    flexShrink: 0,
    borderRadius: 10,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  thumbOverlay: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    background: "rgba(0,0,0,0.55)",
    fontSize: 20,
    backdropFilter: "blur(2px)",
  },
  tag: {
    padding: "2px 8px",
    borderRadius: 20,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    fontSize: 11,
    color: "#64748b",
  },
  lockBanner: {
    marginTop: 14,
    padding: "14px 16px",
    borderRadius: 12,
    background: "rgba(251,191,36,0.06)",
    border: "1px solid rgba(251,191,36,0.2)",
  },
  details: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
    gap: 8,
    marginTop: 12,
  },
  expandBtn: {
    marginTop: 6,
    background: "none",
    border: "none",
    color: "#38bdf8",
    fontSize: 12,
    cursor: "pointer",
    padding: 0,
  },
};
