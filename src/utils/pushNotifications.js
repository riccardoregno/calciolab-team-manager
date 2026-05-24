/**
 * pushNotifications.js
 * Gestisce registrazione push token, permessi e ricezione notifiche.
 * Funziona solo su dispositivi nativi (iOS / Android via Capacitor).
 * Su web è un no-op silenzioso.
 */
import { isNative } from "./capacitor";
import { supabase } from "../lib/supabaseClient";

let _registered = false;

/**
 * Registra il dispositivo per le push notification.
 * - Chiede il permesso all'utente (solo la prima volta su iOS)
 * - Ottiene il token FCM/APNs
 * - Salva il token su Supabase (tabella push_tokens)
 * - Installa i listener per notifiche in foreground e tap
 *
 * @param {{ teamId: string, userId: string }} param0
 * @returns {Promise<{ registered: boolean, token?: string, error?: string }>}
 */
export async function registerPushNotifications({ teamId, userId }) {
  if (!isNative) return { registered: false };
  if (_registered) return { registered: true };

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    // 1. Richiedi permesso
    const { receive } = await PushNotifications.checkPermissions();

    if (receive === "prompt" || receive === "prompt-with-rationale") {
      const result = await PushNotifications.requestPermissions();
      if (result.receive !== "granted") {
        return { registered: false, error: "Permesso notifiche negato" };
      }
    } else if (receive !== "granted") {
      return { registered: false, error: "Notifiche non disponibili" };
    }

    // 2. Registra dispositivo
    await PushNotifications.register();

    // 3. Listener: token ricevuto → salva su Supabase
    await PushNotifications.addListener("registration", async (tokenData) => {
      const token = tokenData.value;
      if (!token || !userId || !teamId) return;

      try {
        await supabase.from("push_tokens").upsert(
          {
            user_id: userId,
            team_id: teamId,
            token,
            platform: getPlatform(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,team_id" }
        );
      } catch (err) {
        if (import.meta.env.DEV) console.warn("[Push] Errore salvataggio token:", err);
      }
    });

    // 4. Listener: errore registrazione
    await PushNotifications.addListener("registrationError", (err) => {
      if (import.meta.env.DEV) console.warn("[Push] Errore registrazione:", err);
    });

    // 5. Listener: notifica ricevuta in foreground
    await PushNotifications.addListener("pushNotificationReceived", (notification) => {
      if (import.meta.env.DEV) console.log("[Push] Ricevuta:", notification);
      // Mostra in-app banner usando l'event bus
      window.dispatchEvent(
        new CustomEvent("calciolab:push", { detail: notification })
      );
    });

    // 6. Listener: tap su notifica (app in background/chiusa)
    await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      if (import.meta.env.DEV) console.log("[Push] Tap:", action);
      const data = action.notification?.data || {};
      if (data.path) {
        window.dispatchEvent(
          new CustomEvent("calciolab:push:navigate", { detail: { path: data.path } })
        );
      }
    });

    _registered = true;
    return { registered: true };
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[Push] Setup fallito:", err);
    return { registered: false, error: err?.message || "Errore push" };
  }
}

/** Rimuove tutti i listener push (es. al logout) */
export async function unregisterPushNotifications() {
  if (!isNative || !_registered) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.removeAllListeners();
    _registered = false;
  } catch {}
}

/** Elimina il token push dell'utente da Supabase (logout) */
export async function deletePushToken({ userId, teamId }) {
  if (!userId || !teamId) return;
  try {
    await supabase
      .from("push_tokens")
      .delete()
      .eq("user_id", userId)
      .eq("team_id", teamId);
  } catch {}
}

function getPlatform() {
  if (typeof window === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "web";
}
