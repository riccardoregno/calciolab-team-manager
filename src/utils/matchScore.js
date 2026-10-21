// Empty scores mean scheduled; a partial score must never erase an existing result.
export function isValidMatchScore(scored, conceded) {
  const values = [scored, conceded].map((value) => String(value ?? "").trim());
  return values.every((value) => value === "") || values.every((value) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)));
}
