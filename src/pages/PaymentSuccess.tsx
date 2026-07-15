import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, BookOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";

const PaymentSuccess = () => {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { user, loading: authLoading } = useAuth();
  const { isPro, loading: subLoading, refresh } = useSubscription();

  // Poll a couple of times in case the webhook hasn't finished yet.
  const [polling, setPolling] = useState(false);
  useEffect(() => {
    if (!user || isPro) return;
    setPolling(true);
    let cancelled = false;
    let attempt = 0;
    const tick = async () => {
      if (cancelled) return;
      attempt += 1;
      await refresh();
      if (attempt < 6 && !cancelled) setTimeout(tick, 2500);
      else setPolling(false);
    };
    const t = setTimeout(tick, 1500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [user, isPro, refresh]);

  const stillLoading = authLoading || (user && subLoading);

  return (
    <main className="min-h-screen bg-gradient-paper flex flex-col">
      <SEO
        title="Payment successful — Lexikon"
        description="Thank you for upgrading to Lexikon Pro. Your access is being activated."
        noindex
      />
      <header className="container py-6">
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-warm flex items-center justify-center shadow-soft">
            <BookOpen className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-semibold tracking-tight">Lexikon</span>
        </Link>
      </header>
      <section className="flex-1 container flex items-center justify-center pb-16">
        <div className="max-w-lg w-full text-center rounded-2xl border border-border/60 bg-card p-8 shadow-card">
          <div className="h-14 w-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            Payment received
          </h1>
          <p className="text-muted-foreground mt-3">
            Thanks for supporting Lexikon. Your Pro access is being activated
            — this usually takes just a few seconds.
          </p>

          {stillLoading ? (
            <div className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking your account…
            </div>
          ) : !user ? (
            <div className="mt-6 space-y-3">
              <p className="text-sm">
                Please sign in with the same Lexikon account you used at checkout to see your Pro access.
              </p>
              <Button asChild className="w-full"><Link to="/auth">Sign in <ArrowRight className="h-4 w-4" /></Link></Button>
            </div>
          ) : isPro ? (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-primary font-medium">You're on Lexikon Pro. Enjoy unlimited words!</p>
              <Button asChild className="w-full"><Link to="/dashboard">Continue to app <ArrowRight className="h-4 w-4" /></Link></Button>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                {polling && <Loader2 className="h-4 w-4 animate-spin" />}
                Activation is pending. This page will update automatically.
              </div>
              <Button asChild variant="outline" className="w-full"><Link to="/dashboard">Go to dashboard</Link></Button>
            </div>
          )}

          {sessionId && (
            <p className="text-[11px] text-muted-foreground mt-6 font-mono truncate">
              Ref: {sessionId}
            </p>
          )}
        </div>
      </section>
    </main>
  );
};

export default PaymentSuccess;
