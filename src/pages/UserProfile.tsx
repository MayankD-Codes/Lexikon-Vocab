import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, BookOpen } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import { validateUsername } from "@/lib/username";

type PublicProfile = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

const UserProfile = () => {
  const { username = "" } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const v = validateUsername(username);
      if (!v.ok) {
        if (!cancelled) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase.rpc("get_profile_by_username", {
        _username: v.normalized,
      });
      if (cancelled) return;
      const row = Array.isArray(data) && data.length > 0 ? (data[0] as PublicProfile) : null;
      setProfile(row);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-paper flex flex-col items-center justify-center px-6 text-center">
        <SEO title={`@${username} — not found`} description="This Lexikon profile could not be found." noindex />
        <h1 className="font-display text-3xl font-semibold tracking-tight">Profile not found</h1>
        <p className="text-muted-foreground mt-2">
          There is no user with the username <span className="font-mono">@{username}</span>.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    );
  }

  const label = profile.display_name || `@${profile.username}`;
  const initials = (profile.display_name || profile.username || "?").trim().slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-paper">
      <SEO
        title={`@${profile.username} — Lexikon`}
        description={`${label}'s Lexikon profile.`}
      />
      <header className="container py-6">
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-warm flex items-center justify-center shadow-soft">
            <BookOpen className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-semibold tracking-tight">Lexikon</span>
        </Link>
      </header>

      <main className="container max-w-2xl pb-16">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-5">
              <Avatar className="h-20 w-20">
                {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={label} />}
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="font-display text-2xl font-semibold tracking-tight">
                  {profile.display_name || profile.username}
                </h1>
                <p className="text-sm text-muted-foreground font-mono">@{profile.username}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default UserProfile;
