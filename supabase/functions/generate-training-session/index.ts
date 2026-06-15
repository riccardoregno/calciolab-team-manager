import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { requireAuth } from "../_shared/requireAuth.ts";
import { checkRateLimit, rateLimitedResponse } from "../_shared/rateLimit.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// Rate limit: max 10 generazioni per utente ogni 10 minuti
const AI_RL_MAX = 10;
const AI_RL_WINDOW_MS = 10 * 60 * 1000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (!GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY non configurata" }, 500);

  // Require authenticated user
  const auth = await requireAuth(req);
  if (auth.error) return json({ error: auth.error }, auth.status!);

  // Rate limit per user
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rlKey = `ai-gen:${auth.user!.id}:${ip}`;
  if (!checkRateLimit(rlKey, AI_RL_MAX, AI_RL_WINDOW_MS)) {
    return rateLimitedResponse(rlKey, CORS);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { prompt, exercises } = body;

    // Validate inputs
    if (!prompt || typeof prompt !== "object") return json({ error: "prompt mancante o non valido" }, 400);
    if (!Array.isArray(exercises))             return json({ error: "exercises deve essere un array" }, 400);

    const exerciseList = (exercises as Array<{ id: string; title: string; category?: string; phase?: string; objective?: string; duration?: number }>)
      .slice(0, 60)
      .map((e) =>
        `- ID: ${e.id} | Titolo: ${e.title} | Categoria: ${e.category ?? "N/A"} | Obiettivo: ${e.objective ?? "N/A"} | Durata: ${e.duration ?? 15} min`
      )
      .join("\n");

    const systemPrompt = `Sei un assistente allenatore di calcio professionista esperto in periodizzazione tattica.
Genera una seduta di allenamento in JSON scegliendo SOLO esercizi dalla libreria fornita.

LIBRERIA ESERCIZI:
${exerciseList || "Nessun esercizio disponibile"}

PARAMETRI:
- Obiettivo tattico: ${prompt.objective}
- Categoria: ${prompt.category}
- Durata totale: ${prompt.duration} minuti
- Numero giocatori: ${prompt.players}
- Campo: ${prompt.field}
- Intensità: ${prompt.intensity}
- Distanza dalla gara: ${prompt.matchDayDistance}
${prompt.specialConstraints ? `- Vincoli speciali: ${prompt.specialConstraints}` : ""}

REGOLE:
1. Scegli 4-7 esercizi dalla libreria
2. Distribuisci la durata: riscaldamento ~15min, parte principale ~50min, defaticamento ~10min
3. Adatta giocatori e note variante all'intensità richiesta
4. Non inventare esercizi che non sono nella libreria

Rispondi SOLO con JSON valido, nessun testo prima o dopo:
{
  "title": "Titolo breve seduta",
  "theme": "${prompt.objective}",
  "objective": "Descrizione obiettivo in 1-2 frasi",
  "notes": "Note staff tecnico",
  "exercises": [
    {
      "exerciseId": "id_dalla_libreria",
      "customDuration": 15,
      "customPlayers": ${prompt.players},
      "variantNotes": "Note variante specifiche"
    }
  ]
}`;

    const geminiBody = {
      contents: [{ parts: [{ text: systemPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1500,
        responseMimeType: "application/json",
      },
    };

    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini error ${geminiRes.status}: ${errText.slice(0, 300)}`);
    }

    const geminiData = await geminiRes.json();
    const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

    let session: unknown;
    try {
      session = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      session = match ? JSON.parse(match[0]) : {};
    }

    return new Response(JSON.stringify(session), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
