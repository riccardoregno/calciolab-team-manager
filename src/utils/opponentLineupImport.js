export function normalizeBirthDate(value) {
  const text = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return "";
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1900 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? text : "";
}

export function ageAtMatch(birthDate, matchDate) {
  const birth = normalizeBirthDate(birthDate);
  const reference = normalizeBirthDate(String(matchDate || "").slice(0, 10));
  if (!birth || !reference || birth > reference) return null;
  const age = Number(reference.slice(0, 4)) - Number(birth.slice(0, 4)) - (reference.slice(5) < birth.slice(5) ? 1 : 0);
  return age <= 100 ? age : null;
}

export function normalizeExtractedPlayers(rows) {
  if (!Array.isArray(rows) || rows.length > 100) throw new Error("Elenco giocatori non valido.");
  return rows.map((row) => {
    const text = (value, max = 100) => typeof value === "string" ? value.trim().slice(0, max) : "";
    const birthDate = normalizeBirthDate(row?.birthDate);
    return {
      number: text(row?.number, 4), firstName: text(row?.firstName), lastName: text(row?.lastName), birthDate,
      needsReview: row?.needsReview !== false || !birthDate || !text(row?.firstName) || !text(row?.lastName),
    };
  }).filter((row) => row.firstName || row.lastName);
}

export function mergeImportedPlayers(existing, rows, makeId) {
  const normalizeName = (value) => String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("it");
  const result = [...existing];
  for (const row of rows) {
    const birthDate = normalizeBirthDate(row.birthDate);
    const player = { id: makeId(), number: row.number, firstName: row.firstName.trim(), lastName: row.lastName.trim(),
      name: [row.lastName.trim(), row.firstName.trim()].filter(Boolean).join(" "), birthDate, birthYear: birthDate.slice(0, 4),
      role: "", status: "Titolare", notes: "" };
    if (!player.name) continue;
    if (result.some((p) => normalizeName(p.name) === normalizeName(player.name) &&
      (p.birthDate ? p.birthDate === birthDate : (p.birthYear || "") === player.birthYear))) continue;
    result.push(player);
  }
  return result;
}

