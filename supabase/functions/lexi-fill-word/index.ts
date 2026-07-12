// Lexi — auto-fill word details using Gemini with multi-key failover + structured JSON
import { requireUser } from "../_shared/auth.ts";
import { callGemini, extractText, geminiErrorResponse } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT =
  "You are Lexi, an English vocabulary expert. Fill the dictionary entry for the given word. Be accurate and concise. Use the most common modern meaning. For Hindi meaning, give a short natural translation in Devanagari (or transliteration if untranslatable).";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireUser(req, corsHeaders);
  if (_auth instanceof Response) return _auth;

  try {
    const { word } = await req.json();
    if (typeof word !== "string" || !word.trim() || word.length > 100) {
      return new Response(JSON.stringify({ error: "Provide a valid word (1-100 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const responseSchema = {
      type: "OBJECT",
      properties: {
        pronunciation: { type: "STRING", description: "IPA pronunciation in slashes, e.g. /ɪˈfem.ər.əl/" },
        spelling: { type: "STRING", description: "Hyphen-syllable spelling, e.g. e-phem-er-al" },
        meaning_english: { type: "STRING", description: "One short English definition." },
        meaning_hindi: { type: "STRING", description: "Short Hindi meaning in Devanagari." },
        part_of_speech: {
          type: "STRING",
          description: "Comma-separated POS list, e.g. 'adjective' or 'noun, verb'.",
        },
        word_forms: { type: "STRING", description: "Other forms, e.g. 'noun: ephemerality'" },
        example_sentence: { type: "STRING", description: "One natural example sentence." },
        synonyms: { type: "STRING", description: "Comma-separated synonyms, max 5." },
        antonyms: { type: "STRING", description: "Comma-separated antonyms, max 5." },
      },
      required: ["meaning_english", "example_sentence", "part_of_speech"],
    };

    const response = await callGemini({
      model: MODEL,
      method: "generateContent",
      body: {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: `Word: ${word.trim()}` }] }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
          responseSchema,
        },
      },
    });

    const data = await response.json();
    const text = extractText(data);

    if (!text) {
      console.error("Empty Gemini response:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "Lexi couldn't find details for that word. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let args: Record<string, unknown>;
    try {
      args = JSON.parse(text);
    } catch (e) {
      console.error("JSON parse error:", e, "raw:", text);
      return new Response(
        JSON.stringify({ error: "Lexi returned an unexpected response. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return geminiErrorResponse(e, corsHeaders);
  }
});
