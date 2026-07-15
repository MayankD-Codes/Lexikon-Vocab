// Stripe webhook handler.
// Verifies the Stripe signature, is idempotent via public.stripe_processed_events,
// and writes entitlement to public.user_subscriptions.
//
// This function must run WITHOUT jwt verification (Stripe is not a signed-in user).
// See supabase/config.toml for verify_jwt = false.

import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-11-20.acacia" });
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, stripe-signature",
};

// Map a Stripe price recurring interval (or its price id) to our internal billing_interval.
function intervalFromPrice(price: Stripe.Price | null | undefined): "monthly" | "quarterly" | "yearly" | null {
  if (!price?.recurring) return null;
  const { interval, interval_count } = price.recurring;
  if (interval === "month" && interval_count === 1) return "monthly";
  if (interval === "month" && interval_count === 3) return "quarterly";
  if (interval === "year") return "yearly";
  return null;
}

// Resolve the Lexikon user_id for a Stripe subscription.
// Preferred: subscription.metadata.user_id (set by create-checkout-session).
// Fallback: metadata on the Stripe customer.
// Last resort: email match against auth.users (used only for Payment Links).
async function resolveUserId(sub: Stripe.Subscription): Promise<string | null> {
  const metaUser = (sub.metadata?.user_id ?? "").trim();
  if (metaUser) return metaUser;

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted) {
      const cUser = (customer.metadata?.user_id ?? "").trim();
      if (cUser) return cUser;

      const email = customer.email?.trim().toLowerCase();
      if (email) {
        // Best-effort email fallback via auth admin API.
        // Note: Lexikon uses synthetic emails for username auth; this only helps
        // when the checkout email matches the real auth email (e.g. Google sign-in).
        const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const match = data?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
        if (match) return match.id;
      }
    }
  } catch (e) {
    console.warn("resolveUserId customer lookup failed:", (e as Error).message);
  }
  return null;
}

async function upsertSubscription(sub: Stripe.Subscription) {
  const userId = await resolveUserId(sub);
  if (!userId) {
    console.error("Could not resolve user for subscription", sub.id);
    return;
  }

  const item = sub.items.data[0];
  const price = item?.price ?? null;
  const interval = intervalFromPrice(price);

  const activePlan = ["active", "trialing", "past_due"].includes(sub.status);
  const plan = activePlan ? "pro" : "free";

  const row = {
    user_id: userId,
    plan,
    subscription_status: sub.status,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    stripe_price_id: price?.id ?? null,
    billing_interval: interval,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
  };

  const { error } = await admin
    .from("user_subscriptions")
    .upsert(row, { onConflict: "user_id" });
  if (error) console.error("upsert user_subscriptions failed:", error.message);
}

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" || !session.subscription) break;
      const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      const sub = await stripe.subscriptions.retrieve(subId);
      // Backfill metadata.user_id from client_reference_id when missing.
      const refUser = (session.client_reference_id ?? session.metadata?.user_id ?? "").trim();
      if (refUser && !sub.metadata?.user_id) {
        try {
          await stripe.subscriptions.update(sub.id, { metadata: { ...sub.metadata, user_id: refUser } });
          sub.metadata = { ...sub.metadata, user_id: refUser };
        } catch (e) {
          console.warn("stripe.subscriptions.update metadata failed:", (e as Error).message);
        }
        // Also stamp customer metadata for future events.
        try {
          const custId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
          await stripe.customers.update(custId, { metadata: { user_id: refUser } });
        } catch (e) {
          console.warn("stripe.customers.update metadata failed:", (e as Error).message);
        }
      }
      await upsertSubscription(sub);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await upsertSubscription(event.data.object as Stripe.Subscription);
      break;
    }
    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        await upsertSubscription(sub);
      }
      break;
    }
    default:
      // Ignore all other events.
      break;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400, headers: corsHeaders });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Signature verification failed:", (err as Error).message);
    return new Response("Bad signature", { status: 400, headers: corsHeaders });
  }

  // Idempotency: bail if we've already processed this event id.
  const { error: dupErr } = await admin
    .from("stripe_processed_events")
    .insert({ stripe_event_id: event.id, event_type: event.type });
  if (dupErr) {
    // 23505 = unique_violation → already processed. Return 200 so Stripe stops retrying.
    if ((dupErr as { code?: string }).code === "23505") {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("processed_events insert failed:", dupErr.message);
    // Fall through and still try to process.
  }

  try {
    await handleEvent(event);
  } catch (e) {
    console.error("handleEvent failed:", (e as Error).message);
    // Delete the idempotency marker so Stripe can retry and we can process it again.
    await admin.from("stripe_processed_events").delete().eq("stripe_event_id", event.id);
    return new Response("Handler error", { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
