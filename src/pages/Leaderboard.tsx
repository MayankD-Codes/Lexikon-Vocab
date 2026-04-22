import { useEffect, useMemo, useState } from "react";
import { Trophy, Medal, Award, Crown, Brain, BookOpen, Target } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import { cn } from "@/lib/utils";
import LearnerHistoryDialog from "@/components/leaderboard/LearnerHistoryDialog";

interface LeaderboardRow {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  total_quizzes: number;
  total_score: number;
  total_questions: number;
  accuracy: number;
  words_added: number;
}

type SortKey = "score" | "accuracy" | "quizzes" | "words";

const initialsOf = (name: string | null) =>
  (name || "?").trim().slice(0, 2).toUpperCase();

const Leaderboard = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [selected, setSelected] = useState<{ row: LeaderboardRow; rank: number } | null>(null);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_leaderboard");
    if (!error && data) {
      setRows(data as LeaderboardRow[]);
    }
    setLoading(false);
  };

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      switch (sortKey) {
        case "accuracy":
          return b.accuracy - a.accuracy || b.total_score - a.total_score;
        case "quizzes":
          return b.total_quizzes - a.total_quizzes || b.total_score - a.total_score;
        case "words":
          return b.words_added - a.words_added || b.total_score - a.total_score;
        case "score":
        default:
          return b.total_score - a.total_score || b.accuracy - a.accuracy;
      }
    });
    return arr;
  }, [rows, sortKey]);

  const podium = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  const myRankIndex = sorted.findIndex((r) => r.user_id === user?.id);

  const sortTabs: { key: SortKey; label: string; icon: React.ReactNode }[] = [
    { key: "score", label: "Score", icon: <Trophy className="h-3.5 w-3.5" /> },
    { key: "accuracy", label: "Accuracy", icon: <Target className="h-3.5 w-3.5" /> },
    { key: "quizzes", label: "Quizzes", icon: <Brain className="h-3.5 w-3.5" /> },
    { key: "words", label: "Words", icon: <BookOpen className="h-3.5 w-3.5" /> },
  ];

  return (
    <>
      <SEO
        title="Leaderboard — Lexikon"
        description="See how you rank against other Lexikon learners by quiz score, accuracy and words mastered."
        noindex
      />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8 space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
                Leaderboard
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Ranked by total quiz score across all completed quizzes.
            </p>
          </div>
          {myRankIndex >= 0 && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              You: #{myRankIndex + 1}
            </Badge>
          )}
        </header>

        {/* Sort tabs */}
        <div className="flex flex-wrap gap-2">
          {sortTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSortKey(tab.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors border",
                sortKey === tab.key
                  ? "bg-primary text-primary-foreground border-primary shadow-soft"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading leaderboard…</div>
        ) : sorted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
            <Trophy className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
            <p className="text-sm text-muted-foreground">
              No learners on the board yet. Be the first to complete a quiz!
            </p>
          </div>
        ) : (
          <>
            {/* Podium */}
            {podium.length > 0 && (
              <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {podium.map((row, idx) => (
                  <PodiumCard
                    key={row.user_id}
                    row={row}
                    rank={idx + 1}
                    isMe={row.user_id === user?.id}
                    sortKey={sortKey}
                    onClick={() => setSelected({ row, rank: idx + 1 })}
                  />
                ))}
              </section>
            )}

            {/* Full table */}
            {rest.length > 0 && (
              <section className="rounded-xl border border-border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Learner</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">Quizzes</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">Words</TableHead>
                      <TableHead className="text-right hidden xs:table-cell">Acc.</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rest.map((row, idx) => {
                      const rank = idx + 4;
                      const isMe = row.user_id === user?.id;
                      return (
                        <TableRow
                          key={row.user_id}
                          onClick={() => setSelected({ row, rank })}
                          className={cn(
                            "cursor-pointer",
                            isMe && "bg-primary/5 hover:bg-primary/10",
                          )}
                        >
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {rank}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Avatar className="h-8 w-8 shrink-0">
                                {row.avatar_url && (
                                  <AvatarImage src={row.avatar_url} alt={row.display_name || ""} />
                                )}
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                                  {initialsOf(row.display_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {row.display_name || "Anonymous"}
                                  {isMe && (
                                    <span className="ml-1.5 text-[10px] text-primary font-semibold">
                                      YOU
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-muted-foreground sm:hidden">
                                  {row.total_quizzes} quizzes · {row.words_added} words
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right hidden sm:table-cell text-sm">
                            {row.total_quizzes}
                          </TableCell>
                          <TableCell className="text-right hidden sm:table-cell text-sm">
                            {row.words_added}
                          </TableCell>
                          <TableCell className="text-right hidden xs:table-cell text-sm tabular-nums">
                            {row.accuracy.toFixed(0)}%
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {row.total_score}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </section>
            )}
          </>
        )}
      </div>

      <LearnerHistoryDialog
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        userId={selected?.row.user_id ?? null}
        displayName={selected?.row.display_name ?? null}
        avatarUrl={selected?.row.avatar_url ?? null}
        rank={selected?.rank ?? null}
        isMe={selected?.row.user_id === user?.id}
      />
    </>
  );
};

const podiumStyles: Record<number, { ring: string; icon: React.ReactNode; label: string }> = {
  1: {
    ring: "ring-2 ring-primary/60 bg-gradient-warm text-primary-foreground",
    icon: <Crown className="h-5 w-5" />,
    label: "1st",
  },
  2: {
    ring: "ring-1 ring-border bg-card",
    icon: <Medal className="h-5 w-5 text-muted-foreground" />,
    label: "2nd",
  },
  3: {
    ring: "ring-1 ring-border bg-card",
    icon: <Award className="h-5 w-5 text-accent" />,
    label: "3rd",
  },
};

const PodiumCard = ({
  row,
  rank,
  isMe,
  sortKey,
  onClick,
}: {
  row: LeaderboardRow;
  rank: number;
  isMe: boolean;
  sortKey: SortKey;
  onClick: () => void;
}) => {
  const style = podiumStyles[rank];
  const isFirst = rank === 1;

  const primaryStat =
    sortKey === "accuracy"
      ? `${row.accuracy.toFixed(0)}%`
      : sortKey === "quizzes"
      ? `${row.total_quizzes}`
      : sortKey === "words"
      ? `${row.words_added}`
      : `${row.total_score}`;

  const primaryLabel =
    sortKey === "accuracy"
      ? "accuracy"
      : sortKey === "quizzes"
      ? "quizzes"
      : sortKey === "words"
      ? "words"
      : "points";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative text-left rounded-xl p-4 shadow-soft transition-all hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        style.ring,
        isFirst && "sm:scale-105 sm:-translate-y-1 sm:hover:scale-[1.08]"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={cn("flex items-center gap-1.5 text-xs font-semibold", isFirst ? "text-primary-foreground/90" : "text-foreground")}>
          {style.icon}
          {style.label}
        </div>
        {isMe && (
          <Badge
            variant="secondary"
            className={cn("text-[10px] h-5", isFirst && "bg-primary-foreground/20 text-primary-foreground border-0")}
          >
            YOU
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Avatar className={cn("h-12 w-12 shrink-0", isFirst && "ring-2 ring-primary-foreground/40")}>
          {row.avatar_url && <AvatarImage src={row.avatar_url} alt={row.display_name || ""} />}
          <AvatarFallback
            className={cn(
              "text-sm font-semibold",
              isFirst ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"
            )}
          >
            {initialsOf(row.display_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-medium truncate",
              isFirst ? "text-primary-foreground" : "text-foreground"
            )}
          >
            {row.display_name || "Anonymous"}
          </p>
          <p
            className={cn(
              "text-xs",
              isFirst ? "text-primary-foreground/80" : "text-muted-foreground"
            )}
          >
            <span className="font-semibold tabular-nums">{primaryStat}</span> {primaryLabel}
          </p>
        </div>
      </div>
    </button>
  );
};

export default Leaderboard;
