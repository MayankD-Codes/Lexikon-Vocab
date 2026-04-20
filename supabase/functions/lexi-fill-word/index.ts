// Lexi — auto-fill word details using structured tool calling
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { word } = await req.json();
    if (typeof word !== "string" || !word.trim() || word.length > 100) {
      return new Response(JSON.stringify({ error: "Provide a valid word (1-100 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = {
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "You are Lexi, an English vocabulary expert. Fill the dictionary entry for the given word. Be accurate and concise. Use the most common modern meaning. For Hindi meaning, give a short natural translation in Devanagari (or transliteration if untranslatable).",
        },
        { role: "user", content: `Word: ${word.trim()}` },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "fill_word_entry",
            description: "Fill a dictionary entry for an English word.",
            parameters: {
              type: "object",
              properties: {
                pronunciation: { type: "string", description: "IPA pronunciation in slashes, e.g. /ɪˈfem.ər.əl/" },
                spelling: { type: "string", description: "Hyphen-syllable spelling, e.g. e-phem-er-al" },
                meaning_english: { type: "string", description: "One short English definition." },
                meaning_hindi: { type: "string", description: "Short Hindi meaning in Devanagari." },
                part_of_speech: {
                  type: "string",
                  description: "Comma-separated POS list, e.g. 'adjective' or 'noun, verb'.",
                },
                word_forms: { type: "string", description: "Other forms, e.g. 'noun: ephemerality'" },
                example_sentence: { type: "string", description: "One natural example sentence." },
                synonyms: { type: "string", description: "Comma-separated synonyms, max 5." },
                antonyms: { type: "string", description: "Comma-separated antonyms, max 5." },
              },
              required: ["meaning_english", "example_sentence", "part_of_speech"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "fill_word_entry" } },
    };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Lexi is busy. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Lexi failed to fetch this word." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) {
      return new Response(JSON.stringify({ error: "Lexi returned no data." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const args = JSON.parse(tc.function.arguments || "{}");
    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lexi-fill-word error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
