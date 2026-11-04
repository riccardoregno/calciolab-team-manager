export const COACH_PREMIUM_MONTHLY_CENTS = 990;

// Validate the real Stripe price before creating any checkout session.
export function isCoachPremiumMonthlyPrice(price) {
  return Boolean(price && price.active === true && price.currency === "eur" &&
    price.unit_amount === COACH_PREMIUM_MONTHLY_CENTS && price.type === "recurring" &&
    price.billing_scheme === "per_unit" && !price.transform_quantity &&
    price.recurring?.interval === "month" && price.recurring?.interval_count === 1 &&
    price.recurring?.usage_type === "licensed");
}
