export function toggleFavoritePath(current, path, allowedPaths, limit = 8) {
  if (current.includes(path)) return current.filter((value) => value !== path);
  const allowed = new Set(allowedPaths);
  if (!allowed.has(path)) return current;
  const visible = current.filter((value) => allowed.has(value));
  if (visible.length >= limit) return current;
  // A changed role must not leave the user blocked by eight inaccessible favorites.
  const retained = current.length >= limit ? visible : current;
  return [...retained, path];
}
