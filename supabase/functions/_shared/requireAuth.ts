/**
 * requireAuth — shared helper for Edge Functions
 *
 * Verifies the caller's JWT and (optionally) checks that they are
 * a member of the requested team with an allowed role.
 *
 * Usage:
 *   const { user, error, status } = await requireAuth(req, teamId, ["owner"]);
 *   if (error) return json({ error }, status);
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY         = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const INTERNAL_SECRET           = Deno.env.get("SEND_EMAIL_SECRET") ?? "";

export type AuthResult =
  | { user: { id: string; email?: string }; role: string; error: null; status: null }
  | { user: null; role: null; error: string; status: number };

/**
 * @param req         - incoming Request
 * @param teamId      - team to check membership for (pass "" to skip membership check)
 * @param allowedRoles - roles that are permitted (default: all roles)
 */
export async function requireAuth(
  req: Request,
  teamId = "",
  allowedRoles: string[] = ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director"],
): Promise<AuthResult> {
  const authHeader = req.headers.get("authorization") ?? "";
  const internalSecret = req.headers.get("x-internal-secret") ?? "";

  // Allow internal service-to-service calls
  if (INTERNAL_SECRET && internalSecret === INTERNAL_SECRET) {
    return { user: { id: "internal" }, role: "owner", error: null, status: null };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return { user: null, role: null, error: "Autenticazione richiesta", status: 401 };
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { user: null, role: null, error: "Supabase non configurato", status: 500 };
  }

  // Verify JWT
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();

  if (authError || !authData?.user) {
    return { user: null, role: null, error: "Token non valido o scaduto", status: 401 };
  }

  const user = authData.user;

  // Skip membership check if no teamId provided
  if (!teamId) {
    return { user: { id: user.id, email: user.email }, role: "owner", error: null, status: null };
  }

  // Check team membership and role
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: membership, error: memberError } = await serviceClient
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberError) {
    return { user: null, role: null, error: "Errore verifica membership", status: 500 };
  }

  if (!membership) {
    return { user: null, role: null, error: "Non sei membro di questo team", status: 403 };
  }

  if (!allowedRoles.includes(membership.role)) {
    return { user: null, role: null, error: "Permessi insufficienti per questa operazione", status: 403 };
  }

  return { user: { id: user.id, email: user.email }, role: membership.role, error: null, status: null };
}

/** Known CalcioLab price IDs — validated server-side to prevent abuse */
const ALLOWED_PRICE_IDS = new Set([
  Deno.env.get("STRIPE_PRICE_PREMIUM_MONTHLY") ?? "",
  Deno.env.get("STRIPE_PRICE_PREMIUM_YEARLY")  ?? "",
  Deno.env.get("STRIPE_PRICE_CLUB_MONTHLY")    ?? "",
  Deno.env.get("STRIPE_PRICE_CLUB_YEARLY")     ?? "",
].filter(Boolean));

export function isAllowedPriceId(priceId: string): boolean {
  // If no price IDs are configured in env, allow any (dev mode)
  if (ALLOWED_PRICE_IDS.size === 0) return priceId.startsWith("price_");
  return ALLOWED_PRICE_IDS.has(priceId);
}

/** Validates that a URL belongs to CalcioLab domains */
const ALLOWED_RETURN_DOMAINS = ["calciolab.org", "calciolab.it", "localhost"];

export function isAllowedReturnUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_RETURN_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}
