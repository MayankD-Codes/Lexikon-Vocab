import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";

const schema = z.object({
  word: z.string().trim().min(1, "Word is required").max(100),
  pronunciation: z.string().trim().max(150).optional(),
  spelling: z.string().trim().max(150).optional(),
  meaning_english: z.string().trim().max(1000).optional(),
  meaning_hindi: z.string().trim().max(1000).optional(),
  part_of_speech: z.string().trim().max(50).optional(),
  word_forms: z.string().trim().max(500).optional(),
  example_sentence: z.string().trim().max(1000).optional(),
  synonyms: z.string().trim().max(500).optional(),
  antonyms: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

type FormState = z.infer<typeof schema>;

const initial: FormState = {
  word: "", pronunciation: "", spelling: "", meaning_english: "", meaning_hindi: "",
  part_of_speech: "", word_forms: "", example_sentence: "", synonyms: "", antonyms: "", notes: "",
};

const AddWord = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Invalid input");
      return;
    }
    setSaving(true);
    const payload = Object.fromEntries(
      Object.entries(parsed.data).map(([k, v]) => [k, v && v.length ? v : null])
    );
    const { error } = await supabase.from("words").insert(payload as any);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`"${form.word}" added to your dictionary`);
    navigate("/dictionary");
  };

  return (
    <div className="min-h-screen bg-gradient-paper">
      <Header />
      <main className="container py-8 sm:py-12 max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="mb-8">
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight">Add a new word</h1>
          <p className="text-muted-foreground mt-2">Capture everything you want to remember about it.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 bg-card rounded-2xl p-6 sm:p-8 shadow-card border border-border/60">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="word">Word *</Label>
              <Input id="word" value={form.word} onChange={(e) => set("word", e.target.value)} placeholder="e.g. ephemeral" required maxLength={100} className="font-display text-lg" />
            </div>
            <div>
              <Label htmlFor="pronunciation">Pronunciation</Label>
              <Input id="pronunciation" value={form.pronunciation} onChange={(e) => set("pronunciation", e.target.value)} placeholder="/ɪˈfem.ər.əl/" maxLength={150} />
            </div>
            <div>
              <Label htmlFor="spelling">Spelling</Label>
              <Input id="spelling" value={form.spelling} onChange={(e) => set("spelling", e.target.value)} placeholder="e-phem-er-al" maxLength={150} />
            </div>
            <div>
              <Label htmlFor="part_of_speech">Part of speech</Label>
              <Select value={form.part_of_speech} onValueChange={(v) => set("part_of_speech", v)}>
                <SelectTrigger id="part_of_speech"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "interjection"].map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="word_forms">Word forms</Label>
              <Input id="word_forms" value={form.word_forms} onChange={(e) => set("word_forms", e.target.value)} placeholder="noun: ephemerality" maxLength={500} />
            </div>
          </div>

          <div>
            <Label htmlFor="meaning_english">Meaning (English)</Label>
            <Textarea id="meaning_english" value={form.meaning_english} onChange={(e) => set("meaning_english", e.target.value)} placeholder="Lasting for a very short time." maxLength={1000} rows={2} />
          </div>
          <div>
            <Label htmlFor="meaning_hindi">Meaning (Hindi)</Label>
            <Textarea id="meaning_hindi" value={form.meaning_hindi} onChange={(e) => set("meaning_hindi", e.target.value)} placeholder="क्षणिक, अल्पकालिक" maxLength={1000} rows={2} />
          </div>
          <div>
            <Label htmlFor="example_sentence">Example sentence</Label>
            <Textarea id="example_sentence" value={form.example_sentence} onChange={(e) => set("example_sentence", e.target.value)} placeholder="Fame is ephemeral; character endures." maxLength={1000} rows={2} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="synonyms">Synonyms</Label>
              <Input id="synonyms" value={form.synonyms} onChange={(e) => set("synonyms", e.target.value)} placeholder="fleeting, transient" maxLength={500} />
            </div>
            <div>
              <Label htmlFor="antonyms">Antonyms</Label>
              <Input id="antonyms" value={form.antonyms} onChange={(e) => set("antonyms", e.target.value)} placeholder="permanent, lasting" maxLength={500} />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Memory hook, where you heard it…" maxLength={1000} rows={3} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving} size="lg" className="flex-1">
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Word"}
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={() => setForm(initial)}>Reset</Button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default AddWord;
