// Creates a Stripe Checkout Session for the authenticated Lexikon user.
// Stripe price IDs come from env: STRIPE_PRICE_MONTHLY / STRIPE_PRICE_QUARTERLY / STRIPE_PRICE_YEARLY.
// Falls back to STRIPE_PAYMENT_LINK_* URLs when price IDs are not configured.

import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-11-20.acacia" });

const PRICE_IDS: Record<"monthly" | "quarterly" | "yearly", string | undefined> = {
  monthly: Deno.env.get("STRIPE_PRICE_MONTHLY"),
  quarterly: Deno.env.get("STRIPE_PRICE_QUARTERLY"),
  yearly: Deno.env.get("STRIPE_PRICE_YEARLY"),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Please sign in to upgrade." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: claims, error: claimsErr } = await sb.auth.getClaims(
    authHeader.slice(7),
  );
  if (claimsErr || !claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Your session has expired. Please sign in again." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = claims.claims.sub as string;
  const email = (claims.claims.email as string | undefined) ?? undefined;

  let body: { interval?: string; origin?: string } = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  const interval = body.interval as "monthly" | "quarterly" | "yearly" | undefined;
  if (!interval || !["monthly", "quarterly", "yearly"].includes(interval)) {
    return new Response(JSON.stringify({ error: "Invalid billing interval." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const price = PRICE_IDS[interval];
  if (!price) {
    return new Response(
      JSON.stringify({
        error:
          "Checkout is not fully configured yet. Please use the pricing links or contact support.",
      }),
      { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const origin = (body.origin || req.headers.get("origin") || "").replace(/\/$/, "");
  const success_url = `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
  const cancel_url = `${origin}/payment-cancelled`;

  try {
    // Reuse an existing customer when we have one saved.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: existing } = await admin
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    let customer = existing?.stripe_customer_id ?? undefined;
    if (!customer) {
      const created = await stripe.customers.create({
        email,
        metadata: { user_id: userId },
      });
      customer = created.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [{ price, quantity: 1 }],
      success_url,
      cancel_url,
      client_reference_id: userId,
      subscription_data: { metadata: { user_id: userId } },
      allow_promotion_codes: true,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-checkout-session error:", (e as Error).message);
    return new Response(
      JSON.stringify({ error: "Couldn't start checkout. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
