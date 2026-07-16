// Instamojo payment webhook.
// - Verifies the `mac` field using HMAC-SHA1 with INSTAMOJO_SALT
// - Idempotent via public.payment_events (provider,event_id)
// - Grants Pro access by updating public.user_subscriptions

import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

// Public endpoint — no JWT. Instamojo doesn't call with auth.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

type Interval = "monthly" | "quarterly" | "yearly";
const DAYS_BY_PLAN: Record<Interval, number> = { monthly: 30, quarterly: 90, yearly: 365 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const salt = Deno.env.get("INSTAMOJO_SALT");
  if (!salt) {
    console.error("INSTAMOJO_SALT not configured");
    return new Response("Not configured", { status: 500, headers: corsHeaders });
  }

  // Instamojo posts form-encoded data.
  let payload: Record<string, string> = {};
  try {
    const raw = await req.text();
    const params = new URLSearchParams(raw);
    payload = Object.fromEntries(params.entries());
  } catch (e) {
    console.error("could not parse webhook body:", (e as Error).message);
    return new Response("Bad request", { status: 400, headers: corsHeaders });
  }

  const providedMac = (payload.mac ?? "").toLowerCase();
  if (!providedMac) {
    console.warn("webhook missing mac");
    return new Response("Missing mac", { status: 400, headers: corsHeaders });
  }

  // MAC = HMAC-SHA1 of the pipe-joined values of all non-mac fields sorted by key.
  const macInput = Object.keys(payload)
    .filter((k) => k !== "mac")
    .sort()
    .map((k) => payload[k] ?? "")
    .join("|");
  const computedMac = createHmac("sha1", salt).update(macInput).digest("hex").toLowerCase();

  if (computedMac !== providedMac) {
    console.warn("webhook mac mismatch");
    return new Response("Invalid signature", { status: 401, headers: corsHeaders });
  }

  const paymentId = payload.payment_id ?? "";
  const paymentRequestId = payload.payment_request_id ?? "";
  const status = (payload.status ?? "").toLowerCase();
  const userId = payload.customer_id || "";
  const planRaw = (payload.plan || "").toLowerCase() as Interval;

  if (!paymentId) {
    // Some events (e.g. link created) may not have payment_id — ack and skip.
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Idempotency: record the event; if duplicate, ack.
  const { error: eventInsertErr } = await admin.from("payment_events").insert({
    provider: "instamojo",
    event_id: paymentId,
    event_type: status || "webhook",
    raw_payload: payload,
  });
  if (eventInsertErr) {
    const msg = (eventInsertErr.message || "").toLowerCase();
    if (msg.includes("duplicate") || eventInsertErr.code === "23505") {
      return new Response("ok (dup)", { status: 200, headers: corsHeaders });
    }
    console.error("event insert failed:", eventInsertErr);
    return new Response("db error", { status: 500, headers: corsHeaders });
  }

  // Only credit successful payments. Instamojo uses "Credit" for successful payments.
  const isSuccess = status === "credit" || status === "success" || status === "completed";
  if (!isSuccess) {
    return new Response("ok (not credited)", { status: 200, headers: corsHeaders });
  }

  // Resolve user + plan. Prefer custom fields; fall back to the pending row
  // we wrote when the payment request was created.
  let resolvedUserId = userId;
  let resolvedPlan: Interval | null =
    planRaw === "monthly" || planRaw === "quarterly" || planRaw === "yearly" ? planRaw : null;

  if ((!resolvedUserId || !resolvedPlan) && paymentRequestId) {
    const { data: pending } = await admin
      .from("user_subscriptions")
      .select("user_id, billing_interval")
      .eq("provider_payment_request_id", paymentRequestId)
      .maybeSingle();
    if (pending) {
      resolvedUserId = resolvedUserId || pending.user_id;
      const bi = pending.billing_interval as Interval | null;
      if (!resolvedPlan && bi && DAYS_BY_PLAN[bi]) resolvedPlan = bi;
    }
  }

  if (!resolvedUserId || !resolvedPlan) {
    console.warn("webhook could not map payment to user/plan", {
      paymentId, paymentRequestId, userId, planRaw,
    });
    // Ack so Instamojo doesn't retry forever; user can submit manual verification.
    return new Response("ok (unmapped)", { status: 200, headers: corsHeaders });
  }

  const days = DAYS_BY_PLAN[resolvedPlan];
  const now = new Date();
  const periodEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const amountPaid = Number(payload.amount);
  const currency = payload.currency || "INR";

  const { error: upsertErr } = await admin.from("user_subscriptions").upsert(
    {
      user_id: resolvedUserId,
      plan: "pro",
      subscription_status: "active",
      provider: "instamojo",
      provider_payment_id: paymentId,
      provider_payment_request_id: paymentRequestId || null,
      billing_interval: resolvedPlan,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      amount_paid: Number.isFinite(amountPaid) ? Math.round(amountPaid) : null,
      currency,
      cancel_at_period_end: true, // one-time payment, does not auto-renew
    },
    { onConflict: "user_id" },
  );

  if (upsertErr) {
    console.error("subscription upsert failed:", upsertErr);
    return new Response("db error", { status: 500, headers: corsHeaders });
  }

  // Auto-approve any pending manual verification with matching payment id.
  try {
    await admin
      .from("payment_verification_requests")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("user_id", resolvedUserId)
      .eq("payment_id", paymentId)
      .eq("status", "pending");
  } catch (e) {
    console.warn("could not auto-approve manual request:", (e as Error).message);
  }

  return new Response("ok", { status: 200, headers: corsHeaders });
});
