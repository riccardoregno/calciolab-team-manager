import { useTranslation } from "../../i18n";
import { styles } from "../../styles/index.js";

export default function MatchScopeFilters({ scope }) {
  const { language } = useTranslation();
  if (!scope) return null;
  const en = language === "en";
  const field = { display: "grid", gap: 4, minWidth: 0, flex: "1 1 185px", fontSize: 13 };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, maxWidth: 600, marginBottom: 16 }}>
      {!scope.lockSeason && <label style={field}>
        {en ? "Season" : "Stagione"}
        <select style={{ ...styles.input, width: "100%" }} value={scope.season}
          onChange={(event) => scope.onChange({ season: event.target.value, competition: scope.competition })}>
          <option value="all">{en ? "All seasons" : "Tutte le stagioni"}</option>
          {scope.seasons.map((season) => <option key={season} value={season}>{season}</option>)}
        </select>
      </label>}
      <label style={field}>
        {en ? "Competition" : "Competizione"}
        <select style={{ ...styles.input, width: "100%" }} value={scope.competition}
          onChange={(event) => scope.onChange({ season: scope.season, competition: event.target.value })}>
          {scope.competitions.map(({ value, label }) => <option key={value} value={value}>
            {label || (value === "league" ? (en ? "League" : "Campionato") : (en ? "All competitions" : "Tutte le competizioni"))}
          </option>)}
        </select>
      </label>
    </div>
  );
}
