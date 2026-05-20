import { useEffect, useState } from "react";

/**
 * Ritorna true se la viewport è più stretta di `breakpoint` px.
 * Usa matchMedia per reagire solo al crossing della soglia, non ad ogni pixel di resize.
 *
 * @param {number} breakpoint - larghezza massima (esclusa) considerata "mobile". Default 760.
 */
export function useIsMobile(breakpoint = 760) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < breakpoint
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}
