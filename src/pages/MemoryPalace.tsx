import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Sparkles,
  Trash2,
  Brain,
  ArrowRight,
  Check,
  X,
  Loader2,
  Pencil,
  ArrowUp,
  ArrowDown,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import SEO from "@/components/SEO";

type AnchorRow = {
  id: string;
  name: string;
  anchor_order: number;
  style: string | null;
  active_word_count: number;
};

type ActivePlacement = {
  id: string;
  word_id: string;
  word: string;
  meaning_english: string | null;
  anchor_id: string;
  anchor_name: string;
  imagery_text: string;
  recall_correct: number;
  recall_incorrect: number;
  last_recalled_at: string | null;
  created_at: string;
};

type UnplacedWord = { id: string; word: string; meaning_english: string | null };

const STYLE_OPTIONS = [
  {
    id: "sequence",
    label: "A familiar sequence",
    hint: "Morning routine, daily workflow…",
  },
  {
    id: "categories",
    label: "Personal categories",
    hint: "Formal, informal, academic…",
  },
  {
    id: "steps",
    label: "Conceptual steps",
    hint: "Beginner → advanced…",
  },
];

const MIN_WORDS = 5;
const STABILIZE_AT = 3;

const MemoryPalace = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [wordCount, setWordCount] = useState(0);
  const [anchors, setAnchors] = useState<AnchorRow[]>([]);
  const [active, setActive] = useState<ActivePlacement[]>([]);
  const [unplaced, setUnplaced] = useState<UnplacedWord[]>([]);

  // Setup wizard state
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupStep, setSetupStep] = useState<1 | 2 | 3>(1);
  const [chosenStyle, setChosenStyle] = useState<string>("sequence");
  const [draftAnchors, setDraftAnchors] = useState<string[]>(["", "", "", "", ""]);
  const [savingSetup, setSavingSetup] = useState(false);

  // Encode flow
  const [encodeOpen, setEncodeOpen] = useState(false);
  const [encodeWordId, setEncodeWordId] = useState<string>("");
  const [encodeAnchorId, setEncodeAnchorId] = useState<string>("");
  const [encodeImagery, setEncodeImagery] = useState<string>("");
  const [encodeLoading, setEncodeLoading] = useState(false);
  const [encodeSaving, setEncodeSaving] = useState(false);

  // Recall mode
  const [recallOpen, setRecallOpen] = useState(false);
  const [recallIndex, setRecallIndex] = useState(0);
  const [recallGuess, setRecallGuess] = useState("");
  const [recallChecked, setRecallChecked] = useState(false);
  const [recallCorrect, setRecallCorrect] = useState(false);
  const [recallQueue, setRecallQueue] = useState<ActivePlacement[]>([]);

  const refreshAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ count }, anchorsRes, activeRes, unplacedRes] = await Promise.all([
        supabase
          .from("words")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase.rpc("get_memory_palace_anchors", { _user_id: user.id }),
        supabase.rpc("get_memory_palace_active", { _user_id: user.id }),
        supabase.rpc("get_unplaced_words", { _user_id: user.id }),
      ]);
      setWordCount(count ?? 0);
      if (anchorsRes.error) throw anchorsRes.error;
      if (activeRes.error) throw activeRes.error;
      if (unplacedRes.error) throw unplacedRes.error;
      setAnchors((anchorsRes.data ?? []) as AnchorRow[]);
      setActive((activeRes.data ?? []) as ActivePlacement[]);
      setUnplaced((unplacedRes.data ?? []) as UnplacedWord[]);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't load your palace");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const totalActive = active.length;
  const slotsAvailable = Math.max(0, 10 - totalActive);
  const hasPalace = anchors.length > 0;
  const meetsThreshold = wordCount >= MIN_WORDS;

  // ---- Setup wizard ----
  const openSetup = () => {
    setSetupStep(1);
    setChosenStyle("sequence");
    setDraftAnchors(["", "", "", "", ""]);
    setSetupOpen(true);
  };

  const updateDraftAnchor = (i: number, v: string) =>
    setDraftAnchors((arr) => arr.map((a, idx) => (idx === i ? v : a)));

  const addDraftSlot = () => {
    if (draftAnchors.length >= 7) return;
    setDraftAnchors((arr) => [...arr, ""]);
  };
  const removeDraftSlot = (i: number) => {
    if (draftAnchors.length <= 5) return;
    setDraftAnchors((arr) => arr.filter((_, idx) => idx !== i));
  };

  const saveSetup = async () => {
    if (!user) return;
    const cleaned = draftAnchors.map((a) => a.trim()).filter(Boolean);
    if (cleaned.length < 5) {
      toast.error("Name at least 5 anchors");
      return;
    }
    setSavingSetup(true);
    try {
      const rows = cleaned.map((name, i) => ({
        user_id: user.id,
        name: name.slice(0, 60),
        anchor_order: i,
        style: chosenStyle,
      }));
      const { error } = await supabase.from("memory_palace_anchors").insert(rows);
      if (error) throw error;
      toast.success("Your palace is ready");
      setSetupOpen(false);
      await refreshAll();
    } catch (e) {
      console.error(e);
      toast.error("Couldn't save anchors");
    } finally {
      setSavingSetup(false);
    }
  };

  // ---- Encoding ----
  const openEncode = () => {
    if (slotsAvailable <= 0) {
      toast.error("Palace is full — recall and stabilize words first");
      return;
    }
    if (unplaced.length === 0) {
      toast.error("All your words are already placed");
      return;
    }
    setEncodeWordId(unplaced[0]?.id ?? "");
    setEncodeAnchorId("");
    setEncodeImagery("");
    setEncodeOpen(true);
  };

  const generateImagery = async () => {
    const word = unplaced.find((w) => w.id === encodeWordId);
    const anchor = anchors.find((a) => a.id === encodeAnchorId);
    if (!word || !anchor) {
      toast.error("Choose a word and an anchor");
      return;
    }
    setEncodeLoading(true);
    setEncodeImagery("");
    try {
      const { data, error } = await supabase.functions.invoke("memory-palace-guide", {
        body: {
          word: word.word,
          meaning: word.meaning_english,
          anchor: anchor.name,
          anchorStyle: anchor.style,
        },
      });
      if (error) throw error;
      const imagery = (data as { imagery?: string })?.imagery?.trim();
      if (!imagery) throw new Error("Empty response");
      setEncodeImagery(imagery);
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Lexi failed";
      toast.error(msg);
    } finally {
      setEncodeLoading(false);
    }
  };

  const savePlacement = async () => {
    if (!user || !encodeImagery.trim() || !encodeWordId || !encodeAnchorId) return;
    setEncodeSaving(true);
    try {
      const anchor = anchors.find((a) => a.id === encodeAnchorId);
      if (anchor && anchor.active_word_count >= 2) {
        toast.error("That anchor already has 2 active words");
        setEncodeSaving(false);
        return;
      }
      const { error } = await supabase.from("memory_palace_placements").insert({
        user_id: user.id,
        word_id: encodeWordId,
        anchor_id: encodeAnchorId,
        imagery_text: encodeImagery.trim(),
        status: "active",
      });
      if (error) throw error;
      toast.success("Placed in your palace");
      setEncodeOpen(false);
      await refreshAll();
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Couldn't place word";
      toast.error(msg);
    } finally {
      setEncodeSaving(false);
    }
  };

  // ---- Recall mode ----
  const startRecall = () => {
    if (active.length === 0) {
      toast.error("Place a few words first");
      return;
    }
    // Shuffle a copy
    const shuffled = [...active].sort(() => Math.random() - 0.5);
    setRecallQueue(shuffled);
    setRecallIndex(0);
    setRecallGuess("");
    setRecallChecked(false);
    setRecallCorrect(false);
    setRecallOpen(true);
  };

  const current = recallQueue[recallIndex];

  const checkRecall = async () => {
    if (!current) return;
    const guess = recallGuess.trim().toLowerCase();
    const truth = current.word.trim().toLowerCase();
    const correct = guess.length > 0 && guess === truth;
    setRecallCorrect(correct);
    setRecallChecked(true);

    try {
      const newCorrect = current.recall_correct + (correct ? 1 : 0);
      const newIncorrect = current.recall_incorrect + (correct ? 0 : 1);
      const shouldStabilize = correct && newCorrect >= STABILIZE_AT;
      const { error } = await supabase
        .from("memory_palace_placements")
        .update({
          recall_correct: newCorrect,
          recall_incorrect: newIncorrect,
          last_recalled_at: new Date().toISOString(),
          status: shouldStabilize ? "stable" : "active",
        })
        .eq("id", current.id);
      if (error) throw error;
      if (shouldStabilize) {
        toast.success(`"${current.word}" is now stable in memory`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const nextRecall = () => {
    if (recallIndex + 1 >= recallQueue.length) {
      setRecallOpen(false);
      refreshAll();
      toast.success("Recall session complete");
      return;
    }
    setRecallIndex((i) => i + 1);
    setRecallGuess("");
    setRecallChecked(false);
    setRecallCorrect(false);
  };

  // ---- Render ----
  const placementsByAnchor = useMemo(() => {
    const map = new Map<string, ActivePlacement[]>();
    active.forEach((p) => {
      const arr = map.get(p.anchor_id) ?? [];
      arr.push(p);
      map.set(p.anchor_id, arr);
    });
    return map;
  }, [active]);

  return (
    <div className="container max-w-5xl mx-auto px-4 py-6 sm:py-8">
      <SEO
        title="Memory Palace — Lexikon"
        description="Permanently memorize your words using personal anchors and effortful recall."
      />

      <header className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-gradient-warm flex items-center justify-center shadow-soft">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
            Memory Palace
          </h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Attach your words to mental anchors you already know. Recall them, not by
          looking — but by remembering.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !meetsThreshold ? (
        <Card>
          <CardHeader>
            <CardTitle>Add a few words first</CardTitle>
            <CardDescription>
              You need at least {MIN_WORDS} words in your dictionary before you can
              build a memory palace. You currently have {wordCount}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/add">Add a word</a>
            </Button>
          </CardContent>
        </Card>
      ) : !hasPalace ? (
        <Card>
          <CardHeader>
            <CardTitle>Build your palace</CardTitle>
            <CardDescription>
              You'll memorize your words by attaching them to mental anchors you
              already know. No images. No games. Just memory.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={openSetup} size="lg">
              Create my Memory Palace
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="palace" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="palace">Palace</TabsTrigger>
            <TabsTrigger value="recall">Recall</TabsTrigger>
          </TabsList>

          <TabsContent value="palace" className="space-y-6">
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Unplaced</div>
                  <div className="text-2xl font-display font-semibold">
                    {unplaced.length}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Active</div>
                  <div className="text-2xl font-display font-semibold">
                    {totalActive}
                    <span className="text-base text-muted-foreground"> / 10</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">Slots free</div>
                  <div className="text-2xl font-display font-semibold">
                    {slotsAvailable}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={openEncode}
                disabled={slotsAvailable <= 0 || unplaced.length === 0}
              >
                <Plus className="h-4 w-4" />
                Place a word
              </Button>
              <Button variant="outline" onClick={startRecall} disabled={active.length === 0}>
                <Brain className="h-4 w-4" />
                Start recall
              </Button>
            </div>

            <div className="space-y-3">
              {anchors.map((a) => {
                const items = placementsByAnchor.get(a.id) ?? [];
                return (
                  <Card key={a.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                          <span className="text-muted-foreground text-xs font-mono">
                            {String(a.anchor_order + 1).padStart(2, "0")}
                          </span>
                          {a.name}
                        </CardTitle>
                        <Badge variant="secondary" className="font-normal">
                          {a.active_word_count} / 2
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {items.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                          No words placed here yet.
                        </p>
                      ) : (
                        <ul className="space-y-3">
                          {items.map((p) => (
                            <li
                              key={p.id}
                              className="rounded-md border border-border/60 bg-background/50 p-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-display font-medium">{p.word}</div>
                                <button
                                  className="text-muted-foreground hover:text-destructive transition-colors"
                                  onClick={async () => {
                                    const { error } = await supabase
                                      .from("memory_palace_placements")
                                      .delete()
                                      .eq("id", p.id);
                                    if (error) {
                                      toast.error("Couldn't remove");
                                      return;
                                    }
                                    toast.success("Removed");
                                    refreshAll();
                                  }}
                                  aria-label="Remove placement"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1 leading-relaxed whitespace-pre-wrap">
                                {p.imagery_text}
                              </p>
                              <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                                <span>✓ {p.recall_correct}</span>
                                <span>✕ {p.recall_incorrect}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="recall" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recall session</CardTitle>
                <CardDescription>
                  One anchor at a time. No hints. Type the word you placed there.
                  Words recalled correctly {STABILIZE_AT} times stabilize and leave the
                  active palace.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={startRecall} disabled={active.length === 0}>
                  <Brain className="h-4 w-4" />
                  Begin recall
                </Button>
                {active.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Place at least one word to begin recall.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* ===== Setup wizard ===== */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {setupStep === 1 && "How will your palace be structured?"}
              {setupStep === 2 && "Name your anchors"}
              {setupStep === 3 && "Confirm"}
            </DialogTitle>
            <DialogDescription>
              {setupStep === 1 &&
                "Pick a style. This shapes how Lexi guides imagination later."}
              {setupStep === 2 &&
                "Name 5–7 things you can recall instantly, without effort."}
              {setupStep === 3 && "Your anchors are fixed once created. Ready?"}
            </DialogDescription>
          </DialogHeader>

          {setupStep === 1 && (
            <RadioGroup
              value={chosenStyle}
              onValueChange={setChosenStyle}
              className="space-y-2"
            >
              {STYLE_OPTIONS.map((opt) => (
                <Label
                  key={opt.id}
                  htmlFor={`style-${opt.id}`}
                  className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-accent/40 transition-colors"
                >
                  <RadioGroupItem value={opt.id} id={`style-${opt.id}`} className="mt-0.5" />
                  <div>
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.hint}</div>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          )}

          {setupStep === 2 && (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {draftAnchors.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono w-5">
                    {i + 1}
                  </span>
                  <Input
                    value={v}
                    onChange={(e) => updateDraftAnchor(i, e.target.value)}
                    placeholder="e.g. Morning coffee"
                    maxLength={60}
                  />
                  {draftAnchors.length > 5 && (
                    <button
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeDraftSlot(i)}
                      aria-label="Remove anchor"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {draftAnchors.length < 7 && (
                <Button variant="ghost" size="sm" onClick={addDraftSlot} className="mt-1">
                  <Plus className="h-3.5 w-3.5" />
                  Add another
                </Button>
              )}
            </div>
          )}

          {setupStep === 3 && (
            <ul className="space-y-1 text-sm">
              {draftAnchors
                .map((a) => a.trim())
                .filter(Boolean)
                .map((a, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {a}
                  </li>
                ))}
            </ul>
          )}

          <DialogFooter>
            {setupStep > 1 && (
              <Button
                variant="ghost"
                onClick={() => setSetupStep((s) => (s - 1) as 1 | 2 | 3)}
              >
                Back
              </Button>
            )}
            {setupStep < 3 ? (
              <Button
                onClick={() => {
                  if (setupStep === 2) {
                    const cleaned = draftAnchors.map((a) => a.trim()).filter(Boolean);
                    if (cleaned.length < 5) {
                      toast.error("Name at least 5 anchors");
                      return;
                    }
                  }
                  setSetupStep((s) => (s + 1) as 1 | 2 | 3);
                }}
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={saveSetup} disabled={savingSetup}>
                {savingSetup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Create palace
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Encode dialog ===== */}
      <Dialog open={encodeOpen} onOpenChange={setEncodeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Place a word</DialogTitle>
            <DialogDescription>
              Pick a word, attach it to an anchor, and let Lexi craft a short scene.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Word</Label>
              <Select value={encodeWordId} onValueChange={setEncodeWordId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a word" />
                </SelectTrigger>
                <SelectContent>
                  {unplaced.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.word}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Anchor</Label>
              <Select value={encodeAnchorId} onValueChange={setEncodeAnchorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an anchor" />
                </SelectTrigger>
                <SelectContent>
                  {anchors.map((a) => (
                    <SelectItem
                      key={a.id}
                      value={a.id}
                      disabled={a.active_word_count >= 2}
                    >
                      {a.name} ({a.active_word_count}/2)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={generateImagery}
              disabled={!encodeWordId || !encodeAnchorId || encodeLoading}
              variant="secondary"
              className="w-full"
            >
              {encodeLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {encodeImagery ? "Regenerate scene" : "Generate scene with Lexi"}
            </Button>

            {encodeImagery && (
              <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                {encodeImagery}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEncodeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePlacement} disabled={!encodeImagery || encodeSaving}>
              {encodeSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Place in palace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Recall dialog ===== */}
      <Dialog open={recallOpen} onOpenChange={setRecallOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recall</DialogTitle>
            <DialogDescription>
              {current
                ? `Anchor ${recallIndex + 1} of ${recallQueue.length}`
                : "Done"}
            </DialogDescription>
          </DialogHeader>

          {current && (
            <div className="space-y-4">
              <div className="rounded-md border border-border bg-muted/30 p-4 text-center">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Anchor
                </div>
                <div className="font-display text-xl mt-1">{current.anchor_name}</div>
                <p className="text-xs text-muted-foreground mt-2">
                  Pause. Recall the word you placed here.
                </p>
              </div>

              {!recallChecked ? (
                <>
                  <Input
                    autoFocus
                    value={recallGuess}
                    onChange={(e) => setRecallGuess(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") checkRecall();
                    }}
                    placeholder="Type the word…"
                  />
                  <Button onClick={checkRecall} className="w-full" disabled={!recallGuess.trim()}>
                    Check
                  </Button>
                </>
              ) : (
                <div className="space-y-3">
                  {recallCorrect ? (
                    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                      <div className="flex items-center gap-2 font-medium text-primary">
                        <Check className="h-4 w-4" /> Correct
                      </div>
                      <div className="mt-1 font-display text-lg">{current.word}</div>
                      {current.meaning_english && (
                        <div className="text-xs text-muted-foreground">
                          {current.meaning_english}
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground mt-2 italic whitespace-pre-wrap">
                        {current.imagery_text}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                      <div className="flex items-center gap-2 font-medium text-destructive">
                        <X className="h-4 w-4" /> Not quite
                      </div>
                      <div className="mt-1">
                        The word was{" "}
                        <span className="font-display text-lg">{current.word}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Re-imagine the anchor and the scene before moving on.
                      </p>
                    </div>
                  )}
                  <Button onClick={nextRecall} className="w-full">
                    {recallIndex + 1 >= recallQueue.length ? "Finish" : "Next"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MemoryPalace;
