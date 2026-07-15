// Helpers for Free-plan word-limit checks. Frontend guard for good UX;
// the DB trigger `enforce_free_word_limit` is the source of truth.
import { supabase } from "@/integrations/supabase/client";
import { FREE_WORD_LIMIT } from "@/lib/billing";

export interface WordCountResult {
  count: number;
  limit: number;
  isPro: boolean;
  remaining: number; // Infinity for Pro
}

export async function getWordUsage(userId: string): Promise<WordCountResult> {
  const [{ count }, { data: sub }] = await Promise.all([
    supabase.from("words").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase
      .from("user_subscriptions")
      .select("plan, subscription_status, current_period_end")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const now = Date.now();
  const periodEnd = sub?.current_period_end ? Date.parse(sub.current_period_end) : null;
  const isPro =
    sub?.plan === "pro" &&
    (
      sub.subscription_status === "active" ||
      sub.subscription_status === "trialing" ||
      (sub.subscription_status === "canceled" && periodEnd !== null && periodEnd > now)
    );
  const total = count ?? 0;
  return {
    count: total,
    limit: FREE_WORD_LIMIT,
    isPro,
    remaining: isPro ? Infinity : Math.max(0, FREE_WORD_LIMIT - total),
  };
}

export function limitReachedMessage(count: number, tryingToAdd = 1): string {
  if (tryingToAdd <= 1) {
    return `Your free plan includes up to ${FREE_WORD_LIMIT} saved words, and you already have ${count}. Upgrade to Lexikon Pro to keep adding words.`;
  }
  const remaining = Math.max(0, FREE_WORD_LIMIT - count);
  return `Your free plan includes up to ${FREE_WORD_LIMIT} saved words. You currently have ${count}, so you can add ${remaining} more — not ${tryingToAdd}. Upgrade to Lexikon Pro to import unlimited words.`;
}
