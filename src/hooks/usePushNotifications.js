/**
 * usePushNotifications
 * Hook che registra il dispositivo alle push notification al mount
 * e gestisce la navigazione da tap su notifica.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  registerPushNotifications,
  unregisterPushNotifications,
} from "../utils/pushNotifications";
import { isNative } from "../utils/capacitor";

/**
 * @param {{ userId: string|null, teamId: string|null, enabled?: boolean }} param0
 */
export function usePushNotifications({ userId, teamId, enabled = true }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState("idle"); // idle | registering | granted | denied | error
  const registered = useRef(false);

  // Registra token al login
  useEffect(() => {
    if (!isNative || !enabled || !userId || !teamId) return;
    if (registered.current) return;

    let cancelled = false;
    registered.current = true;
    setStatus("registering");

    registerPushNotifications({ userId, teamId }).then((result) => {
      if (cancelled) return;
      if (result.registered) {
        setStatus("granted");
      } else {
        setStatus(result.error?.includes("negato") ? "denied" : "error");
        registered.current = false; // consenti retry
      }
    });

    return () => { cancelled = true; };
  }, [userId, teamId, enabled]);

  // Navigazione da tap notifica
  useEffect(() => {
    if (!isNative) return;

    function handleNavigate(e) {
      const path = e.detail?.path;
      if (path) navigate(path);
    }

    window.addEventListener("calciolab:push:navigate", handleNavigate);
    return () => window.removeEventListener("calciolab:push:navigate", handleNavigate);
  }, [navigate]);

  // Cleanup al logout
  useEffect(() => {
    if (!userId) {
      unregisterPushNotifications();
      registered.current = false;
      setStatus("idle");
    }
  }, [userId]);

  return { status };
}
