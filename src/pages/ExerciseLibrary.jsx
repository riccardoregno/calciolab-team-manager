import { useMemo, useState } from "react";
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
  ageGroup: "Tutte",
  access: "Tutti",
};

export default function ExerciseLibrary({ exercises = [], appSettings = {} }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(filterDefaults);
  const premiumUnlocked = isFeatureUnlocked("aiSessionBuilder", appSettings);

  const options = useMemo(() => ({
    categories: unique(["Tutte", ...exercises.map((exercise) => exercise.category).filter(Boolean)]),
    intensities: unique(["Tutte", ...exercises.map((exercise) => exercise.intensity).filter(Boolean)]),
    ageGroups: unique(["Tutte", ...exercises.map((exercise) => exercise.ageGroup).filter(Boolean)]),
  }), [exercises]);

  const filtered = exercises.filter((exercise) => {
    const haystack = [
      exercise.title,
      exercise.category,
      exercise.objective,
      exercise.description,
      ...(exercise.tags || []),
    ].join(" ").toLowerCase();
    const matchesSearch = haystack.includes(search.toLowerCase());
    const matchesCategory = filters.category === "Tutte" || exercise.category === filters.category;
    const matchesIntensity = filters.intensity === "Tutte" || exercise.intensity === filters.intensity;
    const matchesAge = filters.ageGroup === "Tutte" || exercise.ageGroup === filters.ageGroup;
    const matchesAccess = filters.access === "Tutti"
      || (filters.access === "Free" && !exercise.premium)
      || (filters.access === "Premium" && exercise.premium);
    return matchesSearch && matchesCategory && matchesIntensity && matchesAge && matchesAccess;
  });

  return (
    <div style={libraryStyles.page}>
      <PageHeader
        title="Eserciziario Premium"
        subtitle="Filtra esercizi per obiettivo, eta', intensita' e accesso. Gli esercizi premium anticipano la libreria da 1000 contenuti."
        action={<Button onClick={() => navigate("/ai-session-builder")}>Builder AI</Button>}
      />

      <AppCard>
        <div style={libraryStyles.toolbar}>
          <SearchBar value={search} onChange={setSearch} placeholder="Cerca per tag, obiettivo, categoria..." />
          <FilterSelect label="Categoria" value={filters.category} options={options.categories} onChange={(value) => setFilters({ ...filters, category: value })} />
          <FilterSelect label="Intensita" value={filters.intensity} options={options.intensities} onChange={(value) => setFilters({ ...filters, intensity: value })} />
          <FilterSelect label="Eta" value={filters.ageGroup} options={options.ageGroups} onChange={(value) => setFilters({ ...filters, ageGroup: value })} />
          <FilterSelect label="Accesso" value={filters.access} options={["Tutti", "Free", "Premium"]} onChange={(value) => setFilters({ ...filters, access: value })} />
        </div>
      </AppCard>

      {filtered.length ? (
        <div style={libraryStyles.grid}>
          {filtered.map((exercise) => {
            const locked = exercise.premium && !premiumUnlocked;

            return (
              <AppCard key={exercise.id}>
                <div style={libraryStyles.cardHeader}>
                  <div>
                    <div style={libraryStyles.badges}>
                      <Badge tone={exercise.premium ? "orange" : "green"}>
                        {exercise.premium ? "Premium" : "Free"}
                      </Badge>
                      <Badge tone={exercise.intensity === "Alta" ? "red" : "blue"}>
                        {exercise.intensity || "Media"}
                      </Badge>
                    </div>
                    <h3 style={{ margin: "12px 0 6px" }}>{exercise.title}</h3>
                    <p style={libraryStyles.muted}>{exercise.category} · {exercise.duration} min · {exercise.playersRange || exercise.players || "-"} giocatori</p>
                  </div>
                  {locked && <div style={libraryStyles.lock}>🔒</div>}
                </div>

                <p style={libraryStyles.description}>
                  {locked ? "Sblocca Premium per vedere dettagli, varianti e coaching points." : exercise.description || exercise.objective}
                </p>

                <div style={libraryStyles.tags}>
                  {(exercise.tags || []).slice(0, 5).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>

                {!locked && (
                  <div style={libraryStyles.details}>
                    <Info label="Spazio" value={exercise.fieldSize || "-"} />
                    <Info label="Eta" value={exercise.ageGroup || "Tutte"} />
                    <Info label="Focus" value={exercise.goal || exercise.objective || "-"} />
                  </div>
                )}
              </AppCard>
            );
          })}
        </div>
      ) : (
        <EmptyState icon="🎯" title="Nessun esercizio" text="Modifica filtri o aggiungi nuovi esercizi alla libreria." />
      )}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <label style={libraryStyles.filter}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={styles.input}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function Info({ label, value }) {
  return (
    <div style={libraryStyles.info}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function unique(values) {
  return Array.from(new Set(values));
}

const libraryStyles = {
  page: { display: "grid", gap: 22 },
  toolbar: { display: "grid", gridTemplateColumns: "1.4fr repeat(4,minmax(130px,1fr))", gap: 12, alignItems: "end" },
  filter: { display: "grid", gap: 4, color: "#94a3b8", fontSize: 12, fontWeight: 900, textTransform: "uppercase" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 18 },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  badges: { display: "flex", gap: 8, flexWrap: "wrap" },
  muted: { color: "#94a3b8", margin: 0 },
  description: { color: "#cbd5e1", lineHeight: 1.55 },
  tags: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 },
  details: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10, marginTop: 16 },
  info: { padding: 10, borderRadius: 14, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" },
  lock: { width: 42, height: 42, borderRadius: 15, display: "grid", placeItems: "center", background: "rgba(251,191,36,0.14)", border: "1px solid rgba(251,191,36,0.28)" },
};
