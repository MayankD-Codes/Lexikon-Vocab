// Lexi — streaming chat assistant using Gemini with multi-key failover
import { requireUser } from "../_shared/auth.ts";
import { callGemini, geminiErrorResponse } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Lexi, the friendly AI vocabulary coach inside the Lexikon app.
- Help users understand English words: meanings, etymology, usage, nuance, pronunciation tips, examples.
- Keep answers crisp and conversational. Use markdown lists when listing examples or synonyms.
- If asked something unrelated to language/learning, gently steer back to vocabulary help.
- Never invent definitions. If unsure, say so briefly.
- Do not mention you are an AI model name; just say you are Lexi.`;

const MODEL = "gemini-2.5-flash";

type ChatMsg = { role: "user" | "assistant"; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireUser(req, corsHeaders);
  if (auth instanceof Response) return auth;

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contents = (messages as ChatMsg[]).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const upstream = await callGemini({
      model: MODEL,
      method: "streamGenerateContent",
      stream: true,
      body: {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { temperature: 0.7 },
      },
    });

    if (!upstream.body) {
      return new Response(
        JSON.stringify({ error: "Lexi is currently busy. Please try again in a moment." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
              } catch { /* ignore partial */ }
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
    return geminiErrorResponse(e, corsHeaders);
  }
});
