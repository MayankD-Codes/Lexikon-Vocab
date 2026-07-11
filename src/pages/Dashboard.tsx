import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Brain,
  Flame,
  Plus,
  TrendingUp,
  Target,
  Trophy,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Library,
  User,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Word } from "@/lib/types";
import { todayISO } from "@/lib/quiz";
import SEO from "@/components/SEO";

interface QuizSession {
  quiz_date: string;
  score: number;
  total_questions: number;
  duration_seconds: number | null;
  completed: boolean;
}

interface WordStat {
  word_id: string;
  correct_count: number;
  incorrect_count: number;
  last_tested_at: string | null;
}

const POS_PARTS = ["Noun", "Verb", "Adjective", "Adverb", "Pronoun", "Preposition", "Conjunction", "Interjection"] as const;

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
}

const startOfDayUTC = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const computeStreak = (sessions: QuizSession[]): number => {
  const completedDates = new Set(sessions.filter((s) => s.completed).map((s) => s.quiz_date));
  if (completedDates.size === 0) return 0;
  let streak = 0;
  const cursor = startOfDayUTC(new Date());
  // If today not done, start counting from yesterday so missing today doesn't break a streak yet
  const todayStr = todayISO();
  if (!completedDates.has(todayStr)) cursor.setDate(cursor.getDate() - 1);
  while (true) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    const iso = `${y}-${m}-${d}`;
    if (completedDates.has(iso)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
};

const Dashboard = () => {
  const { user } = useAuth();
  const [words, setWords] = useState<Word[]>([]);
  const [stats, setStats] = useState<WordStat[]>([]);
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
    void loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", user.id)
      .single();
    if (data) setProfile(data as Profile);
  };

  const load = async () => {
    setLoading(true);
    const [w, s, q] = await Promise.all([
      supabase.from("words").select("*").order("created_at", { ascending: false }),
      supabase.from("word_stats").select("word_id, correct_count, incorrect_count, last_tested_at"),
      supabase
        .from("quiz_sessions")
        .select("quiz_date, score, total_questions, duration_seconds, completed")
        .order("quiz_date", { ascending: false })
        .limit(60),
    ]);
    setWords((w.data ?? []) as Word[]);
    setStats((s.data ?? []) as WordStat[]);
    setSessions((q.data ?? []) as QuizSession[]);
    setLoading(false);
  };

  const totalWords = words.length;

  const addedThisWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return words.filter((w) => new Date(w.created_at).getTime() >= cutoff).length;
  }, [words]);

  const recentWords = useMemo(() => words.slice(0, 5), [words]);

  const statsByWord = useMemo(() => new Map(stats.map((s) => [s.word_id, s])), [stats]);

  const masteryBuckets = useMemo(() => {
    let weak = 0,
      learning = 0,
      strong = 0;
    for (const w of words) {
      const st = statsByWord.get(w.id);
      const total = (st?.correct_count ?? 0) + (st?.incorrect_count ?? 0);
      if (!st || total === 0) {
        learning += 1;
        continue;
      }
      const acc = (st.correct_count ?? 0) / total;
      if (acc < 0.5 || (st.incorrect_count ?? 0) >= 2) weak += 1;
      else if (acc >= 0.8 && total >= 3) strong += 1;
      else learning += 1;
    }
    return { weak, learning, strong };
  }, [words, statsByWord]);

  const weakestWords = useMemo(() => {
    return [...words]
      .map((w) => {
        const st = statsByWord.get(w.id);
        const total = (st?.correct_count ?? 0) + (st?.incorrect_count ?? 0);
        const acc = total === 0 ? null : (st!.correct_count ?? 0) / total;
        return { word: w, total, acc, incorrect: st?.incorrect_count ?? 0 };
      })
      .filter((x) => x.total > 0)
      .sort((a, b) => {
        if (a.acc === null) return 1;
        if (b.acc === null) return -1;
        if (a.acc !== b.acc) return a.acc - b.acc;
        return b.incorrect - a.incorrect;
      })
      .slice(0, 5);
  }, [words, statsByWord]);

  const lastSession = useMemo(
    () => sessions.find((s) => s.completed) ?? null,
    [sessions]
  );
  const todayDone = useMemo(
    () => sessions.some((s) => s.quiz_date === todayISO() && s.completed),
    [sessions]
  );
  const streak = useMemo(() => computeStreak(sessions), [sessions]);

  // 30-day accuracy line
  const accuracyChart = useMemo(() => {
    const days: { date: string; label: string; accuracy: number | null }[] = [];
    const map = new Map(sessions.filter((s) => s.completed).map((s) => [s.quiz_date, s]));
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const iso = `${y}-${m}-${day}`;
      const s = map.get(iso);
      const acc = s && s.total_questions > 0 ? Math.round((s.score / s.total_questions) * 100) : null;
      days.push({ date: iso, label: `${d.getDate()}/${d.getMonth() + 1}`, accuracy: acc });
    }
    return days;
  }, [sessions]);

  const hasAnyAccuracy = accuracyChart.some((d) => d.accuracy !== null);

  // Parts of speech distribution
  const posChart = useMemo(() => {
    const counts = Object.fromEntries(POS_PARTS.map((p) => [p, 0])) as Record<string, number>;
    for (const w of words) {
      if (!w.part_of_speech) continue;
      for (const p of POS_PARTS) {
        const re = new RegExp(`\\b${p}\\b`, "i");
        if (re.test(w.part_of_speech)) counts[p] += 1;
      }
    }
    return POS_PARTS.map((p) => ({ name: p.slice(0, 4), full: p, count: counts[p] }));
  }, [words]);

  const posHasAny = posChart.some((p) => p.count > 0);

  if (loading) {
    return <div className="container py-12 text-center text-muted-foreground">Loading dashboard…</div>;
  }

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Learner";
  const avatarUrl = profile?.avatar_url;

  return (
    <div className="container py-6 sm:py-10 space-y-6 max-w-6xl min-w-0 overflow-x-hidden">

      <SEO
        title="Dashboard — Lexikon"
        description="Track your vocabulary progress: total words, quiz streak, accuracy trends, mastery breakdown and weakest words."
        noindex
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Avatar className="h-12 w-12 sm:h-14 sm:w-14 ring-2 ring-primary/20 shrink-0">
            <AvatarImage src={avatarUrl || undefined} alt={displayName} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
              {displayName[0]?.toUpperCase() || <User className="h-6 w-6" />}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight truncate">
              Welcome back, {displayName}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              A quick look at your vocabulary progress.
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button asChild variant="outline">
            <Link to="/add">
              <Plus className="h-4 w-4" /> Add Word
            </Link>
          </Button>
          <Button asChild>
            <Link to="/quiz">
              <Brain className="h-4 w-4" /> {todayDone ? "View Quiz" : "Start Quiz"}
            </Link>
          </Button>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          icon={<BookOpen className="h-4 w-4" />}
          label="Total words"
          value={totalWords}
          accent="primary"
        />
        <StatTile
          icon={<Sparkles className="h-4 w-4" />}
          label="Added this week"
          value={`+${addedThisWeek}`}
          accent="accent"
        />
        <StatTile
          icon={<Flame className="h-4 w-4" />}
          label="Quiz streak"
          value={`${streak} day${streak === 1 ? "" : "s"}`}
          accent="primary"
        />
        <StatTile
          icon={<Trophy className="h-4 w-4" />}
          label="Last quiz"
          value={
            lastSession
              ? `${Math.round((lastSession.score / Math.max(1, lastSession.total_questions)) * 100)}%`
              : "—"
          }
          sub={lastSession ? `${lastSession.score}/${lastSession.total_questions}` : "No quiz yet"}
          accent="accent"
        />
      </div>

      {/* Daily quiz banner */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6 shadow-card flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="h-11 w-11 rounded-xl bg-gradient-warm flex items-center justify-center shadow-soft shrink-0">
          <Brain className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-lg font-semibold">
            {todayDone ? "Today's quiz is done" : "Your daily quiz is ready"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {totalWords < 10
              ? `Add ${10 - totalWords} more word${10 - totalWords === 1 ? "" : "s"} to unlock the quiz.`
              : todayDone
              ? "Great work — come back tomorrow for a fresh round."
              : "7 personalized questions — about 5 minutes."}
          </p>
        </div>
        <Button asChild variant={todayDone ? "outline" : "default"} disabled={totalWords < 10}>
          <Link to="/quiz">
            {todayDone ? "View Results" : "Start Quiz"} <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel
          title="Quiz accuracy — last 30 days"
          icon={<TrendingUp className="h-4 w-4" />}
          empty={!hasAnyAccuracy ? "Complete a quiz to start tracking accuracy." : null}
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={accuracyChart} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => `${v}%`}
                  width={40}
                />
                <ReTooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    color: "hsl(var(--popover-foreground))",
                    fontSize: 12,
                  }}
                  formatter={(v: number | null) => (v === null ? ["—", "Accuracy"] : [`${v}%`, "Accuracy"])}
                />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "hsl(var(--primary))" }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Parts of speech"
          icon={<Library className="h-4 w-4" />}
          empty={!posHasAny ? "Tag words by part of speech to see this chart." : null}
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={posChart} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  width={30}
                />
                <ReTooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    color: "hsl(var(--popover-foreground))",
                    fontSize: 12,
                  }}
                  labelFormatter={(_l, p) => (p?.[0]?.payload as { full?: string })?.full ?? ""}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Mastery + weakest + recent */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="Mastery" icon={<Target className="h-4 w-4" />}>
          <MasteryBar buckets={masteryBuckets} />
          <ul className="mt-4 space-y-2 text-sm">
            <MasteryRow label="Mastered" count={masteryBuckets.strong} dotClass="bg-primary" />
            <MasteryRow label="Learning" count={masteryBuckets.learning} dotClass="bg-accent" />
            <MasteryRow label="Needs work" count={masteryBuckets.weak} dotClass="bg-destructive" />
          </ul>
        </Panel>

        <Panel
          title="Weakest words"
          icon={<AlertTriangle className="h-4 w-4" />}
          empty={weakestWords.length === 0 ? "Take a quiz to identify weak words." : null}
        >
          <ul className="space-y-2.5">
            {weakestWords.map(({ word, acc, total }) => (
              <li key={word.id}>
                <Link
                  to={`/word/${word.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-secondary/60 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{word.word}</div>
                    {word.meaning_english && (
                      <div className="text-xs text-muted-foreground truncate">
                        {word.meaning_english}
                      </div>
                    )}
                  </div>
                  <div className="text-xs font-mono text-destructive shrink-0">
                    {Math.round((acc ?? 0) * 100)}% · {total}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Recently added"
          icon={<Sparkles className="h-4 w-4" />}
          empty={recentWords.length === 0 ? "Add your first word to get started." : null}
        >
          <ul className="space-y-2.5">
            {recentWords.map((w) => (
              <li key={w.id}>
                <Link
                  to={`/word/${w.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-secondary/60 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{w.word}</div>
                    {w.meaning_english && (
                      <div className="text-xs text-muted-foreground truncate">
                        {w.meaning_english}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {new Date(w.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
};

const StatTile = ({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "primary" | "accent";
}) => (
  <div className="rounded-xl border border-border/60 bg-card p-4 shadow-card">
    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
      <span
        className={[
          "h-7 w-7 rounded-md flex items-center justify-center",
          accent === "accent" ? "bg-accent/15 text-accent" : "bg-primary/10 text-primary",
        ].join(" ")}
      >
        {icon}
      </span>
      <span className="font-medium uppercase tracking-wide">{label}</span>
    </div>
    <div className="font-display text-2xl sm:text-3xl font-semibold leading-none">{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-1.5">{sub}</div>}
  </div>
);

const Panel = ({
  title,
  icon,
  children,
  empty,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  empty?: string | null;
}) => (
  <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
    <div className="flex items-center gap-2 mb-3">
      {icon && <span className="text-primary">{icon}</span>}
      <h3 className="font-display text-base font-semibold">{title}</h3>
    </div>
    {empty ? (
      <div className="text-sm text-muted-foreground py-6 text-center">{empty}</div>
    ) : (
      children
    )}
  </div>
);

const MasteryBar = ({ buckets }: { buckets: { weak: number; learning: number; strong: number } }) => {
  const total = buckets.weak + buckets.learning + buckets.strong || 1;
  const pct = (n: number) => (n / total) * 100;
  return (
    <div className="h-3 w-full rounded-full bg-secondary overflow-hidden flex">
      <div className="h-full bg-primary" style={{ width: `${pct(buckets.strong)}%` }} />
      <div className="h-full bg-accent" style={{ width: `${pct(buckets.learning)}%` }} />
      <div className="h-full bg-destructive" style={{ width: `${pct(buckets.weak)}%` }} />
    </div>
  );
};

const MasteryRow = ({ label, count, dotClass }: { label: string; count: number; dotClass: string }) => (
  <li className="flex items-center justify-between">
    <span className="flex items-center gap-2 text-muted-foreground">
      <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
      {label}
    </span>
    <span className="font-medium">{count}</span>
  </li>
);

export default Dashboard;
