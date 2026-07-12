// Shared Gemini helper with multi-key failover.
// Tries GEMINI_API_KEY, then GEMINI_API_KEY_2..5 on quota/rate-limit errors.

const KEY_NAMES = [
  "GEMINI_API_KEY",
  "GEMINI_API_KEY_2",
  "GEMINI_API_KEY_3",
  "GEMINI_API_KEY_4",
  "GEMINI_API_KEY_5",
];

function getKeys(): string[] {
  const keys: string[] = [];
  for (const name of KEY_NAMES) {
    const v = Deno.env.get(name);
    if (v && v.trim()) keys.push(v.trim());
  }
  return keys;
}

function isQuotaStatus(status: number): boolean {
  return status === 429 || status === 403;
}

function isQuotaBody(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return (
    t.includes("resource_exhausted") ||
    t.includes("quota exceeded") ||
    t.includes("quota_exceeded") ||
    t.includes("rate limit") ||
    t.includes("exceeded your current quota")
  );
}

export class GeminiError extends Error {
  status: number;
  friendly: string;
  constructor(status: number, friendly: string, message?: string) {
    super(message ?? friendly);
    this.status = status;
    this.friendly = friendly;
  }
}

interface CallOpts {
  model: string;
  // "generateContent" or "streamGenerateContent"
  method: "generateContent" | "streamGenerateContent";
  body: unknown;
  stream?: boolean;
}

/**
 * Call Gemini with automatic failover across all configured API keys.
 * On quota/rate-limit errors, transparently retries with the next key.
 * Returns the successful Response. Throws GeminiError on final failure.
 */
export async function callGemini(opts: CallOpts): Promise<Response> {
  const keys = getKeys();
  if (keys.length === 0) {
    throw new GeminiError(500, "AI service is not configured. Please try again later.", "No GEMINI_API_KEY configured");
  }

  const suffix = opts.stream ? "?alt=sse" : "";
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:${opts.method}${suffix}`;

  let lastStatus = 500;
  let lastBody = "";

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify(opts.body),
    });

    if (resp.ok) {
      if (i > 0) console.log(`Gemini: succeeded with fallback key #${i + 1}`);
      return resp;
    }

    // Peek body to decide failover
    const bodyText = await resp.text();
    lastStatus = resp.status;
    lastBody = bodyText;

    const shouldFailover = isQuotaStatus(resp.status) || isQuotaBody(bodyText);
    console.warn(
      `Gemini key #${i + 1} failed: status=${resp.status} failover=${shouldFailover}`,
    );

    if (!shouldFailover) {
      // Non-quota error — don't try more keys.
      break;
    }
    // else loop to next key
  }

  // Exhausted all keys
  console.error("Gemini all-keys failed:", lastStatus, lastBody.slice(0, 300));
  const friendly = lastStatus === 400
    ? "Lexi couldn't understand that. Please try again."
    : "Lexi is currently busy. Please try again in a moment.";
  throw new GeminiError(lastStatus >= 500 ? 503 : 429, friendly, lastBody);
}

/**
 * Convenience: call generateContent and return parsed JSON.
 */
export async function geminiGenerate(
  model: string,
  body: unknown,
): Promise<Record<string, unknown>> {
  const resp = await callGemini({ model, method: "generateContent", body });
  return await resp.json();
}

/**
 * Extract concatenated text from a Gemini generateContent response.
 */
export function extractText(data: unknown): string {
  const d = data as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  return (
    d?.candidates?.[0]?.content?.parts
      ?.map((p) => p?.text ?? "")
      .join("") ?? ""
  );
}

/**
 * Turn a friendly GeminiError (or any thrown error) into a Response.
 */
export function geminiErrorResponse(
  err: unknown,
  corsHeaders: Record<string, string>,
): Response {
  if (err instanceof GeminiError) {
    return new Response(JSON.stringify({ error: err.friendly }), {
      status: err.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  console.error("Unexpected Gemini error:", err);
  return new Response(
    JSON.stringify({ error: "Something went wrong. Please try again shortly." }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
