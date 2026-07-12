// Wrap supabase.functions.invoke to extract friendly error messages
// from the JSON body instead of showing the raw "Edge Function returned a non-2xx status code".
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

export interface InvokeResult<T> {
  data: T | null;
  error: string | null;
}

const FRIENDLY_FALLBACK = "Lexi is currently busy. Please try again in a moment.";

export async function invokeFunction<T = unknown>(
  name: string,
  body?: unknown,
): Promise<InvokeResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke(name, {
      body: body as Record<string, unknown> | undefined,
    });

    if (error) {
      // Extract friendly message from the JSON body when possible
      let friendly = FRIENDLY_FALLBACK;
      if (error instanceof FunctionsHttpError) {
        try {
          const body = await error.context.json();
          if (body?.error && typeof body.error === "string") {
            friendly = body.error;
          }
        } catch {
          // couldn't parse — keep fallback
        }
      } else if (error.message && !/non-2xx status/i.test(error.message)) {
        friendly = error.message;
      }
      return { data: null, error: friendly };
    }

    return { data: (data as T) ?? null, error: null };
  } catch (e) {
    console.error(`invokeFunction(${name}) threw:`, e);
    return { data: null, error: FRIENDLY_FALLBACK };
  }
}
