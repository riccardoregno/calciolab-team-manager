import { generateGuidedSession } from "../utils/helpers";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

export function isOpenAiConfigured() {
  return Boolean(isSupabaseConfigured && supabase);
}

export async function generateAiTrainingSession({
  prompt,
  exercises = [],
  fallbackSession,
}) {
  const localFallback = fallbackSession || generateGuidedSession({ ...prompt, exercises });

  if (!isOpenAiConfigured()) {
    return {
      source: "local",
      warning: "AI non configurata: usato generatore locale.",
      session: localFallback,
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke(
      "generate-training-session",
      {
        body: {
          prompt,
          exercises: exercises.slice(0, 60),
        },
      }
    );

    if (error) {
      throw error;
    }

    return {
      source: "openai",
      session: normalizeAiSession(data, prompt, exercises),
    };
  } catch (error) {
    return {
      source: "local",
      warning: `AI non disponibile: ${friendlyError(error)}. Usato generatore locale.`,
      session: localFallback,
    };
  }
}

function normalizeAiSession(session, prompt, exercises) {
  const exerciseIds = new Set(exercises.map((exercise) => String(exercise.id)));

  const selectedExercises = (session?.exercises || [])
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
    title: session?.title || fallback.title,
    theme: session?.theme || prompt.objective,
    objective: session?.objective || fallback.objective,
    notes: `${session?.notes || fallback.notes}\nGenerata con AI.`,
    exercises: selectedExercises.length ? selectedExercises : fallback.exercises,
  };
}

function friendlyError(error) {
  const message = error?.message || "errore sconosciuto";

  if (message.includes("401")) return "autorizzazione non valida";
  if (message.includes("429")) return "limite o credito API raggiunto";
  if (message.includes("Failed to fetch")) return "richiesta bloccata o rete non disponibile";

  return message.slice(0, 180);
}