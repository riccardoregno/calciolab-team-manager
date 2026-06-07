import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getVipLevel, getVipProgress, getVipReward } from "../_shared/vip.ts";
import { sendLevelUpgradeEmail, sendVipRewardEmail } from "../_shared/vipEmail.ts";
import { requireAuth } from "../_shared/requireAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      teamId,
      pointsToAdd = 0,
      source = "manual",
      externalId,
      type = "vip_points",
      metadata = {},
    } = await req.json();

    if (!teamId) throw new Error("teamId mancante");

    // Verify caller — allow owner/headCoach or internal service calls
    const auth = await requireAuth(req, teamId, ["owner", "headCoach", "director"]);
    if (auth.error) {
      return new Response(JSON.stringify({ success: false, error: auth.error }), {
        status: auth.status!,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clamp points to prevent abuse from frontend calls — server-side events
    // (Stripe webhook, check-trials) use the internal secret and are unrestricted
    const isInternal = auth.role === "owner" && auth.user?.id === "internal";
    const safePointsToAdd = isInternal
      ? Number(pointsToAdd || 0)
      : Math.min(1000, Math.max(-1000, Number(pointsToAdd || 0)));

    const pointsDelta = safePointsToAdd;
    const eventSource = String(source || "manual");
    const eventExternalId = externalId
      ? String(externalId)
      : pointsDelta !== 0
      ? `${eventSource}-${crypto.randomUUID()}`
      : "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // FIX: SELECT vip_points → calcolo → UPDATE separati lasciavano una
    // finestra di race condition — chiamate concorrenti potevano leggere lo
    // stesso valore di partenza e la seconda scrittura sovrascriveva la
    // prima, perdendo punti (lost update). increment_vip_points esegue
    // lettura+incremento+scrittura in una singola istruzione atomica
    // (UPDATE ... SET vip_points = vip_points + delta ... RETURNING),
    // eliminando del tutto la finestra (vedi migrazione
    // 20260607150000_atomic_vip_points.sql).
    const { data: incrementRows, error: incrementError } = await supabase
      .rpc("increment_vip_points", { p_team_id: teamId, p_delta: pointsDelta });

    if (incrementError) throw incrementError;
    const updatedTeam = incrementRows?.[0];
    if (!updatedTeam) throw new Error("Team non trovato");

    const previousLevel = updatedTeam.previous_level || "bronze";
    const newPoints = Number(updatedTeam.vip_points || 0);
    const newLevel = getVipLevel(newPoints).name;
    const levelChanged = newLevel !== previousLevel;
    const candidateReward = levelChanged ? getVipReward(newLevel) : null;
    const rewardAlreadyGranted = candidateReward
      ? await hasRewardAlreadyBeenGranted(supabase, teamId, candidateReward.promotionCode)
      : false;
    const reward = rewardAlreadyGranted ? null : candidateReward;

    if (eventExternalId) {
      const insertResult = await insertVipEvent(supabase, {
        teamId,
        type,
        source: eventSource,
        externalId: eventExternalId,
        points: pointsDelta,
        rewardCode: reward?.promotionCode || null,
        metadata: {
          ...metadata,
          previousLevel,
          newLevel,
          rewardAlreadyGranted,
        },
      });

      if (insertResult.duplicate) {
        return new Response(
          JSON.stringify({
            success: true,
            duplicate: true,
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    // vip_points/vip_updated_at sono già stati scritti atomicamente da
    // increment_vip_points; qui aggiorniamo solo il livello derivato dal
    // nuovo punteggio (campo puramente derivato, nessuna finestra di lost
    // update significativa: il valore dipende solo da newPoints, già certo).
    if (levelChanged) {
      const { error: levelUpdateError } = await supabase
        .from("teams")
        .update({ vip_level: newLevel })
        .eq("id", teamId);

      if (levelUpdateError) {
        if (eventExternalId) await rollbackVipEvent(supabase, eventSource, eventExternalId);
        throw levelUpdateError;
      }
    }

    if (levelChanged) {
      await sendLevelUpgradeEmail({ teamId, previousLevel, newLevel, reward });
      if (reward) await sendVipRewardEmail({ teamId, level: newLevel, reward });
    }

    return new Response(
      JSON.stringify({
        success: true,
        levelChanged,
        previousLevel,
        newLevel,
        newPoints,
        reward,
        progress: getVipProgress(newPoints),
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});

async function hasRewardAlreadyBeenGranted(supabase, teamId: string, rewardCode: string) {
  const { data, error } = await supabase
    .from("vip_events")
    .select("id")
    .eq("team_id", teamId)
    .eq("reward_code", rewardCode)
    .limit(1);

  if (error) throw error;
  return Boolean(data?.length);
}

async function insertVipEvent(
  supabase,
  {
    teamId,
    type,
    source,
    externalId,
    points,
    rewardCode,
    metadata,
  }: {
    teamId: string;
    type: string;
    source: string;
    externalId: string;
    points: number;
    rewardCode: string | null;
    metadata: Record<string, unknown>;
  }
) {
  const { error } = await supabase
    .from("vip_events")
    .insert({
      team_id: teamId,
      type,
      source,
      external_id: externalId,
      points,
      reward_code: rewardCode,
      metadata,
    });

  if (!error) return { duplicate: false };

  if (error.code === "23505" && String(error.message || "").includes("vip_events_source_external_id_key")) {
    return { duplicate: true };
  }

  if (error.code === "23505" && rewardCode) {
    const retry = await supabase
      .from("vip_events")
      .insert({
        team_id: teamId,
        type,
        source,
        external_id: externalId,
        points,
        reward_code: null,
        metadata: {
          ...metadata,
          rewardAlreadyGranted: true,
        },
      });

    if (!retry.error) return { duplicate: false };
    if (retry.error.code === "23505") return { duplicate: true };
    throw retry.error;
  }

  throw error;
}

async function rollbackVipEvent(supabase, source: string, externalId: string) {
  await supabase
    .from("vip_events")
    .delete()
    .eq("source", source)
    .eq("external_id", externalId);
}
