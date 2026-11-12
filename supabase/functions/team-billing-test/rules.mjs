export function billingSnapshot(subscription, priceId) {
  const items = subscription?.items?.data ?? [];
  const validPrice = items.length === 1 && items[0].quantity === 1 && items[0].price?.id === priceId;
  const periodEnd = subscription?.current_period_end;
  const paid = validPrice && subscription.latest_invoice?.status === "paid" && periodEnd > 0;
  let status = "free";
  if (subscription) {
    if (["canceled", "incomplete_expired"].includes(subscription.status)) status = "canceled";
    else if (["past_due", "unpaid", "paused"].includes(subscription.status)) status = "past_due";
    else status = subscription.status === "active" && paid ? "active" : "incomplete";
  }
  return {
    p_subscription_id: subscription?.id ?? null,
    p_status: status,
    p_period_end: periodEnd > 0 ? new Date(periodEnd * 1000).toISOString() : null,
    p_cancel_at_period_end: subscription?.cancel_at_period_end === true,
  };
}

export async function verifyWebhook(payload, header, secret, now = Date.now()) {
  const parts = new URLSearchParams(header.split(",").map((part) => part.trim()).join("&"));
  const timestamp = parts.get("t");
  if (!/^\d+$/.test(timestamp ?? "") || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const message = encoder.encode(timestamp + "." + payload);
  for (const signature of parts.getAll("v1")) {
    if (!/^[0-9a-f]{64}$/i.test(signature)) continue;
    const bytes = Uint8Array.from(signature.match(/../g), (hex) => Number.parseInt(hex, 16));
    if (await crypto.subtle.verify("HMAC", key, bytes, message)) return true;
  }
  return false;
}
