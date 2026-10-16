import AppCard from "../ui/AppCard";
import FilterChips from "../ui/FilterChips";
import MetricStrip from "../ui/MetricStrip";

function FineStepper({ name, value, editable, onChange, formatAmount }) {
  if (!editable) return <span>{formatAmount(value)}</span>;
  return (
    <div className="cl-fine-stepper">
      <button type="button" aria-label={`Riduci multa torello di ${name}`} disabled={value <= 0} onClick={() => onChange(-1)}>−</button>
      <span>{formatAmount(value)}</span>
      <button type="button" aria-label={`Aumenta multa torello di ${name}`} onClick={() => onChange(1)}>+</button>
    </div>
  );
}

export default function MiniMatchFinesView({ rows, weekOptions, selectedWeek, onWeekChange, sortMode, onSortChange, groupFilter, onGroupChange, editable, onTorelloChange, totalSessions, totals, formatAmount }) {
  const period = weekOptions.find((week) => week.value === selectedWeek)?.label || "Totale";
  const stepper = (row) => <FineStepper name={row.name} value={row.torello} editable={editable} onChange={(delta) => onTorelloChange(row.p.id, delta)} formatAmount={formatAmount} />;
  return (
    <AppCard className="cl-fines-workspace" title="Statistiche partitelle" subtitle={`${period} · ${totalSessions} partitelle con risultato`}>
      <MetricStrip items={[
        { label: "Partitelle", value: totalSessions },
        { label: "Multe partitelle", value: formatAmount(totals.partitelle) },
        { label: "Multe torello", value: formatAmount(totals.torello) },
        { label: "Totale cassa", value: formatAmount(totals.total), color: "#93c5fd" },
      ]} min={150} />
      <div className="cl-fines-filters">
        <div className="cl-filter-field">
          <span className="cl-field-caption">Periodo</span>
          <FilterChips label="Settimana delle multe" className="cl-filter-scroll" options={weekOptions} value={selectedWeek} onChange={onWeekChange} />
        </div>
        <div className="cl-fines-toolbar">
          <FilterChips label="Gruppo giocatori" value={groupFilter} onChange={onGroupChange} options={[{ value: "prima", label: "Prima squadra" }, { value: "tutti", label: "Tutti" }]} />
          <FilterChips label="Ordina le multe" value={sortMode} onChange={onSortChange} options={[{ value: "alpha", label: "Nome A–Z" }, { value: "fineDesc", label: "Importo ↓" }, { value: "fineAsc", label: "Importo ↑" }]} />
        </div>
        <p className="cl-context-note">Ogni settimana parte dal lunedì indicato. Le multe delle partitelle dipendono dai risultati registrati.</p>
      </div>
      <div className="cl-fines-desktop cl-table-scroll" tabIndex={0} role="region" aria-label="Tabella multe, scorri per vedere tutte le colonne">
        <table className="cl-data-table cl-fines-table">
          <thead><tr>{["Giocatore", "Vinte", "Perse", "Pari", "Partitelle", "Torello", "Totale"].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.p.id}>
              <th scope="row">{row.name}</th>
              <td className="cl-number-positive">{row.wins}</td>
              <td>{row.losses}</td>
              <td>{row.draws}</td>
              <td>{formatAmount(row.fine)}</td>
              <td>{stepper(row)}</td>
              <td className="cl-fine-total">{formatAmount(row.totalFine)}</td>
            </tr>
          ))}</tbody>
          <tfoot><tr><th scope="row">Totale cassa</th><td colSpan={3} /><td>{formatAmount(totals.partitelle)}</td><td>{formatAmount(totals.torello)}</td><td className="cl-fine-total">{formatAmount(totals.total)}</td></tr></tfoot>
        </table>
      </div>
      <div className="cl-fines-mobile" role="list" aria-label="Multe per giocatore">
        {rows.map((row) => (
          <details className="cl-fine-player" key={row.p.id} role="listitem">
            <summary className="cl-fine-player-heading"><h4>{row.name}</h4><strong>{formatAmount(row.totalFine)}</strong></summary>
            <dl className="cl-fine-player-results"><div><dt>Vinte</dt><dd>{row.wins}</dd></div><div><dt>Perse</dt><dd>{row.losses}</dd></div><div><dt>Pari</dt><dd>{row.draws}</dd></div></dl>
            <div className="cl-fine-player-line"><span>Partitelle</span><strong>{formatAmount(row.fine)}</strong></div>
            <div className="cl-fine-player-line"><span>Torello</span>{stepper(row)}</div>
          </details>
        ))}
      </div>
      {rows.length === 0 && <p className="cl-context-note">Nessun giocatore nel gruppo selezionato.</p>}
    </AppCard>
  );
}
