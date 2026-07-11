// Shared SSE stream helpers for Lexi edge functions.
import { supabase } from "@/integrations/supabase/client";

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const PUB_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export type LexiMsg = { role: "user" | "assistant"; content: string };

interface StreamOpts {
  onDelta: (chunk: string) => void;
  onDone: () => void;
  signal?: AbortSignal;
}

async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? PUB_KEY;
}

function friendlyStatusMessage(status: number, fallback: string): string {
  if (status === 401) return "Please sign in again to chat with Lexi.";
  if (status === 429) return "Lexi is getting a lot of questions right now. Try again in a moment.";
  if (status === 402) return "Lexi's AI credits are exhausted. Please try again later.";
  if (status >= 500) return "Lexi hit a server hiccup. Please try again.";
  return fallback;
}

async function streamSSE(url: string, body: unknown, opts: StreamOpts) {
  const token = await getAuthToken();
  if (!token) throw new Error("Please sign in to chat with Lexi.");

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: PUB_KEY,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!resp.ok || !resp.body) {
    let msg = friendlyStatusMessage(resp.status, "Lexi had trouble responding.");
    try {
      const data = await resp.json();
      if (data?.error && typeof data.error === "string" && data.error !== "Unauthorized") {
        msg = data.error;
      }
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;

  while (!done) {
    const { done: d, value } = await reader.read();
    if (d) break;
    buffer += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") {
        done = true;
        break;
      }
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) opts.onDelta(content);
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  if (buffer.trim()) {
    for (let raw of buffer.split("\n")) {
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (!raw.startsWith("data: ")) continue;
      const json = raw.slice(6).trim();
      if (json === "[DONE]") continue;
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) opts.onDelta(content);
      } catch { /* ignore */ }
    }
  }

  opts.onDone();
}

export const lexiChatStream = (messages: LexiMsg[], opts: StreamOpts) =>
  streamSSE(`${BASE}/lexi-chat`, { messages }, opts);

export const lexiExplainStream = (
  word: string,
  context: string | undefined,
  opts: StreamOpts,
) => streamSSE(`${BASE}/lexi-explain-word`, { word, context }, opts);
