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
 * - OAuth (implicit / PKCE)
 *
 * Supabase-js processes the URL hash/query automatically when the client loads,
 * so we just wait for a session and then route the user to the right place.
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
    const code = params.get("code");

    if (errorDesc) {
      toast.error(friendlyAuthError({ message: errorDesc } as unknown as Error));
      navigate("/auth", { replace: true });
      return;
    }

    const finish = async () => {
      // PKCE flow: exchange ?code=... for a session
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) {
          toast.error(friendlyAuthError(error));
          navigate("/auth", { replace: true });
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        // Session not established yet — wait briefly for onAuthStateChange
        setMessage("Verifying…");
        const sub = supabase.auth.onAuthStateChange((event, session) => {
          if (session) {
            sub.data.subscription.unsubscribe();
            routeUser(event, session);
          }
        });
        setTimeout(() => {
          sub.data.subscription.unsubscribe();
          navigate("/auth", { replace: true });
        }, 5000);
        return;
      }
      routeUser("SIGNED_IN", data.session);
    };

    const routeUser = (event: string, _session: unknown) => {
      if (type === "recovery" || event === "PASSWORD_RECOVERY") {
        navigate("/reset-password", { replace: true });
      } else {
        navigate(next, { replace: true });
      }
    };

    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      {message}
    </div>
  );
};

export default AuthCallback;
