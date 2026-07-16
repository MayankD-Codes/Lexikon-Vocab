import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Sparkles, BookOpen, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import { PLAN_OPTIONS, PRO_FEATURES, FREE_WORD_LIMIT } from "@/lib/billing";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { invokeFunction } from "@/lib/invokeFunction";
import { toast } from "@/hooks/use-toast";
import type { BillingInterval } from "@/lib/billing";

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isPro, subscription, loading } = useSubscription();
  const [starting, setStarting] = useState<BillingInterval | null>(null);

  const startCheckout = async (interval: BillingInterval) => {
    if (!user) {
      navigate("/auth?next=/pricing");
      return;
    }
    setStarting(interval);
    const { data, error } = await invokeFunction<{ payment_url: string }>(
      "create-instamojo-payment",
      { interval, origin: window.location.origin },
    );
    setStarting(null);
    if (error || !data?.payment_url) {
      toast({
        title: "Couldn't start payment",
        description: error || "Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }
    window.location.href = data.payment_url;
  };


  return (
    <main className="min-h-screen bg-gradient-paper">
      <SEO
        title="Pricing — Lexikon Pro"
        description="Lexikon is free for up to 10 saved words. Upgrade to Lexikon Pro for unlimited vocabulary — from $3.33/month billed yearly."
      />
      <header className="container py-6 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-warm flex items-center justify-center shadow-soft">
            <BookOpen className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-semibold tracking-tight">Lexikon</span>
        </Link>
        {user ? (
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /> Back to app</Link>
          </Button>
        ) : (
          <Button asChild variant="ghost" size="sm"><Link to="/auth">Sign in</Link></Button>
        )}
      </header>

      <section className="container pb-16">
        <div className="max-w-2xl mx-auto text-center mb-10 sm:mb-14">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium mb-4">
            <Sparkles className="h-3.5 w-3.5" /> Simple pricing
          </span>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight">
            Grow your vocabulary, without limits
          </h1>
          <p className="text-muted-foreground mt-4 text-base sm:text-lg">
            Start free with up to {FREE_WORD_LIMIT} saved words. Upgrade to Pro whenever you're ready.
          </p>
          {!loading && isPro && (
            <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-1.5 text-sm font-medium">
              <Check className="h-4 w-4" /> You're on Lexikon Pro
              {subscription.billing_interval ? ` — ${subscription.billing_interval}` : ""}
            </p>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-4 max-w-5xl mx-auto">
          {/* Free */}
          <div className="md:col-span-1 rounded-2xl border border-border/60 bg-card p-6 shadow-card flex flex-col">
            <h2 className="font-display text-2xl font-semibold">Free</h2>
            <p className="text-muted-foreground text-sm mt-1">Get started, no card needed.</p>
            <div className="mt-4">
              <span className="font-display text-4xl font-semibold">$0</span>
              <span className="text-muted-foreground text-sm ml-1">forever</span>
            </div>
            <ul className="mt-6 space-y-2.5 text-sm flex-1">
              <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Up to {FREE_WORD_LIMIT} saved words</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Ask Lexi to fill word details</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Daily quiz &amp; community</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Excel export</li>
            </ul>
            <Button asChild variant="outline" className="mt-6">
              <Link to={user ? "/dashboard" : "/auth"}>
                {user ? "Continue free" : "Get started"}
              </Link>
            </Button>
          </div>

          {/* Pro tiers */}
          <div className="md:col-span-3 rounded-2xl border-2 border-primary/40 bg-card p-6 shadow-elegant">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
                  Lexikon Pro <Sparkles className="h-5 w-5 text-primary" />
                </h2>
                <p className="text-muted-foreground text-sm mt-1">Unlimited words. Pick a billing rhythm.</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 mt-6">
              {PLAN_OPTIONS.map((p) => (
                <div
                  key={p.interval}
                  className={
                    "relative rounded-xl border p-4 flex flex-col " +
                    (p.bestValue
                      ? "border-primary/60 bg-primary/5"
                      : "border-border/60 bg-background")
                  }
                >
                  {p.bestValue && (
                    <span className="absolute -top-2.5 right-3 rounded-full bg-primary text-primary-foreground text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5">
                      Best value
                    </span>
                  )}
                  <p className="text-sm font-medium">{p.label}</p>
                  <div className="mt-2">
                    <span className="font-display text-3xl font-semibold">{p.price}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.cadence}</p>
                  {p.perMonth && (
                    <p className="text-xs text-primary mt-1">{p.perMonth}</p>
                  )}
                  {isPro ? (
                    <Button disabled className="mt-4" variant="outline">Current plan</Button>
                  ) : (
                    <Button asChild className="mt-4">
                      <a href={p.paymentLink} target="_blank" rel="noopener noreferrer">
                        Subscribe {p.label}
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              Payments are processed by Instamojo. Each payment grants Pro access for a fixed
              duration (30 / 90 / 365 days). Not an auto-renewing subscription.
            </p>

            <ul className="mt-6 grid sm:grid-cols-2 gap-y-2 gap-x-4 text-sm">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {f}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mt-6">
              Prices in INR. Instamojo payments are one-time and grant Pro access for the
              chosen duration. Renew any time from this page.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Pricing;
