/**
 * DeepLinkHandler
 * Gestisce i link universali (Universal Links / App Links) su iOS e Android.
 *
 * Quando l'utente tocca un link calciolab.it in una email o nel browser,
 * Capacitor emette l'evento `appUrlOpen`. Questo componente lo intercetta
 * e naviga alla route corrispondente all'interno dell'app.
 *
 * Deve essere renderizzato DENTRO un <BrowserRouter> per poter usare navigate().
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isNative } from "../../utils/capacitor";

const ALLOWED_HOSTS = ["calciolab.it", "www.calciolab.it"];

export default function DeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNative) return;

    let listenerHandle;

    async function setup() {
      try {
        const { App } = await import("@capacitor/app");

        listenerHandle = await App.addListener("appUrlOpen", ({ url }) => {
          try {
            const parsed = new URL(url);

            // Ignora link di altri domini
            if (!ALLOWED_HOSTS.includes(parsed.hostname)) return;

            const destination = parsed.pathname + parsed.search + parsed.hash;

            // Evita di navigare sulla root se siamo già lì
            if (destination === "/" && window.location.pathname === "/") return;

            navigate(destination, { replace: false });
          } catch {
            // URL non parsabile — ignora
          }
        });
      } catch {
        // @capacitor/app non disponibile (web) — ignora
      }
    }

    setup();
    return () => {
      listenerHandle?.remove?.();
    };
  }, [navigate]);

  // Nessun output visivo — solo effetti collaterali
  return null;
}
