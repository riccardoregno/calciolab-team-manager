import { useMemo } from "react";
import { normalizeAppSettings } from "../utils/helpers";

// FIX #13: hook che memoizza normalizeAppSettings per evitare riallocazioni O(n)
// ad ogni render nei componenti che chiamano normalizeAppSettings(appSettings) direttamente.
//
// normalizeAppSettings alloca nuovi array per members, sponsors, communications e physicalMetrics
// ad ogni invocazione. Con 50 membri e 20 sponsor questo è ~100 allocazioni per render.
//
// Uso: const settings = useAppSettings(appSettings);
// invece di: const settings = normalizeAppSettings(appSettings);
//
// Il risultato è stabile finché `appSettings` (riferimento oggetto) non cambia.
export function useAppSettings(appSettings) {
  return useMemo(() => normalizeAppSettings(appSettings), [appSettings]);
}
