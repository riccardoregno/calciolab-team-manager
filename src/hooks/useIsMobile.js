import { useCallback, useSyncExternalStore } from "react";

/**
 * Ritorna true se la viewport è più stretta di `breakpoint` px.
 * Usa matchMedia per reagire solo al crossing della soglia, non ad ogni pixel di resize.
 *
 * @param {number} breakpoint - larghezza massima (esclusa) considerata "mobile". Default 760.
 */
export function useIsMobile(breakpoint = 760) {
  const query = `(max-width: ${breakpoint - 1}px)`;
  const subscribe = useCallback((notify) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", notify);
    return () => media.removeEventListener("change", notify);
  }, [query]);
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
