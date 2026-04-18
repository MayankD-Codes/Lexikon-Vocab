import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import type { Word } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, BookOpen } from "lucide-react";

type Sort = "newest" | "oldest" | "az";

const Dictionary = () => {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");

  useEffect(() => {
    document.title = "Dictionary — Lexikon";
    (async () => {
      const { data, error } = await supabase.from("words").select("*").order("created_at", { ascending: false });
      if (!error && data) setWords(data as Word[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = words.filter((w) =>
      !q ||
      w.word.toLowerCase().includes(q) ||
      (w.meaning_english ?? "").toLowerCase().includes(q) ||
      (w.meaning_hindi ?? "").toLowerCase().includes(q)
    );
    list = [...list].sort((a, b) => {
      if (sort === "az") return a.word.localeCompare(b.word);
      if (sort === "oldest") return +new Date(a.created_at) - +new Date(b.created_at);
      return +new Date(b.created_at) - +new Date(a.created_at);
    });
    return list;
  }, [words, query, sort]);

  return (
    <div className="min-h-screen bg-gradient-paper">
      <Header />
      <main className="container py-8 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight">Dictionary</h1>
            <p className="text-muted-foreground mt-2">
              {loading ? "Loading…" : `${words.length} word${words.length === 1 ? "" : "s"} saved`}
            </p>
          </div>
          <Button asChild>
            <Link to="/add"><Plus className="h-4 w-4" /> Add Word</Link>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by word or meaning…" className="pl-9" />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="az">A → Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? null : filtered.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-border/60 shadow-card">
            <div className="h-14 w-14 mx-auto rounded-full bg-secondary flex items-center justify-center mb-4">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-semibold mb-2">
              {words.length === 0 ? "Your dictionary is empty" : "No matches"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {words.length === 0 ? "Add your first word to begin building your collection." : "Try a different search term."}
            </p>
            {words.length === 0 && (
              <Button asChild><Link to="/add"><Plus className="h-4 w-4" /> Add your first word</Link></Button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((w) => (
              <Link key={w.id} to={`/word/${w.id}`} className="group block rounded-xl bg-card border border-border/60 p-5 shadow-card hover:shadow-elegant hover:border-primary/40 transition-all">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <h3 className="font-display text-2xl font-semibold tracking-tight group-hover:text-primary transition-colors truncate">{w.word}</h3>
                  {w.part_of_speech && (
                    <span className="text-xs italic text-muted-foreground shrink-0">{w.part_of_speech}</span>
                  )}
                </div>
                {w.pronunciation && (
                  <p className="text-sm text-muted-foreground font-mono mb-2">{w.pronunciation}</p>
                )}
                {w.meaning_english && (
                  <p className="text-sm leading-relaxed line-clamp-2">{w.meaning_english}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dictionary;
