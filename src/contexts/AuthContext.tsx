import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Tracks whether we've ever observed a signed-in session in this tab,
  // so we can distinguish an expired session from a first-time visit.
  const hadSessionRef = useRef(false);
  const explicitSignOutRef = useRef(false);

  useEffect(() => {
    const ensureProfile = (userId: string | undefined) => {
      if (!userId) return;
      void supabase.rpc("ensure_my_profile").then(({ error }) => {
        if (error && import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error("[ensure_my_profile]", error);
        }
      });
    };

    // 1) Register listener FIRST so we don't miss the initial event.
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);

      if (sess) {
        hadSessionRef.current = true;
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
          ensureProfile(sess.user.id);
        }
      } else if (event === "SIGNED_OUT" && hadSessionRef.current) {
        // Distinguish user-initiated sign-out from token expiry / revocation.
        if (!explicitSignOutRef.current) {
          toast.message("Your session has expired. Please sign in again.");
        }
        explicitSignOutRef.current = false;
        hadSessionRef.current = false;
      }
    });

    // 2) Restore any persisted session (localStorage) synchronously-ish.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session) {
        hadSessionRef.current = true;
        ensureProfile(data.session.user.id);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    explicitSignOutRef.current = true;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
