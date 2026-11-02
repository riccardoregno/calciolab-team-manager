import { useCallback, useEffect, useRef, useState } from "react";
import Button from "../ui/Button";
import { extractOpponentLineup } from "../../services/opponentLineupOcr";
import { ageAtMatch } from "../../utils/opponentLineupImport.js";
import { matchDayStyles } from "../../styles/matchDay";

export default function OpponentLineupImport({ attachment, teamId, matchDate, autoReadPath, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(null);
  const generation = useRef(0);
  const read = useCallback(async () => {
    const token = ++generation.current;
    setBusy(true); setError(""); setDraft(null);
    try {
      const result = await extractOpponentLineup({ teamId, attachment });
      if (token === generation.current) setDraft(result);
    } catch (e) {
      if (token === generation.current) setError(e.message);
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }, [attachment, teamId]);

  useEffect(() => {
    const timer = autoReadPath && autoReadPath === attachment.path ? setTimeout(() => { void read(); }, 0) : null;
    return () => { if (timer !== null) clearTimeout(timer); };
  }, [autoReadPath, attachment.path, read]);

  useEffect(() => () => { generation.current += 1; }, []);

  function edit(index, field, value) {
    setDraft((current) => ({ ...current, players: current.players.map((p, i) => i === index ? { ...p, [field]: value } : p) }));
  }

  return <div style={{ margin: "16px 0" }}>
    <Button variant="ghost" disabled={busy} onClick={read}>{busy ? "Lettura distinta in corso…" : "Leggi giocatori dalla distinta"}</Button>
    {busy && <p role="status">Sto leggendo nomi e date di nascita.</p>}
    {error && <p role="alert" style={{ color: "#fca5a5" }}>{error}</p>}
    {draft && <div>
      <h4>Controlla i {draft.players.length} giocatori letti{draft.teamName ? " — " + draft.teamName : ""}</h4>
      <p>Verifica che la squadra sia quella avversaria e correggi i dati prima di confermare. Le righe evidenziate contengono dati incerti o mancanti. Età alla data della partita.</p>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 650, textAlign: "left" }}>
        <thead><tr>{["Importa", "N°", "Cognome", "Nome", "Data di nascita", "Età", "Verifica"].map((label) => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{draft.players.map((player, index) => <tr key={index} style={{ background: player.needsReview ? "rgba(245,158,11,.12)" : undefined }}>
          <td><input type="checkbox" aria-label={"Importa giocatore " + (index + 1)} checked={player.include !== false} onChange={(e) => edit(index, "include", e.target.checked)} /></td>
          {["number", "lastName", "firstName", "birthDate"].map((field) => <td key={field}><input aria-label={field + " giocatore " + (index + 1)} type={field === "birthDate" ? "date" : "text"} style={matchDayStyles.compactInput} value={player[field]} onChange={(e) => edit(index, field, e.target.value)} /></td>)}
          <td>{ageAtMatch(player.birthDate, matchDate) ?? "—"}</td><td>{player.needsReview ? "Da verificare" : ""}</td>
        </tr>)}</tbody>
      </table></div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Button disabled={!draft.players.some((p) => p.include !== false && (p.firstName.trim() || p.lastName.trim()))} onClick={() => { onConfirm(draft.players.filter((p) => p.include !== false)); setDraft(null); }}>Conferma importazione</Button>
        <Button variant="ghost" onClick={() => setDraft(null)}>Annulla</Button>
      </div>
      <p>I giocatori già inseriti vengono conservati; le copie con stesso nome e data di nascita vengono ignorate.</p>
    </div>}
  </div>;
}



