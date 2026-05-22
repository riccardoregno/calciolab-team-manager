import { useSearchParams } from "react-router-dom";

/**
 * Like useState but synced to a URL search param.
 * The active tab survives page navigation, browser back/forward and
 * opening the same route in a new browser tab.
 *
 * Usage:
 *   const [activeTab, setActiveTab] = useTabState("tab", "cartella");
 *   // URL becomes e.g. /roster/42?tab=profilo
 *
 * @param {string} key          - URL search param name (e.g. "tab", "view")
 * @param {string} defaultValue - value used when the param is absent
 * @returns {[string, (value: string) => void]}
 */
export function useTabState(key, defaultValue) {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(key) || defaultValue;

  function setValue(newValue) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(key, newValue);
        return next;
      },
      { replace: true }
    );
  }

  return [value, setValue];
}
