// Generate short text-only memory-palace imagery for a word at a user's anchor
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Lexi, a memory coach using the Method of Loci (memory palace).
Given a user's personal anchor (a place or moment they recall instantly) and an English word,
write a SHORT mental scene of EXACTLY 2 to 4 sentences (max ~55 words total) that fuses the
anchor with the meaning of the word. Use vivid sensory or emotional language.
Begin with "Picture..." or "Imagine...". End by naming the word in italics like *word*.

STRICT RULES — never break:
- Output plain text only. No markdown headings, no bullet lists, no numbering.
- No image links, no URLs, no image markdown like ![...](...).
- No preamble ("Sure!", "Here is..."), no quiz, no definition section, no labels.
- No more than 4 sentences. No paragraph breaks.`;

// Post-process model output to enforce text-only, 2–4 short sentences.
function sanitizeImagery(raw: string): string {
  let text = (raw ?? "").toString();

  // Strip code fences and markdown images / links / headings / list markers.
  text = text.replace(/```[\s\S]*?```/g, " ");
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, " "); // ![alt](url)
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"); // [text](url) -> text
  text = text.replace(/https?:\/\/\S+/gi, " "); // bare URLs
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, ""); // headings
  text = text.replace(/^\s*([-*+]|\d+[.)])\s+/gm, ""); // list markers

  // Drop common preamble lines.
  text = text.replace(/^(sure!?|here(?:'s| is)|okay,?|ok,?)\b[^.\n]*[.\n]/i, "");

  // Collapse whitespace and newlines.
  text = text.replace(/\s+/g, " ").trim();

  if (!text) return "";

  // Split into sentences (keep terminators).
  const parts = text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? [text];
  const sentences = parts
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    // Drop overly long single sentences (>40 words) — model went off-script.
    .map((s) => {
      const words = s.split(/\s+/);
      if (words.length > 40) return words.slice(0, 40).join(" ").replace(/[,;:\s]+$/, "") + ".";
      return s;
    });

  // Keep first 4 sentences, ensure at least 2 if available.
  const kept = sentences.slice(0, 4);
  let result = kept.join(" ").trim();

  // Hard cap: ~60 words total.
  const allWords = result.split(/\s+/);
  if (allWords.length > 60) {
    result = allWords.slice(0, 60).join(" ").replace(/[,;:\s]+$/, "") + ".";
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { word, meaning, anchor, anchorStyle } = await req.json();
    if (typeof word !== "string" || !word.trim()) {
      return new Response(JSON.stringify({ error: "word required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof anchor !== "string" || !anchor.trim()) {
      return new Response(JSON.stringify({ error: "anchor required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userMsg = `Anchor: "${anchor.trim()}"${anchorStyle ? ` (style: ${anchorStyle})` : ""}
Word: "${word.trim()}"${meaning ? `\nMeaning: ${meaning}` : ""}

Write the short mental scene now. 2 to 4 sentences. Plain text only.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Lexi is busy. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "Lexi failed." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const rawImagery = (data?.choices?.[0]?.message?.content ?? "").toString();
    const imagery = sanitizeImagery(rawImagery);

    if (!imagery) {
      return new Response(JSON.stringify({ error: "Empty response from Lexi" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ imagery }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("memory-palace-guide error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
