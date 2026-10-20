import { useCallback, useMemo, useSyncExternalStore } from "react";
import { toggleFavoritePath } from "../utils/navigationFavorites";

const eventName = "calciolab-navigation-favorites";
const temporary = new Map();
const failures = new Set();
const LIMIT = 8;

function parse(raw) {
  try { const values = JSON.parse(raw || "[]"); return Array.isArray(values) ? [...new Set(values.filter((value) => typeof value === "string"))].slice(0, LIMIT) : []; }
  catch { return []; }
}

export function useNavigationFavorites(scope = "local") {
  const key = `calciolab-navigation-v1:${scope}`;
  const getSnapshot = useCallback(() => {
    if (temporary.has(key)) return temporary.get(key);
    try { return localStorage.getItem(key) || "[]"; } catch { return "[]"; }
  }, [key]);
  const subscribe = useCallback((notify) => {
    const onStorage = (event) => { if (event.key === key || event.key === null) { temporary.delete(key); failures.delete(key); notify(); } };
    window.addEventListener(eventName, notify);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(eventName, notify); window.removeEventListener("storage", onStorage); };
  }, [key]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => "[]");
  const favorites = useMemo(() => parse(raw), [raw]);
  const toggleFavorite = useCallback((path, allowedPaths = [path]) => {
    const current = parse(getSnapshot());
    const next = toggleFavoritePath(current, path, allowedPaths, LIMIT);
    const serialized = JSON.stringify(next);
    temporary.set(key, serialized);
    try { localStorage.setItem(key, serialized); failures.delete(key); }
    catch { failures.add(key); }
    window.dispatchEvent(new Event(eventName));
  }, [key, getSnapshot]);
  return { favorites, toggleFavorite, limit: LIMIT, persistent: !failures.has(key) };
}
