import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, BookOpen, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SEO from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { BillingInterval } from "@/lib/billing";

const PLAN_LABELS: Record<BillingInterval, string> = {
  monthly: "Lexikon Pro Monthly (₹499 / 30 days)",
  quarterly: "Lexikon Pro Quarterly (₹1,299 / 90 days)",
  yearly: "Lexikon Pro Yearly (₹3,999 / 365 days)",
};

const PaymentSuccess = () => {
  const [params] = useSearchParams();
  const paymentIdFromUrl =
    params.get("payment_id") ||
    params.get("payment_request_id") ||
    params.get("session_id") ||
    "";

  const { user, loading: authLoading } = useAuth();
  const { isPro, isPending, loading: subLoading, refresh } = useSubscription();

  const [paymentId, setPaymentId] = useState(paymentIdFromUrl);
  const [plan, setPlan] = useState<BillingInterval>("monthly");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const stillLoading = authLoading || (user && subLoading);

  const submitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!paymentId.trim()) {
      toast({ title: "Payment ID required", description: "Please paste your Instamojo payment ID." });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("payment_verification_requests").insert({
      user_id: user.id,
      provider: "instamojo",
      payment_id: paymentId.trim(),
      selected_plan: plan,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Could not submit", description: error.message, variant: "destructive" });
      return;
    }
    setSubmitted(true);
    toast({ title: "Verification submitted", description: "We'll activate your Pro access after confirming the payment." });
    refresh();
  };

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
            Thanks for supporting Lexikon. Instamojo payments are verified manually —
            your Pro access will be activated after we confirm your payment.
          </p>

          {stillLoading ? (
            <div className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking your account…
            </div>
          ) : !user ? (
            <div className="mt-6 space-y-3 text-left">
              <p className="text-sm text-center">
                Please sign in with the same Lexikon account you want Pro on, then submit
                your Instamojo payment ID here so we can activate access.
              </p>
              <Button asChild className="w-full">
                <Link to="/auth">Sign in <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
          ) : isPro ? (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-primary font-medium">You're on Lexikon Pro. Enjoy unlimited words!</p>
              <Button asChild className="w-full">
                <Link to="/dashboard">Continue to app <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
          ) : submitted || isPending ? (
            <div className="mt-6 space-y-3">
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                Verification pending — we'll activate Pro as soon as the payment is confirmed.
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link to="/dashboard">Go to dashboard</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={submitVerification} className="mt-6 space-y-3 text-left">
              <p className="text-sm text-muted-foreground">
                Paste your Instamojo payment ID so we can verify and activate Pro on this account.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="payment_id">Instamojo payment ID</Label>
                <Input
                  id="payment_id"
                  value={paymentId}
                  onChange={(e) => setPaymentId(e.target.value)}
                  placeholder="e.g. MOJO4a01a05J12345678"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan">Plan you paid for</Label>
                <select
                  id="plan"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value as BillingInterval)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {(Object.keys(PLAN_LABELS) as BillingInterval[]).map((k) => (
                    <option key={k} value={k}>{PLAN_LABELS[k]}</option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit for verification
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Keep the payment confirmation email/SMS from Instamojo until Pro is activated.
              </p>
            </form>
          )}

          {paymentIdFromUrl && (
            <p className="text-[11px] text-muted-foreground mt-6 font-mono truncate">
              Ref: {paymentIdFromUrl}
            </p>
          )}
        </div>
      </section>
    </main>
  );
};

export default PaymentSuccess;
