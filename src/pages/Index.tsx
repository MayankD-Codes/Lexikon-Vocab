import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { BookOpen, Plus, Library, Sparkles, Feather, Quote, Brain, ArrowRight, CheckCircle2, Calendar, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { Word } from "@/lib/types";
import SEO from "@/components/SEO";

// Deterministic daily index based on YYYY-MM-DD so all visits today show the same word
const dayHash = (iso: string): number => {
  let h = 0;
  for (let i = 0; i < iso.length; i++) h = (h * 31 + iso.charCodeAt(i)) >>> 0;
  return h;
};

const Index = () => {
  const [count, setCount] = useState<number>(0);
  const [quizDoneToday, setQuizDoneToday] = useState<boolean>(false);
  const [wotd, setWotd] = useState<Word | null>(null);

  useEffect(() => {
    supabase.from("words").select("*", { count: "exact", head: true }).then(({ count }) => {
      if (typeof count === "number") setCount(count);
    });
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    supabase
      .from("quiz_sessions")
      .select("completed")
      .eq("quiz_date", iso)
      .maybeSingle()
      .then(({ data }) => setQuizDoneToday(!!data?.completed));

    // Word of the Day — deterministic pick across the user's dictionary
    supabase
      .from("words")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const idx = dayHash(iso) % data.length;
        setWotd(data[idx] as Word);
      });
  }, []);

  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const quizUnlocked = count >= 10;

  return (
    <>
      <SEO
        title="Lexikon — Your Personal English Vocabulary Dictionary"
        description="Build your personal English vocabulary, one word at a time. Save meanings, pronunciation, examples, synonyms and take a daily quiz to remember them."
        path="/"
      />
      <main>
        {/* Hero */}
        <section className="container py-12 sm:py-20 lg:py-28">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium mb-6">
              <Sparkles className="h-3 w-3" />
              {count > 0 ? `${count} word${count === 1 ? "" : "s"} in your collection` : "Start your vocabulary journey"}
            </div>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold leading-[1.05] tracking-tight">
              Your personal
              <span className="block italic text-primary">English Vocabulary.</span>
            </h1>
            <p className="mt-5 sm:mt-6 text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Capture every new word you discover — with meaning, pronunciation, examples and personal notes. Build a vocabulary that's truly yours.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="text-base h-12 px-8 shadow-elegant">
                <Link to="/add">
                  <Plus className="h-5 w-5" /> Add a New Word
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-base h-12 px-8">
                <Link to="/dictionary">
                  <Library className="h-5 w-5" /> Browse Dictionary
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Word of the Day */}
        {wotd && (
          <section className="container pb-4">
            <div className="max-w-3xl mx-auto rounded-2xl border border-border/60 bg-gradient-paper p-6 sm:p-8 shadow-card relative overflow-hidden">
              <div className="absolute top-0 right-0 h-32 w-32 bg-gradient-warm opacity-10 blur-3xl rounded-full -mr-10 -mt-10" />
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Word of the Day</span>
              </div>
              <div className="flex flex-wrap items-baseline gap-3 mb-2">
                <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">{wotd.word}</h2>
                {wotd.pronunciation && (
                  <span className="text-base text-muted-foreground italic">/{wotd.pronunciation}/</span>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full"
                  onClick={() => speak(wotd.word)}
                  aria-label="Pronounce word"
                >
                  <Volume2 className="h-4 w-4" />
                </Button>
              </div>
              {wotd.part_of_speech && (
                <Badge variant="secondary" className="mb-3">{wotd.part_of_speech}</Badge>
              )}
              {wotd.meaning_english && (
                <p className="text-base sm:text-lg text-foreground/90 leading-relaxed mb-3">
                  {wotd.meaning_english}
                </p>
              )}
              {wotd.example_sentence && (
                <blockquote className="border-l-2 border-primary/40 pl-4 italic text-sm sm:text-base text-muted-foreground leading-relaxed mb-4">
                  "{wotd.example_sentence}"
                </blockquote>
              )}
              <Button asChild variant="outline" size="sm">
                <Link to={`/word/${wotd.id}`}>
                  View full entry <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </section>
        )}

        {/* Daily Quiz banner */}
        <section className="container pb-4">
          <div className="max-w-3xl mx-auto rounded-2xl border border-border/60 bg-card p-6 sm:p-8 shadow-card flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
            <div className="h-12 w-12 rounded-xl bg-gradient-warm flex items-center justify-center shadow-soft shrink-0">
              <Brain className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-display text-lg sm:text-xl font-semibold">Daily Quiz</h2>
                {quizDoneToday && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Done for today
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {!quizUnlocked
                  ? `Add ${10 - count} more word${10 - count === 1 ? "" : "s"} to unlock your daily quiz.`
                  : quizDoneToday
                  ? "Great work — come back tomorrow for a fresh round."
                  : "7 personalized questions drawn from your weakest, newest, and best-known words."}
              </p>
            </div>
            <Button asChild size="lg" disabled={!quizUnlocked} variant={quizDoneToday ? "outline" : "default"}>
              <Link to="/quiz">
                {quizDoneToday ? "View Results" : "Start Quiz"} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="container pb-20 sm:pb-28">
          <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
            {[
              { icon: Feather, title: "Capture in context", body: "Save the example sentence where you first met the word — context is how vocabulary sticks." },
              { icon: BookOpen, title: "Forms & families", body: "Record the noun, verb, adjective and adverb forms so you learn the whole word, not just one shape." },
              { icon: Quote, title: "Synonyms & antonyms", body: "Connect new words to ones you already know to deepen meaning and recall." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-xl bg-card border border-border/60 p-6 shadow-card hover:shadow-soft transition-shadow">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
};

export default Index;
