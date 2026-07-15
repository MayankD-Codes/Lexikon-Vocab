import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Subscription {
  plan: "free" | "pro";
  subscription_status:
    | "active" | "trialing" | "past_due" | "canceled" | "unpaid"
    | "incomplete" | "incomplete_expired" | "none";
  billing_interval: "monthly" | "quarterly" | "yearly" | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
}

const DEFAULT_SUB: Subscription = {
  plan: "free",
  subscription_status: "none",
  billing_interval: null,
  current_period_end: null,
  cancel_at_period_end: false,
  stripe_customer_id: null,
};

const ACTIVE_STATUSES: Subscription["subscription_status"][] = ["active", "trialing"];

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
        "plan, subscription_status, billing_interval, current_period_end, cancel_at_period_end, stripe_customer_id",
      )
      .eq("user_id", user.id)
      .maybeSingle();
    setSub((data as Subscription | null) ?? DEFAULT_SUB);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const now = Date.now();
  const periodEnd = sub.current_period_end ? Date.parse(sub.current_period_end) : null;
  const withinPaidPeriod = periodEnd !== null && periodEnd > now;

  const isPro =
    sub.plan === "pro" &&
    (
      ACTIVE_STATUSES.includes(sub.subscription_status) ||
      (sub.subscription_status === "canceled" && withinPaidPeriod)
    );

  return { subscription: sub, isPro, loading, refresh: load };
}
