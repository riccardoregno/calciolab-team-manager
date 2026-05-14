import { generateGuidedSession } from "../utils/helpers";

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini";

const sessionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "theme", "objective", "notes", "exercises"],
  properties: {
    title: { type: "string" },
    theme: { type: "string" },
    objective: { type: "string" },
    notes: { type: "string" },
    exercises: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["exerciseId", "customDuration", "customPlayers", "variantNotes"],
        properties: {
          exerciseId: { type: "string" },
          customDuration: { type: "integer" },
          customPlayers: { type: "string" },
          variantNotes: { type: "string" },
        },
      },
    },
  },
};

export function isOpenAiConfigured() {
  return Boolean(import.meta.env.VITE_OPENAI_API_KEY);
}

export async function generateAiTrainingSession({
  prompt,
  exercises = [],
  fallbackSession,
}) {
  if (!isOpenAiConfigured()) {
    return {
      source: "local",
      warning: "Chiave OpenAI non configurata: usato generatore locale.",
      session: fallbackSession || generateGuidedSession({ ...prompt, exercises }),
    };
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: import.meta.env.VITE_OPENAI_MODEL || DEFAULT_MODEL,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: [
                  "Sei un assistente tecnico per allenatori di calcio.",
                  "Genera solo JSON conforme allo schema.",
                  "Usa esclusivamente gli exerciseId disponibili nella libreria.",
                  "Crea una seduta concreta, progressiva e modificabile nello staff planner.",
                  "Rispetta durata totale, numero giocatori, campo, distanza gara e vincoli speciali.",
                ].join(" "),
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify({
                  brief: prompt,
                  availableExercises: exercises.slice(0, 60).map((exercise) => ({
                    id: String(exercise.id),
                    title: exercise.title,
                    category: exercise.category,
                    phase: exercise.phase,
                    objective: exercise.objective,
                    duration: Number(exercise.duration || 0),
                    players: exercise.players || exercise.playersRange,
                    intensity: exercise.intensity,
                    fieldSize: exercise.fieldSize,
                    tags: exercise.tags || [],
                    coachingPoints: exercise.coachingPoints,
                  })),
                }),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "calciolab_training_session",
            strict: true,
            schema: sessionSchema,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `OpenAI API error ${response.status}`);
    }

    const data = await response.json();
    const parsed = parseResponseJson(data);

    return {
      source: "openai",
      session: normalizeAiSession(parsed, prompt, exercises),
    };
  } catch (error) {
    return {
      source: "local",
      warning: `AI non disponibile: ${friendlyError(error)}. Usato generatore locale.`,
      session: fallbackSession || generateGuidedSession({ ...prompt, exercises }),
    };
  }
}

function parseResponseJson(data) {
  const directText = data.output_text;
  if (directText) return JSON.parse(directText);

  const message = data.output
    ?.flatMap((item) => item.content || [])
    ?.find((content) => content.type === "output_text" && content.text);

  if (!message?.text) {
    throw new Error("Risposta AI senza testo JSON");
  }

  return JSON.parse(message.text);
}

function normalizeAiSession(session, prompt, exercises) {
  const exerciseIds = new Set(exercises.map((exercise) => String(exercise.id)));
  const selectedExercises = (session.exercises || [])
    .filter((item) => exerciseIds.has(String(item.exerciseId)))
    .map((item) => ({
      exerciseId: String(item.exerciseId),
      customDuration: Number(item.customDuration || 10),
      customPlayers: String(item.customPlayers || prompt.players || ""),
      variantNotes: item.variantNotes || "",
    }));

  const fallback = generateGuidedSession({ ...prompt, exercises });

  return {
    ...fallback,
    title: session.title || fallback.title,
    theme: session.theme || prompt.objective,
    objective: session.objective || fallback.objective,
    notes: `${session.notes || fallback.notes}\nGenerata con OpenAI.`,
    exercises: selectedExercises.length ? selectedExercises : fallback.exercises,
  };
}

function friendlyError(error) {
  const message = error?.message || "errore sconosciuto";
  if (message.includes("401")) return "chiave API non valida";
  if (message.includes("429")) return "limite o credito API raggiunto";
  if (message.includes("Failed to fetch")) return "richiesta bloccata dal browser o rete non disponibile";
  return message.slice(0, 180);
}
