#!/usr/bin/env bash
# =============================================================================
# CalcioLab — Deploy all Supabase Edge Functions + migrations
#
# Usage:
#   ./scripts/deploy-functions.sh              # deploy functions + migrations
#   ./scripts/deploy-functions.sh --functions  # functions only
#   ./scripts/deploy-functions.sh --db         # migrations only
#
# Prerequisites:
#   npm install -g supabase   OR   npx supabase login
#   supabase link --project-ref YOUR_PROJECT_REF
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}▶ $*${NC}"; }
success() { echo -e "${GREEN}✓ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $*${NC}"; }
error()   { echo -e "${RED}✗ $*${NC}"; exit 1; }

cd "$ROOT_DIR"

# ── Detect supabase CLI ───────────────────────────────────────────────────────
if command -v supabase &>/dev/null; then
  SB="supabase"
elif command -v npx &>/dev/null; then
  warn "supabase CLI not found globally, using npx supabase"
  SB="npx supabase"
else
  error "supabase CLI not found. Install with: npm install -g supabase"
fi

DEPLOY_FUNCTIONS=true
DEPLOY_DB=true

if [[ "${1:-}" == "--functions" ]]; then DEPLOY_DB=false; fi
if [[ "${1:-}" == "--db" ]]; then DEPLOY_FUNCTIONS=false; fi

# ── Edge Functions ────────────────────────────────────────────────────────────
if [[ "$DEPLOY_FUNCTIONS" == true ]]; then
  info "Deploying Edge Functions..."

  # Functions that should NOT be called directly by anonymous users
  INTERNAL_FUNCTIONS=(
    stripe-webhook
    check-trials
    send-push
  )

  # Functions accessible with JWT (anon key + service role)
  JWT_FUNCTIONS=(
    send-email
    create-checkout-session
    cancel-subscription
    billing-portal
    update-vip
    accept-team-invite
    generate-training-session
  )

  for fn in "${INTERNAL_FUNCTIONS[@]}"; do
    info "  → $fn (no-verify-jwt)"
    $SB functions deploy "$fn" --no-verify-jwt
    success "  $fn deployed"
  done

  for fn in "${JWT_FUNCTIONS[@]}"; do
    info "  → $fn"
    $SB functions deploy "$fn"
    success "  $fn deployed"
  done

  success "All Edge Functions deployed"
fi

# ── Database migrations ───────────────────────────────────────────────────────
if [[ "$DEPLOY_DB" == true ]]; then
  info "Pushing database migrations..."
  $SB db push
  success "Migrations applied"
fi

echo ""
success "Deploy complete!"
echo ""
warn "Remember to verify these secrets are set in the Supabase dashboard:"
echo "  RESEND_API_KEY, EMAIL_FROM, SEND_EMAIL_SECRET"
echo "  FCM_SERVICE_ACCOUNT_JSON, SEND_PUSH_SECRET"
echo "  STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, CHECK_TRIALS_SECRET"
