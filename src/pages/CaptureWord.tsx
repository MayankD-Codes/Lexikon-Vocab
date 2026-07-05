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

  const reset = () => {
    setPreview(null);
    setWords([]);
    setRawText("");
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
    setScanning(true);
    try {
      const { data, mimeType } = await fileToCompressedBase64(file);
      setPreview(data);
      const { data: res, error } = await supabase.functions.invoke("lexi-scan-word", {
        body: { image: data, mimeType },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);
      const found: string[] = Array.isArray(res?.words) ? res.words : [];
      setWords(found);
      setRawText(typeof res?.raw_text === "string" ? res.raw_text : "");
      if (found.length === 0) toast.info("Lexi didn't spot any vocabulary in that photo.");
      else toast.success(`Found ${found.length} word${found.length === 1 ? "" : "s"}. Tap one to add it.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't scan that image.");
    } finally {
      setScanning(false);
    }
  };

  const pickWord = (w: string) => {
    navigate(`/add?word=${encodeURIComponent(w)}&ask=1`);
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
                  <p className="text-sm font-medium">Tap a word to add it to your dictionary</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {words.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => pickWord(w)}
                      className="group inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors text-sm font-medium"
                    >
                      {w}
                      <ArrowRight className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
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
