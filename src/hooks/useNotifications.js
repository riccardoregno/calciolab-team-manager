import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useNotifications — gestisce i permessi e l'invio di notifiche browser.
 *
 * Uso:
 *   const { permission, requestPermission, notify, supported } = useNotifications();
 *
 * notify({ title, body, icon, tag }) invia una notifica se il permesso è granted.
 */
export function useNotifications() {
  const supported = typeof window !== "undefined" && "Notification" in window;

  const [permission, setPermission] = useState(
    supported ? Notification.permission : "denied"
  );

  // Sincronizza il permesso dopo che l'utente lo cambia dalle impostazioni del browser
  const intervalRef = useRef(null);
  useEffect(() => {
    if (!supported) return;
    intervalRef.current = setInterval(() => {
      const current = Notification.permission;
      setPermission((prev) => prev !== current ? current : prev);
    }, 2000);
    return () => clearInterval(intervalRef.current);
  }, [supported]);

  const requestPermission = useCallback(async () => {
    if (!supported) return "denied";
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, [supported]);

  const notify = useCallback(
    ({ title, body = "", icon = "/favicon.svg", tag = "" }) => {
      if (!supported || permission !== "granted") return null;
      try {
        return new Notification(title, { body, icon, tag });
      } catch {
        return null;
      }
    },
    [supported, permission]
  );

  return { supported, permission, requestPermission, notify };
}

/**
 * useEventReminders — controlla eventi imminenti e spara notifiche.
 * Viene chiamato una volta all'avvio, poi ogni ora.
 *
 * @param {object} params
 * @param {array}  params.sessions  — sedute di allenamento
 * @param {array}  params.matches   — partite
 * @param {array}  params.players   — giocatori (per infortuni)
 * @param {boolean} params.enabled  — notifiche attive
 */
export function useEventReminders({ sessions = [], matches = [], players = [], enabled = false }) {
  const { permission, notify } = useNotifications();

  useEffect(() => {
    if (!enabled || permission !== "granted") return;

    function checkReminders() {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(tomorrow.getDate() + 1);

      // Partite domani
      matches
        .filter((m) => {
          const d = new Date(m.date);
          return d >= tomorrow && d < dayAfter;
        })
        .forEach((m) => {
          notify({
            title: "⚽ Partita domani",
            body: `${m.opponent || "Avversario"} · ${m.location || ""}`,
            tag: `match-${m.id}`,
          });
        });

      // Sedute domani
      sessions
        .filter((s) => {
          const d = new Date(s.date);
          return d >= tomorrow && d < dayAfter;
        })
        .forEach((s) => {
          notify({
            title: "📋 Allenamento domani",
            body: s.title || "Seduta programmata",
            tag: `session-${s.id}`,
          });
        });

      // Giocatori infortunati
      const injured = players.filter((p) => p.status === "Infortunato");
      if (injured.length > 0) {
        notify({
          title: `🚑 ${injured.length} giocator${injured.length === 1 ? "e" : "i"} infortunat${injured.length === 1 ? "o" : "i"}`,
          body: injured.map((p) => p.name).join(", "),
          tag: "injured-players",
        });
      }
    }

    checkReminders();
    const interval = setInterval(checkReminders, 60 * 60 * 1000); // ogni ora
    return () => clearInterval(interval);
  }, [enabled, permission, sessions, matches, players, notify]);
}
