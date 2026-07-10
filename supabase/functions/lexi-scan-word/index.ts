// Lexi — extract English words from a photo using Gemini 2.5 Flash vision
import { requireUser } from "../_shared/auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT =
  "You are Lexi, a vocabulary assistant. The user photographed some text (a book page, sign, screen, note). Extract UNIQUE, meaningful English vocabulary words a learner might want to save — prefer nouns, verbs, adjectives, adverbs. Skip trivial stopwords (the, a, is, of, and, etc.), numbers, names, and gibberish. Return each word in its base/dictionary form when obvious. Max 20 words. Also return the full raw text you can read.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireUser(req, corsHeaders);
  if (_auth instanceof Response) return _auth;

  try {
    const { image, mimeType } = await req.json();
    if (typeof image !== "string" || image.length < 50) {
      return new Response(JSON.stringify({ error: "Provide a valid image" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Strip data URL prefix if present
    const base64 = image.includes(",") ? image.split(",")[1] : image;
    const mt = typeof mimeType === "string" && mimeType ? mimeType : "image/jpeg";

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

    const responseSchema = {
      type: "OBJECT",
      properties: {
        words: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Unique vocabulary words extracted from the image, lowercase base form.",
        },
        raw_text: { type: "STRING", description: "The full text read from the image." },
      },
      required: ["words"],
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{
          role: "user",
          parts: [
            { text: "Extract vocabulary words from this image." },
            { inlineData: { mimeType: mt, data: base64 } },
          ],
        }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Gemini error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Lexi is busy. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Lexi couldn't read this image." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p?.text ?? "")
      .join("") ?? "";

    if (!text) {
      return new Response(JSON.stringify({ error: "Lexi found no text in this image." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let args: { words?: string[]; raw_text?: string };
    try {
      args = JSON.parse(text);
    } catch (e) {
      console.error("JSON parse error:", e, "raw:", text);
      return new Response(JSON.stringify({ error: "Lexi returned malformed data." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dedupe + clean
    const seen = new Set<string>();
    const words = (args.words ?? [])
      .map((w) => (typeof w === "string" ? w.trim().toLowerCase() : ""))
      .filter((w) => w && /^[a-z][a-z'-]{1,40}$/i.test(w))
      .filter((w) => (seen.has(w) ? false : (seen.add(w), true)))
      .slice(0, 20);

    return new Response(JSON.stringify({ words, raw_text: args.raw_text ?? "" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lexi-scan-word error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
