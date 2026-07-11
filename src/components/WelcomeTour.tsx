import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, BookOpen, Camera, Brain, Castle, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const storageKey = (userId: string) => `lexikon-tour-seen:${userId}`;

const steps = [
  {
    icon: Sparkles,
    title: "Welcome to Lexikon",
    body: "Your personal English vocabulary companion. Capture words, master them and track your progress — all in one place.",
  },
  {
    icon: BookOpen,
    title: "Build your dictionary",
    body: "Add any word — Lexi will fetch pronunciation, meaning, examples and synonyms in one tap.",
  },
  {
    icon: Camera,
    title: "Capture words on the go",
    body: "Point your camera at a book, sign or screen. Lexi extracts vocabulary you can save — select one or many.",
  },
  {
    icon: Brain,
    title: "Practice daily",
    body: "A short daily quiz reinforces what you learn and builds a streak you can be proud of.",
  },
  {
    icon: Castle,
    title: "Remember with the Memory Palace",
    body: "Anchor new words to places you know using vivid mental imagery — the fastest path to lasting recall.",
  },
];

const WelcomeTour = () => {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (loading || !user) return;
    try {
      const seen = localStorage.getItem(storageKey(user.id));
      if (!seen) {
        // Slight delay so the app UI has time to render behind the dialog.
        const t = setTimeout(() => setOpen(true), 400);
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
  }, [user, loading]);

  const markSeen = () => {
    if (user) {
      try { localStorage.setItem(storageKey(user.id), "1"); } catch { /* ignore */ }
    }
    setOpen(false);
    setStep(0);
  };

  const Icon = steps[step].icon;
  const isLast = step === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) markSeen(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-warm flex items-center justify-center shadow-soft mb-2">
            <Icon className="h-7 w-7 text-primary-foreground" />
          </div>
          <DialogTitle className="text-center font-display text-2xl">{steps[step].title}</DialogTitle>
          <DialogDescription className="text-center text-base leading-relaxed">
            {steps[step].body}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center gap-1.5 py-2" aria-hidden="true">
          {steps.map((_, i) => (
            <span
              key={i}
              className={
                "h-1.5 rounded-full transition-all " +
                (i === step ? "w-6 bg-primary" : "w-1.5 bg-muted")
              }
            />
          ))}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button variant="ghost" onClick={markSeen} className="text-muted-foreground">
            Skip
          </Button>
          {isLast ? (
            <Button asChild onClick={markSeen}>
              <Link to="/add">
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)}>
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeTour;
