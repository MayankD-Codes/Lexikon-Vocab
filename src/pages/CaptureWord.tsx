import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Upload, Loader2, ArrowLeft, Sparkles, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SEO from "@/components/SEO";

const MAX_DIM = 1600;
const JPEG_QUALITY = 0.85;

// Downscale big camera photos before sending to the edge function.
async function fileToCompressedBase64(file: File): Promise<{ data: string; mimeType: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Could not read image"));
    i.src = dataUrl;
  });

  let { width, height } = img;
  const scale = Math.min(1, MAX_DIM / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { data: dataUrl, mimeType: file.type || "image/jpeg" };
  ctx.drawImage(img, 0, 0, width, height);
  const out = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return { data: out, mimeType: "image/jpeg" };
}

const CaptureWord = () => {
  const navigate = useNavigate();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [words, setWords] = useState<string[]>([]);
  const [rawText, setRawText] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addingBulk, setAddingBulk] = useState(false);

  const reset = () => {
    setPreview(null);
    setWords([]);
    setRawText("");
    setSelected(new Set());
    if (cameraRef.current) cameraRef.current.value = "";
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file.");
      return;
    }
    setWords([]);
    setRawText("");
    setSelected(new Set());
    setScanning(true);
    try {
      const { data, mimeType } = await fileToCompressedBase64(file);
      setPreview(data);
      const { data: res, error } = await invokeFunction<{ words?: string[]; raw_text?: string }>(
        "lexi-scan-word",
        { image: data, mimeType },
      );
      if (error) throw new Error(error);
      const found: string[] = Array.isArray(res?.words) ? res!.words! : [];
      setWords(found);
      setRawText(typeof res?.raw_text === "string" ? res.raw_text : "");
      if (found.length === 0) toast.info("Lexi didn't spot any vocabulary in that photo.");
      else toast.success(`Found ${found.length} word${found.length === 1 ? "" : "s"}. Select the ones you want to add.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't scan that image.");
    } finally {
      setScanning(false);
    }
  };


  const toggleWord = (w: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(w)) next.delete(w);
      else next.add(w);
      return next;
    });
  };

  const addSingle = (w: string) => {
    navigate(`/add?word=${encodeURIComponent(w)}&ask=1`);
  };

  const addSelected = async () => {
    const list = Array.from(selected);
    if (list.length === 0) return;
    if (list.length === 1) {
      addSingle(list[0]);
      return;
    }
    setAddingBulk(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in first.");
        return;
      }
      const rows = await Promise.all(
        list.map(async (w) => {
          try {
            const { data } = await supabase.functions.invoke("lexi-fill-word", { body: { word: w } });
            const d = (data ?? {}) as Record<string, unknown>;
            return {
              user_id: user.id,
              word: w,
              pronunciation: (d.pronunciation as string) ?? null,
              meaning_english: (d.meaning_english as string) ?? null,
              meaning_hindi: (d.meaning_hindi as string) ?? null,
              part_of_speech: (d.part_of_speech as string) ?? null,
              example_sentence: (d.example_sentence as string) ?? null,
              synonyms: (d.synonyms as string) ?? null,
              antonyms: (d.antonyms as string) ?? null,
            };
          } catch {
            return { user_id: user.id, word: w };
          }
        }),
      );
      const { error } = await supabase.from("words").insert(rows as never);
      if (error) throw error;
      toast.success(`Added ${rows.length} words to your dictionary`);
      navigate("/dictionary");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add words.");
    } finally {
      setAddingBulk(false);
    }
  };


  return (
    <main className="container py-6 sm:py-10 max-w-2xl">
      <SEO
        title="Capture a Word — Lexikon"
        description="Snap a photo of any text and Lexikon will pull vocabulary words you can add to your dictionary in one tap."
        noindex
      />
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">
          Capture a word
        </h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">
          See a new word somewhere? Snap it — Lexi will pull the vocabulary out for you.
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border/60 shadow-card p-4 sm:p-6 space-y-5">
        {!preview && (
          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              className="h-14 text-base"
              onClick={() => cameraRef.current?.click()}
              disabled={scanning}
            >
              <Camera className="h-5 w-5" /> Open camera
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 text-base"
              onClick={() => fileRef.current?.click()}
              disabled={scanning}
            >
              <Upload className="h-5 w-5" /> Upload a photo
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Point at a book, sign, screen or note. Text should be clear and roughly upright.
            </p>
          </div>
        )}

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />

        {preview && (
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden border border-border/60 bg-muted">
              <img src={preview} alt="Captured text" className="w-full max-h-80 object-contain" />
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute top-2 right-2 h-8 w-8 rounded-full shadow"
                onClick={reset}
                aria-label="Discard photo"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {scanning && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Lexi is reading your photo…
              </div>
            )}

            {!scanning && words.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">
                    Tap words to select multiple, then add them at once.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {words.map((w) => {
                    const isSelected = selected.has(w);
                    return (
                      <button
                        key={w}
                        type="button"
                        onClick={() => toggleWord(w)}
                        aria-pressed={isSelected}
                        className={
                          "group inline-flex items-center gap-1 px-3 py-1.5 rounded-full border transition-colors text-sm font-medium " +
                          (isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:bg-primary/10 hover:border-primary")
                        }
                      >
                        {w}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    onClick={addSelected}
                    disabled={selected.size === 0 || addingBulk}
                    className="flex-1 min-w-[10rem]"
                  >
                    {addingBulk ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Adding…</>
                    ) : selected.size <= 1 ? (
                      <>Add {selected.size === 1 ? "1 word" : "selected"} <ArrowRight className="h-4 w-4" /></>
                    ) : (
                      <>Add {selected.size} words <ArrowRight className="h-4 w-4" /></>
                    )}
                  </Button>
                  {selected.size > 0 && (
                    <Button variant="ghost" onClick={() => setSelected(new Set())} disabled={addingBulk}>
                      Clear
                    </Button>
                  )}
                </div>
                {rawText && (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer hover:text-foreground">Show raw text Lexi read</summary>
                    <pre className="mt-2 whitespace-pre-wrap bg-muted rounded-md p-3 max-h-40 overflow-auto">{rawText}</pre>
                  </details>
                )}
              </div>
            )}

            {!scanning && words.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-2">
                No vocabulary detected. Try a clearer, better-lit photo.
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={reset} disabled={scanning}>
                Try another photo
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default CaptureWord;
