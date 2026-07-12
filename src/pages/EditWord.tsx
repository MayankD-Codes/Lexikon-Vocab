import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/invokeFunction";
import type { Word } from "@/lib/types";
import { toast } from "sonner";
import { ArrowLeft, Save, Sparkles, Loader2 } from "lucide-react";
import SEO from "@/components/SEO";


const schema = z.object({
  word: z.string().trim().min(1, "Word is required").max(100),
  pronunciation: z.string().trim().max(150).optional(),
  spelling: z.string().trim().max(150).optional(),
  meaning_english: z.string().trim().max(1000).optional(),
  meaning_hindi: z.string().trim().max(1000).optional(),
  pos_noun: z.string().trim().max(200).optional(),
  pos_verb: z.string().trim().max(200).optional(),
  pos_adjective: z.string().trim().max(200).optional(),
  pos_adverb: z.string().trim().max(200).optional(),
  pos_pronoun: z.string().trim().max(200).optional(),
  pos_preposition: z.string().trim().max(200).optional(),
  pos_conjunction: z.string().trim().max(200).optional(),
  pos_interjection: z.string().trim().max(200).optional(),
  word_forms: z.string().trim().max(500).optional(),
  example_sentence: z.string().trim().max(1000).optional(),
  synonyms: z.string().trim().max(500).optional(),
  antonyms: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

type FormState = z.infer<typeof schema>;

const POS_FIELDS: { key: keyof FormState; label: string; pos: string }[] = [
  { key: "pos_noun", label: "Noun", pos: "noun" },
  { key: "pos_verb", label: "Verb", pos: "verb" },
  { key: "pos_adjective", label: "Adjective", pos: "adjective" },
  { key: "pos_adverb", label: "Adverb", pos: "adverb" },
  { key: "pos_pronoun", label: "Pronoun", pos: "pronoun" },
  { key: "pos_preposition", label: "Preposition", pos: "preposition" },
  { key: "pos_conjunction", label: "Conjunction", pos: "conjunction" },
  { key: "pos_interjection", label: "Interjection", pos: "interjection" },
];

const initial: FormState = {
  word: "", pronunciation: "", spelling: "", meaning_english: "", meaning_hindi: "",
  pos_noun: "", pos_verb: "", pos_adjective: "", pos_adverb: "",
  pos_pronoun: "", pos_preposition: "", pos_conjunction: "", pos_interjection: "",
  word_forms: "", example_sentence: "", synonyms: "", antonyms: "", notes: "",
};

// Parse a stored "noun: X; verb: Y" string back into per-POS fields.
const parsePartOfSpeech = (raw: string | null | undefined): Partial<FormState> => {
  const out: Partial<FormState> = {};
  if (!raw) return out;
  const map: Record<string, keyof FormState> = {
    noun: "pos_noun", verb: "pos_verb", adjective: "pos_adjective", adverb: "pos_adverb",
    pronoun: "pos_pronoun", preposition: "pos_preposition", conjunction: "pos_conjunction", interjection: "pos_interjection",
  };
  raw.split(/[;\n]+/).forEach((seg) => {
    const m = seg.match(/^\s*([A-Za-z]+)\s*:\s*(.+?)\s*$/);
    if (!m) return;
    const key = map[m[1].toLowerCase()];
    if (key) out[key] = ((out[key] ?? "") ? `${out[key]}; ` : "") + m[2].trim();
  });
  return out;
};

const mapPosString = (pos: string | undefined, word: string): Partial<FormState> => {
  if (!pos) return {};
  const out: Partial<FormState> = {};
  const lower = pos.toLowerCase();
  POS_FIELDS.forEach(({ key, pos: name }) => {
    if (lower.includes(name)) out[key] = word;
  });
  return out;
};

const EditWord = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [askingLexi, setAskingLexi] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase.from("words").select("*").eq("id", id).maybeSingle();
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      if (!data) {
        setLoading(false);
        return;
      }
      const w = data as Word;
      const posParts = parsePartOfSpeech(w.part_of_speech);
      setForm({
        ...initial,
        word: w.word ?? "",
        pronunciation: w.pronunciation ?? "",
        spelling: w.spelling ?? "",
        meaning_english: w.meaning_english ?? "",
        meaning_hindi: w.meaning_hindi ?? "",
        word_forms: w.word_forms ?? "",
        example_sentence: w.example_sentence ?? "",
        synonyms: w.synonyms ?? "",
        antonyms: w.antonyms ?? "",
        notes: w.notes ?? "",
        ...posParts,
      });
      setLoading(false);
    })();
  }, [id]);

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const askLexi = async () => {
    const w = form.word.trim();
    if (!w) {
      toast.error("Type a word first, then ask Lexi.");
      return;
    }
    setAskingLexi(true);
    try {
      const { data, error } = await invokeFunction<Record<string, string | undefined>>("lexi-fill-word", { word: w });
      if (error) throw new Error(error);
      const d = data ?? {};
      setForm((f) => ({
        ...f,
        pronunciation: d.pronunciation ?? f.pronunciation,
        spelling: d.spelling ?? f.spelling,
        meaning_english: d.meaning_english ?? f.meaning_english,
        meaning_hindi: d.meaning_hindi ?? f.meaning_hindi,
        word_forms: d.word_forms ?? f.word_forms,
        example_sentence: d.example_sentence ?? f.example_sentence,
        synonyms: d.synonyms ?? f.synonyms,
        antonyms: d.antonyms ?? f.antonyms,
        ...mapPosString(d.part_of_speech, w),
      }));
      toast.success("Lexi refilled. Review before saving.");

    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lexi could not fetch this word");
    } finally {
      setAskingLexi(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Invalid input");
      return;
    }
    setSaving(true);
    const data = parsed.data;
    const posCombined = POS_FIELDS
      .map(({ key, label }) => {
        const v = (data[key] ?? "").trim();
        return v ? `${label.toLowerCase()}: ${v}` : null;
      })
      .filter(Boolean)
      .join("; ");
    const { pos_noun, pos_verb, pos_adjective, pos_adverb, pos_pronoun, pos_preposition, pos_conjunction, pos_interjection, ...rest } = data;
    const payload: Record<string, string | null> = Object.fromEntries(
      Object.entries(rest).map(([k, v]) => [k, v && v.length ? v : null])
    );
    payload.part_of_speech = posCombined.length ? posCombined : null;

    const { error } = await supabase.from("words").update(payload as never).eq("id", id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`"${form.word}" updated`);
    navigate(`/word/${id}`);
  };

  return (
    <main className="container py-6 sm:py-12 max-w-2xl">
      <SEO title="Edit Word — Lexikon" description="Edit a word in your personal Lexikon dictionary." noindex />
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to={id ? `/word/${id}` : "/dictionary"}><ArrowLeft className="h-4 w-4" /> Back</Link>
      </Button>
      <div className="mb-6 sm:mb-8">
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">Edit word</h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">Update any field and save your changes.</p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5 bg-card rounded-2xl p-4 sm:p-6 md:p-8 shadow-card border border-border/60">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="word">Word *</Label>
                <Button
                  type="button" variant="ghost" size="sm"
                  onClick={askLexi}
                  disabled={askingLexi || !form.word.trim()}
                  className="h-8 text-xs gap-1.5"
                >
                  {askingLexi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {askingLexi ? "Asking Lexi…" : "Ask Lexi to refill"}
                </Button>
              </div>
              <Input id="word" value={form.word} onChange={(e) => set("word", e.target.value)} required maxLength={100} className="font-display text-lg" />
            </div>
            <div>
              <Label htmlFor="pronunciation">Pronunciation</Label>
              <Input id="pronunciation" value={form.pronunciation} onChange={(e) => set("pronunciation", e.target.value)} maxLength={150} />
            </div>
            <div>
              <Label htmlFor="spelling">Spelling</Label>
              <Input id="spelling" value={form.spelling} onChange={(e) => set("spelling", e.target.value)} maxLength={150} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="word_forms">Word forms</Label>
              <Input id="word_forms" value={form.word_forms} onChange={(e) => set("word_forms", e.target.value)} maxLength={500} />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Part of speech</Label>
            <p className="text-xs text-muted-foreground mb-3">Fill in the form(s) the word takes for each applicable type.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {POS_FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <Label htmlFor={key} className="text-sm">{label}</Label>
                  <Input id={key} value={form[key] ?? ""} onChange={(e) => set(key, e.target.value)} maxLength={200} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="meaning_english">Meaning (English)</Label>
            <Textarea id="meaning_english" value={form.meaning_english} onChange={(e) => set("meaning_english", e.target.value)} maxLength={1000} rows={2} />
          </div>
          <div>
            <Label htmlFor="meaning_hindi">Meaning (Hindi)</Label>
            <Textarea id="meaning_hindi" value={form.meaning_hindi} onChange={(e) => set("meaning_hindi", e.target.value)} maxLength={1000} rows={2} />
          </div>
          <div>
            <Label htmlFor="example_sentence">Example sentence</Label>
            <Textarea id="example_sentence" value={form.example_sentence} onChange={(e) => set("example_sentence", e.target.value)} maxLength={1000} rows={2} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="synonyms">Synonyms</Label>
              <Input id="synonyms" value={form.synonyms} onChange={(e) => set("synonyms", e.target.value)} maxLength={500} />
            </div>
            <div>
              <Label htmlFor="antonyms">Antonyms</Label>
              <Input id="antonyms" value={form.antonyms} onChange={(e) => set("antonyms", e.target.value)} maxLength={500} />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={1000} rows={3} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving} size="lg" className="flex-1">
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={() => navigate(id ? `/word/${id}` : "/dictionary")}>Cancel</Button>
          </div>
        </form>
      )}
    </main>
  );
};

export default EditWord;
