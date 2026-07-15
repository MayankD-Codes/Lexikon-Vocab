import { Link } from "react-router-dom";
import { XCircle, BookOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";

const PaymentCancelled = () => {
  return (
    <main className="min-h-screen bg-gradient-paper flex flex-col">
      <SEO
        title="Payment cancelled — Lexikon"
        description="Your Lexikon Pro checkout was cancelled. You can continue on the free plan or try again anytime."
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
          <div className="h-14 w-14 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
            <XCircle className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            Checkout cancelled
          </h1>
          <p className="text-muted-foreground mt-3">
            No worries — no payment was taken. You can keep using Lexikon on the free plan,
            or try upgrading again whenever you're ready.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button asChild variant="outline"><Link to="/dashboard">Back to app</Link></Button>
            <Button asChild><Link to="/pricing">See plans <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </div>
      </section>
    </main>
  );
};

export default PaymentCancelled;
