// Shared JWT verification helper for AI edge functions.
// Returns the authenticated user id, or a Response to short-circuit with 401.
import { createClient } from "npm:@supabase/supabase-js@2";

export async function requireUser(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const token = authHeader.slice("Bearer ".length);
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return { userId: data.claims.sub as string };
}
