// Creates an Instamojo Payment Request for the authenticated Lexikon user.
// Returns { payment_url } for the browser to redirect to.
// Credentials come from INSTAMOJO_API_KEY / INSTAMOJO_AUTH_TOKEN env vars.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Interval = "monthly" | "quarterly" | "yearly";

const PLANS: Record<Interval, { amount: number; days: number; label: string }> = {
  monthly:   { amount: 499,  days: 30,  label: "Lexikon Pro — Monthly (30 days)" },
  quarterly: { amount: 1299, days: 90,  label: "Lexikon Pro — Quarterly (90 days)" },
  yearly:    { amount: 3999, days: 365, label: "Lexikon Pro — Yearly (365 days)" },
};

// Instamojo API base. Override with INSTAMOJO_API_BASE for sandbox
// (https://test.instamojo.com/api/1.1) when testing.
const INSTAMOJO_API_BASE =
  Deno.env.get("INSTAMOJO_API_BASE") ?? "https://www.instamojo.com/api/1.1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Please sign in to upgrade." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const sb = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: claims, error: claimsErr } = await sb.auth.getClaims(authHeader.slice(7));
  if (claimsErr || !claims?.claims?.sub) {
    return json({ error: "Your session has expired. Please sign in again." }, 401);
  }
  const userId = claims.claims.sub as string;
  const email = (claims.claims.email as string | undefined) ?? undefined;

  let body: { interval?: string; origin?: string; buyer_name?: string; phone?: string } = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  const interval = body.interval as Interval | undefined;
  if (!interval || !PLANS[interval]) {
    return json({ error: "Invalid billing interval." }, 400);
  }

  const apiKey = Deno.env.get("INSTAMOJO_API_KEY");
  const authToken = Deno.env.get("INSTAMOJO_AUTH_TOKEN");
  if (!apiKey || !authToken) {
    console.error("Instamojo credentials missing");
    return json({ error: "Payments are not configured. Please contact support." }, 500);
  }

  const plan = PLANS[interval];
  const origin = (body.origin || req.headers.get("origin") || "").replace(/\/$/, "");
  const redirect_url = `${origin}/payment-success?plan=${interval}`;
  const webhook = `${supabaseUrl}/functions/v1/instamojo-webhook`;

  // Instamojo Payment Requests API expects form-encoded body.
  const form = new URLSearchParams();
  form.set("purpose", plan.label);
  form.set("amount", String(plan.amount));
  form.set("buyer_name", (body.buyer_name || email?.split("@")[0] || "Lexikon User").slice(0, 100));
  if (email) form.set("email", email);
  if (body.phone) form.set("phone", body.phone);
  form.set("redirect_url", redirect_url);
  form.set("webhook", webhook);
  form.set("allow_repeated_payments", "false");
  form.set("send_email", email ? "true" : "false");
  form.set("send_sms", "false");
  // Custom fields to correlate the webhook back to our user & plan.
  // Instamojo echoes these in the webhook payload.
  form.set("customer_id", userId);
  form.set("plan", interval);

  try {
    const res = await fetch(`${INSTAMOJO_API_BASE}/payment-requests/`, {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "X-Auth-Token": authToken,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      console.error("Instamojo create failed:", res.status, JSON.stringify(data));
      const msg =
        (data && (data.message || (data.payment_request && JSON.stringify(data.payment_request)))) ||
        "Could not create payment. Please try again.";
      return json({ error: typeof msg === "string" ? msg : "Could not create payment." }, 502);
    }

    const pr = data.payment_request ?? {};
    const payment_url: string = pr.longurl;
    const payment_request_id: string = pr.id;

    if (!payment_url) {
      console.error("Instamojo response missing longurl:", JSON.stringify(data));
      return json({ error: "Could not start payment. Please try again." }, 502);
    }

    // Record a pending subscription row so we can trace back if the webhook
    // arrives without our custom fields. Non-fatal on failure.
    try {
      const admin = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      await admin.from("user_subscriptions").upsert(
        {
          user_id: userId,
          plan: "free",
          subscription_status: "pending",
          provider: "instamojo",
          provider_payment_request_id: payment_request_id,
          billing_interval: interval,
          currency: "INR",
          amount_paid: plan.amount,
        },
        { onConflict: "user_id" },
      );
    } catch (e) {
      console.warn("could not upsert pending subscription:", (e as Error).message);
    }

    return json({ payment_url, payment_request_id });
  } catch (e) {
    console.error("create-instamojo-payment error:", (e as Error).message);
    return json({ error: "Couldn't start payment. Please try again." }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
