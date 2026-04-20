// Shared SSE stream helpers for Lexi edge functions.
const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export type LexiMsg = { role: "user" | "assistant"; content: string };

interface StreamOpts {
  onDelta: (chunk: string) => void;
  onDone: () => void;
  signal?: AbortSignal;
}

async function streamSSE(url: string, body: unknown, opts: StreamOpts) {
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!resp.ok || !resp.body) {
    let msg = "Lexi had trouble responding.";
    try {
      const data = await resp.json();
      if (data?.error) msg = data.error;
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
