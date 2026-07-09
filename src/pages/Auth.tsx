import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { BookOpen, User as UserIcon, Lock, ArrowRight, Eye, EyeOff, Check, X, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { friendlyAuthError } from "@/lib/friendlyError";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import PasswordStrength, { passesAllChecks } from "@/components/PasswordStrength";
import { normalizeUsername, validateUsername, usernameToEmail, USERNAME_MAX } from "@/lib/username";

type Availability =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "invalid"; message: string }
  | { state: "available" }
  | { state: "taken" };

const Auth = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? "/dashboard";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [availability, setAvailability] = useState<Availability>({ state: "idle" });
  const [passwordRejected, setPasswordRejected] = useState(false);
  const checkSeq = useRef(0);

  // Real-time username availability (signup only)
  useEffect(() => {
    if (mode !== "signup") {
      setAvailability({ state: "idle" });
      return;
    }
    const raw = username;
    if (raw.trim().length === 0) {
      setAvailability({ state: "idle" });
      return;
    }
    const v = validateUsername(raw);
    if (!v.ok) {
      setAvailability({ state: "invalid", message: v.reason });
      return;
    }
    setAvailability({ state: "checking" });
    const seq = ++checkSeq.current;
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("is_username_available", {
        _username: v.normalized,
      });
      if (seq !== checkSeq.current) return;
      if (error) {
        setAvailability({ state: "invalid", message: "Couldn't check availability." });
        return;
      }
      setAvailability({ state: data ? "available" : "taken" });
    }, 300);
    return () => clearTimeout(t);
  }, [username, mode]);

  if (!loading && user) return <Navigate to={from} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateUsername(username);
    if (!v.ok) {
      toast.error(v.reason);
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    const email = usernameToEmail(v.normalized);

    if (mode === "signup") {
      if (availability.state === "taken") {
        setBusy(false);
        toast.error("Username already taken.");
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: v.normalized } },
      });
      if (error) {
        if (/duplicate|already/i.test(error.message)) {
          toast.error("Username already taken.");
        } else {
          toast.error(friendlyAuthError(error));
        }
      } else {
        toast.success("Welcome to Lexikon!");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(friendlyAuthError(error));
      else toast.success("Signed in");
    }
    setBusy(false);
  };

  const renderAvailability = () => {
    if (mode !== "signup" || username.trim().length === 0) return null;
    switch (availability.state) {
      case "checking":
        return (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Checking availability…
          </p>
        );
      case "invalid":
        return (
          <p className="text-xs text-destructive mt-1 flex items-center gap-1">
            <X className="h-3 w-3" /> {availability.message}
          </p>
        );
      case "taken":
        return (
          <p className="text-xs text-destructive mt-1 flex items-center gap-1">
            <X className="h-3 w-3" /> Username already taken.
          </p>
        );
      case "available":
        return (
          <p className="text-xs text-green-600 dark:text-green-500 mt-1 flex items-center gap-1">
            <Check className="h-3 w-3" /> Username available.
          </p>
        );
      default:
        return null;
    }
  };

  const canSubmit =
    !busy &&
    username.trim().length > 0 &&
    password.length >= 8 &&
    (mode === "signin" || availability.state === "available");

  return (
    <div className="min-h-screen bg-gradient-paper flex flex-col">
      <SEO
        title={mode === "signin" ? "Sign in — Lexikon" : "Create your account — Lexikon"}
        description="Sign in or create a free Lexikon account with a username to build your personal English vocabulary dictionary."
      />
      <header className="container py-6">
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-warm flex items-center justify-center shadow-soft">
            <BookOpen className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-semibold tracking-tight">Lexikon</span>
        </Link>
      </header>

      <main className="flex-1 container flex items-center justify-center pb-10 sm:pb-16">
        <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-5 sm:p-8 shadow-card">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-center mb-1">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            {mode === "signin" ? "Sign in with your username" : "Pick a username to get started"}
          </p>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
            <TabsList className="grid grid-cols-2 w-full mb-5">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value={mode} className="mt-0 space-y-4">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="username"
                      type="text"
                      inputMode="text"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="username"
                      placeholder="your.username"
                      className="pl-9 lowercase"
                      value={username}
                      onChange={(e) => setUsername(normalizeUsername(e.target.value).slice(0, USERNAME_MAX))}
                      maxLength={USERNAME_MAX}
                      required
                    />
                  </div>
                  {renderAvailability()}
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      placeholder="At least 6 characters"
                      className="pl-9 pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {mode === "signup" && <PasswordStrength password={password} />}
                </div>
                <Button type="submit" className="w-full h-11" disabled={!canSubmit}>
                  {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="text-xs text-center text-muted-foreground mt-6">
            By continuing, you agree to use Lexikon for personal vocabulary learning.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Auth;
