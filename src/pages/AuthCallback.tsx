import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { friendlyAuthError } from "@/lib/friendlyError";

/**
 * Handles the redirect from Supabase auth emails:
 * - Email verification (signup)
 * - Password recovery
 * - Magic link
 * - OAuth (PKCE)
 *
 * PKCE exchange is handled automatically by the Supabase client
 * (`detectSessionInUrl` in client.ts). Do not call exchangeCodeForSession
 * here — a second exchange fails with "PKCE code verifier not found".
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [message, setMessage] = useState("Finishing sign in…");

  useEffect(() => {
    const next = params.get("next") || "/dashboard";
    const errorDesc = params.get("error_description") || params.get("error");
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const type = params.get("type") || hash.get("type");

    const routeUser = (event: string) => {
      if (type === "recovery" || event === "PASSWORD_RECOVERY") {
        navigate("/reset-password", { replace: true });
      } else {
        navigate(next, { replace: true });
      }
    };

    if (errorDesc) {
      toast.error(friendlyAuthError({ message: errorDesc } as unknown as Error));
      navigate("/auth", { replace: true });
      return;
    }

    let sub: ReturnType<typeof supabase.auth.onAuthStateChange> | null = null;
    let timeout: ReturnType<typeof window.setTimeout> | undefined;

    const finish = async () => {
      // Waits for client init, which includes PKCE code exchange when ?code= is present.
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        toast.error(friendlyAuthError(error));
        navigate("/auth", { replace: true });
        return;
      }

      if (data.session) {
        routeUser("SIGNED_IN");
        return;
      }

      // Session not ready yet — wait briefly for onAuthStateChange.
      setMessage("Verifying…");
      sub = supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
          sub?.data.subscription.unsubscribe();
          sub = null;
          if (timeout !== undefined) window.clearTimeout(timeout);
          routeUser(event);
        }
      });
      timeout = window.setTimeout(() => {
        sub?.data.subscription.unsubscribe();
        sub = null;
        toast.error("Sign-in could not be completed. Please try again.");
        navigate("/auth", { replace: true });
      }, 5000);
    };

    finish();

    return () => {
      sub?.data.subscription.unsubscribe();
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      {message}
    </div>
  );
};

export default AuthCallback;
