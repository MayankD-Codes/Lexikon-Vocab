// Lexi — deep explanation for a saved word using Google Gemini 2.5 Flash directly
import { requireUser } from "../_shared/auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT =
  "You are Lexi, an English vocabulary coach. Be warm, accurate, and use markdown. Keep total answer under ~250 words.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireUser(req, corsHeaders);
  if (_auth instanceof Response) return _auth;

  try {
    const { word, context } = await req.json();
    if (typeof word !== "string" || !word.trim()) {
      return new Response(JSON.stringify({ error: "word required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const userMsg = `Give me a deep but concise explanation of the English word **${word}**.
Cover (use markdown headings):
1. Meaning in plain English
2. Etymology / origin (brief)
3. Two natural example sentences
4. Common usage tips, register (formal/informal), or pitfalls
5. 3 close synonyms with subtle differences

${context ? `Saved notes for context:\n${context}` : ""}`;

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`;

    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userMsg }] }],
        generationConfig: { temperature: 0.6 },
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const t = await upstream.text();
      console.error("Gemini error:", upstream.status, t);
      if (upstream.status === 429) {
        return new Response(JSON.stringify({ error: "Lexi is busy. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Lexi failed." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let nl: number;
            while ((nl = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, nl);
              buffer = buffer.slice(nl + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6).trim();
              if (!json) continue;
              try {
                const parsed = JSON.parse(json);
                const text = parsed?.candidates?.[0]?.content?.parts
                  ?.map((p: { text?: string }) => p?.text ?? "")
                  .join("") ?? "";
                if (text) {
                  const out = { choices: [{ delta: { content: text } }] };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(out)}\n\n`));
                }
              } catch { /* ignore */ }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (e) {
          console.error("stream pipe error:", e);
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("lexi-explain-word error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
