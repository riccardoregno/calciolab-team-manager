import "@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY non configurata" }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { prompt, exercises } = await req.json();

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
