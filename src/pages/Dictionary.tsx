import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";

import { supabase } from "@/integrations/supabase/client";
import type { Word } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, BookOpen, Download, Upload, FileDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const EXPORT_FIELDS: (keyof Word)[] = [
  "word", "pronunciation", "spelling", "meaning_english", "meaning_hindi",
  "part_of_speech", "word_forms", "example_sentence", "synonyms", "antonyms", "notes",
];

const POS_PARTS = ["Noun", "Verb", "Adjective", "Adverb", "Pronoun", "Preposition", "Conjunction", "Interjection"] as const;

const TEMPLATE_HEADERS = [
  "Word *",
  "Pronunciation",
  "Spelling",
  "Word forms",
  ...POS_PARTS,
  "Meaning (English)",
  "Meaning (Hindi)",
  "Example sentence",
  "Synonyms",
  "Antonyms",
  "Notes",
];

// Map normalized header (lowercase, trimmed) -> Word field key
const HEADER_TO_FIELD: Record<string, keyof Word> = {
  "word": "word",
  "word *": "word",
  "pronunciation": "pronunciation",
  "spelling": "spelling",
  "word forms": "word_forms",
  "word_forms": "word_forms",
  "meaning (english)": "meaning_english",
  "meaning english": "meaning_english",
  "meaning_english": "meaning_english",
  "meaning (hindi)": "meaning_hindi",
  "meaning hindi": "meaning_hindi",
  "meaning_hindi": "meaning_hindi",
  "example sentence": "example_sentence",
  "example_sentence": "example_sentence",
  "synonyms": "synonyms",
  "antonyms": "antonyms",
  "notes": "notes",
  "part of speech": "part_of_speech",
  "part_of_speech": "part_of_speech",
};

type Sort = "newest" | "oldest" | "az";

const Dictionary = () => {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadWords = async () => {
    const { data, error } = await supabase.from("words").select("*").order("created_at", { ascending: false });
    if (!error && data) setWords(data as Word[]);
    setLoading(false);
  };

  useEffect(() => {
    document.title = "Dictionary — Lexikon";
    loadWords();
  }, []);

  const handleExport = () => {
    if (words.length === 0) {
      toast({ title: "Nothing to export", description: "Add some words first." });
      return;
    }
    const rows = words.map((w) => {
      const r: Record<string, string> = {};
      EXPORT_FIELDS.forEach((f) => { r[f] = (w[f] as string) ?? ""; });
      return r;
    });
    const ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_FIELDS as string[] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Words");
    XLSX.writeFile(wb, `lexikon-words-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: "Exported", description: `${words.length} word${words.length === 1 ? "" : "s"} exported.` });
  };

  const handleDownloadTemplate = () => {
    const sample: Record<string, string> = {};
    TEMPLATE_HEADERS.forEach((h) => (sample[h] = ""));
    const ws = XLSX.utils.json_to_sheet([sample], { header: TEMPLATE_HEADERS });
    // Set reasonable column widths
    ws["!cols"] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(14, h.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "lexikon-import-template.xlsx");
    toast({ title: "Template downloaded", description: "Fill it in and upload to import." });
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const posKeys = POS_PARTS.map((p) => p.toLowerCase());

      const payload = rows
        .map((r) => {
          const norm: Record<string, string> = {};
          Object.keys(r).forEach((k) => { norm[k.trim().toLowerCase()] = String(r[k] ?? "").trim(); });
          const word = norm["word *"] || norm["word"];
          if (!word) return null;
          const obj: Record<string, string | null> = { word };

          // Map known headers to fields
          Object.entries(HEADER_TO_FIELD).forEach(([header, field]) => {
            if (field === "word") return;
            const v = norm[header];
            if (v && !obj[field]) obj[field] = v;
          });

          // Combine per-POS columns into part_of_speech (unless already provided)
          if (!obj.part_of_speech) {
            const parts: string[] = [];
            POS_PARTS.forEach((label, i) => {
              const v = norm[posKeys[i]];
              if (v) parts.push(`${label.toLowerCase()}: ${v}`);
            });
            if (parts.length) obj.part_of_speech = parts.join("; ");
          }

          // Ensure all export fields exist (null if missing)
          EXPORT_FIELDS.filter((f) => f !== "word").forEach((f) => {
            if (!(f in obj)) obj[f] = null;
          });
          return obj;
        })
        .filter((r): r is Record<string, string | null> => r !== null);

      if (payload.length === 0) {
        toast({ title: "No valid rows", description: "Make sure your file has a 'Word *' column. Download the template if needed.", variant: "destructive" });
        return;
      }

      const { error } = await supabase.from("words").insert(payload as never);
      if (error) {
        toast({ title: "Import failed", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Imported", description: `${payload.length} word${payload.length === 1 ? "" : "s"} added.` });
      await loadWords();
    } catch (err) {
      toast({ title: "Import failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

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
    <main className="container py-8 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight">Dictionary</h1>
            <p className="text-muted-foreground mt-2">
              {loading ? "Loading…" : `${words.length} word${words.length === 1 ? "" : "s"} saved`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImportFile}
              className="hidden"
            />
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <FileDown className="h-4 w-4" /> Template
            </Button>
            <Button variant="outline" onClick={handleImportClick} disabled={importing}>
              <Upload className="h-4 w-4" /> {importing ? "Importing…" : "Import"}
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button asChild>
              <Link to="/add"><Plus className="h-4 w-4" /> Add Word</Link>
            </Button>
          </div>
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
      </main>
  );
};

export default Dictionary;
