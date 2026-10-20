import { useSyncExternalStore } from "react";
const snapshot = () => Math.floor(Date.now() / 60000) * 60000;
function subscribe(notify) {
  const interval = window.setInterval(notify, 30000);
  window.addEventListener("focus", notify);
  return () => { window.clearInterval(interval); window.removeEventListener("focus", notify); };
}
export function useMinuteClock() { return useSyncExternalStore(subscribe, snapshot, () => 0); }
