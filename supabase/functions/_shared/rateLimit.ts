/**
 * rateLimit.ts — Sliding-window in-memory rate limiter
 *
 * "Best effort" per singolo processo Deno. Su Supabase Edge Functions con più
 * istanze attive, ogni istanza ha la sua finestra indipendente — protezione
 * sufficiente per prevenire abuse accidentali o automatici leggeri.
 *
 * Per protezione globale affidabile: attivare Supabase built-in rate limiting
 * nel Dashboard → Settings → API → Rate Limits.
 *
 * Uso:
 *   import { checkRateLimit } from "../_shared/rateLimit.ts";
 *
 *   const allowed = checkRateLimit(`email:${userId}`, 10, 60_000); // max 10/min
 *   if (!allowed) return new Response("Too Many Requests", { status: 429 });
 */

interface Bucket {
  count: number;
  resetAt: number; // ms timestamp
}

// Map globale per processo — sopravvive tra richieste sullo stesso worker
const store = new Map<string, Bucket>();

// Pulizia periodica delle entry scadute per evitare memory leak
// (ogni ~500 entry o dopo reset spontaneo)
let cleanupCounter = 0;
function maybePurge() {
  if (++cleanupCounter < 500) return;
  cleanupCounter = 0;
  const now = Date.now();
  for (const [key, bucket] of store.entries()) {
    if (now > bucket.resetAt) store.delete(key);
  }
}

/**
 * Controlla se la chiave è entro il limite.
 *
 * @param key       - Chiave univoca (es. "email:<userId>", "checkout:<ip>")
 * @param maxRequests - Massimo numero di richieste per finestra
 * @param windowMs  - Durata della finestra in millisecondi (es. 60_000 = 1 min)
 * @returns true se la richiesta è permessa, false se rate-limited
 */
export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  maybePurge();
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || now > bucket.resetAt) {
    // Prima richiesta o finestra scaduta — resetta
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= maxRequests) {
    return false; // rate limited
  }

  bucket.count++;
  return true;
}

/**
 * Restituisce i secondi rimanenti prima del reset della finestra.
 * Utile per impostare l'header Retry-After.
 */
export function retryAfterSeconds(key: string): number {
  const bucket = store.get(key);
  if (!bucket) return 0;
  const remainingMs = bucket.resetAt - Date.now();
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

/**
 * Rate limit response preconfigurata (429 Too Many Requests).
 */
export function rateLimitedResponse(key: string, cors: Record<string, string> = {}): Response {
  const retryAfter = retryAfterSeconds(key);
  return new Response(
    JSON.stringify({ error: "Troppe richieste. Riprova tra poco.", retryAfter }),
    {
      status: 429,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        ...(retryAfter > 0 ? { "Retry-After": String(retryAfter) } : {}),
      },
    },
  );
}
