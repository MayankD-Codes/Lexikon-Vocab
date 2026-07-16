import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type SubscriptionStatus =
  | "active" | "trialing" | "past_due" | "canceled" | "unpaid"
  | "incomplete" | "incomplete_expired" | "none"
  | "expired" | "pending" | "manual";

export interface Subscription {
  plan: "free" | "pro";
  subscription_status: SubscriptionStatus;
  billing_interval: "monthly" | "quarterly" | "yearly" | null;
  current_period_end: string | null;
  current_period_start: string | null;
  provider: string | null;
}

const DEFAULT_SUB: Subscription = {
  plan: "free",
  subscription_status: "none",
  billing_interval: null,
  current_period_end: null,
  current_period_start: null,
  provider: null,
};

export function useSubscription() {
  const { user } = useAuth();
  const [sub, setSub] = useState<Subscription>(DEFAULT_SUB);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setSub(DEFAULT_SUB);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("user_subscriptions")
      .select(
        "plan, subscription_status, billing_interval, current_period_end, current_period_start, provider",
      )
      .eq("user_id", user.id)
      .maybeSingle();
    setSub((data as Subscription | null) ?? DEFAULT_SUB);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const now = Date.now();
  const periodEnd = sub.current_period_end ? Date.parse(sub.current_period_end) : null;
  const withinPaidPeriod = periodEnd === null ? false : periodEnd > now;

  // Pro is active only when plan=pro, status is active/trialing/manual,
  // AND (no expiry set OR expiry is in the future).
  const activeStatus =
    sub.subscription_status === "active" ||
    sub.subscription_status === "trialing" ||
    sub.subscription_status === "manual";

  const isPro =
    sub.plan === "pro" &&
    activeStatus &&
    (periodEnd === null || withinPaidPeriod);

  const isPending = sub.subscription_status === "pending";

  return { subscription: sub, isPro, isPending, loading, refresh: load };
}
