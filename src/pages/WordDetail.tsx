import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";

import { supabase } from "@/integrations/supabase/client";
import type { Word } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Volume2, Sparkles, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { lexiExplainStream } from "@/lib/lexi";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Field = ({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) => {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">{label}</div>
      <div className={`text-base leading-relaxed ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
};

const WordDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [word, setWord] = useState<Word | null>(null);
  const [loading, setLoading] = useState(true);
  const [explanation, setExplanation] = useState("");
  const [explaining, setExplaining] = useState(false);

  const askLexi = async () => {
    if (!word || explaining) return;
    setExplaining(true);
    setExplanation("");
    try {
      await lexiExplainStream(word.word, word.notes ?? undefined, {
        onDelta: (chunk) => setExplanation((s) => s + chunk),
        onDone: () => setExplaining(false),
      });
    } catch (e) {
      setExplaining(false);
      toast.error(e instanceof Error ? e.message : "Lexi could not explain this word");
    }
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase.from("words").select("*").eq("id", id).maybeSingle();
      if (error) toast.error(error.message);
      setWord((data as Word) ?? null);
      setLoading(false);
    })();
  }, [id]);

  const speak = () => {
    if (!word) return;
    const u = new SpeechSynthesisUtterance(word.word);
    u.lang = "en-US";
    speechSynthesis.speak(u);
  };

  const onDelete = async () => {
    if (!word) return;
    const { error } = await supabase.from("words").delete().eq("id", word.id);
    if (error) return toast.error(error.message);
    toast.success("Word deleted");
    navigate("/dictionary");
  };

  return (
    <main className="container py-6 sm:py-12 max-w-3xl">
        {word && (
          <SEO
            title={`${word.word} — Lexikon`}
            description={
              word.meaning_english
                ? `Meaning of ${word.word}: ${word.meaning_english.slice(0, 140)}`
                : `${word.word} — saved in your personal Lexikon dictionary.`
            }
            noindex
          />
        )}
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/dictionary"><ArrowLeft className="h-4 w-4" /> Back to dictionary</Link>
        </Button>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !word ? (
          <div className="text-center py-20">
            <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-2">Word not found</h2>
            <Button asChild className="mt-4"><Link to="/dictionary">Back to dictionary</Link></Button>
          </div>
        ) : (
          <article className="bg-card rounded-2xl shadow-card border border-border/60 overflow-hidden">
            <header className="p-5 sm:p-8 md:p-10 border-b border-border/60 bg-gradient-to-br from-secondary/40 to-transparent">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight break-words">{word.word}</h1>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    {word.pronunciation && (
                      <span className="font-mono text-muted-foreground">{word.pronunciation}</span>
                    )}
                    {word.part_of_speech && (
                      <span className="italic text-sm text-primary">{word.part_of_speech}</span>
                    )}
                    <Button size="sm" variant="ghost" onClick={speak} className="h-8">
                      <Volume2 className="h-4 w-4" /> Listen
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/word/${word.id}/edit`}><Pencil className="h-4 w-4" /> Edit</Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm"><Trash2 className="h-4 w-4" /> Delete</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{word.word}"?</AlertDialogTitle>
                        <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </header>

            <div className="p-5 sm:p-8 md:p-10 space-y-6">
              <Field label="Meaning (English)" value={word.meaning_english} />
              <Field label="Meaning (Hindi)" value={word.meaning_hindi} />
              {word.example_sentence && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">Example</div>
                  <blockquote className="font-display italic text-lg border-l-4 border-primary/60 pl-4 leading-relaxed">
                    "{word.example_sentence}"
                  </blockquote>
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-6">
                <Field label="Spelling" value={word.spelling} mono />
                <Field label="Word forms" value={word.word_forms} />
                <Field label="Synonyms" value={word.synonyms} />
                <Field label="Antonyms" value={word.antonyms} />
              </div>
              <Field label="Notes" value={word.notes} />

              <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-gradient-warm flex items-center justify-center">
                      <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                    <div>
                      <div className="font-display font-semibold text-sm leading-none">Ask Lexi</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Deeper meaning, etymology & usage</div>
                    </div>
                  </div>
                  <Button size="sm" onClick={askLexi} disabled={explaining}>
                    {explaining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {explanation ? "Ask again" : "Explain this word"}
                  </Button>
                </div>
                {explanation && (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-display prose-headings:mt-3 prose-p:my-2">
                    <ReactMarkdown>{explanation}</ReactMarkdown>
                  </div>
                )}
                {explaining && !explanation && (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lexi is thinking…
                  </div>
                )}
              </div>

              <div className="text-xs text-muted-foreground pt-4 border-t border-border/60">
                Added {new Date(word.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
              </div>
            </div>
          </article>
        )}
      </main>
  );
};

export default WordDetail;
