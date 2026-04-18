import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { BookOpen, Plus, Library, Sparkles, Feather, Quote } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    document.title = "Lexikon — Your personal English vocabulary dictionary";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Build your personal English vocabulary, one word at a time. Save meanings, pronunciation, examples, synonyms and more.");
    supabase.from("words").select("*", { count: "exact", head: true }).then(({ count }) => {
      if (typeof count === "number") setCount(count);
    });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-paper">
      <Header />
      <main>
        {/* Hero */}
        <section className="container py-16 sm:py-24 lg:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium mb-6">
              <Sparkles className="h-3 w-3" />
              {count > 0 ? `${count} word${count === 1 ? "" : "s"} in your collection` : "Start your vocabulary journey"}
            </div>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-semibold leading-[1.05] tracking-tight">
              Your personal
              <span className="block italic text-primary">English dictionary.</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
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
    </div>
  );
};

export default Index;
