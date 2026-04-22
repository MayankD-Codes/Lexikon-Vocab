import { useEffect, useMemo, useState } from "react";
import { Trophy, Target, Clock, CalendarDays, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface QuizHistoryRow {
  id: string;
  quiz_date: string;
  score: number;
  total_questions: number;
  duration_seconds: number | null;
  accuracy: number;
  created_at: string;
}

interface LearnerHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  rank: number | null;
  isMe: boolean;
}

const initialsOf = (name: string | null) =>
  (name || "?").trim().slice(0, 2).toUpperCase();

const formatDuration = (seconds: number | null) => {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
};

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

const accuracyTone = (acc: number) => {
  if (acc >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (acc >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
};

const LearnerHistoryDialog = ({
  open,
  onOpenChange,
  userId,
  displayName,
  avatarUrl,
  rank,
  isMe,
}: LearnerHistoryDialogProps) => {
  const [history, setHistory] = useState<QuizHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);
    setHistory([]);
    supabase
      .rpc("get_learner_quiz_history", { _user_id: userId, _limit: 10 })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          setHistory(data as QuizHistoryRow[]);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  const recentAccuracy = useMemo(() => {
    if (history.length === 0) return null;
    const totalScore = history.reduce((sum, h) => sum + h.score, 0);
    const totalQ = history.reduce((sum, h) => sum + h.total_questions, 0);
    if (totalQ === 0) return 0;
    return (totalScore / totalQ) * 100;
  }, [history]);

  const bestScore = useMemo(() => {
    if (history.length === 0) return null;
    return history.reduce(
      (best, h) => (h.accuracy > best.accuracy ? h : best),
      history[0],
    );
  }, [history]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-border space-y-0">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 shrink-0 ring-2 ring-primary/20">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName || ""} />}
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {initialsOf(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold truncate text-left">
                {displayName || "Anonymous"}
                {isMe && (
                  <span className="ml-2 text-[10px] text-primary font-semibold align-middle">
                    YOU
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground text-left mt-0.5">
                {rank !== null ? `Ranked #${rank} on the leaderboard` : "Learner profile"}
              </DialogDescription>
            </div>
            {rank !== null && rank <= 3 && (
              <Badge variant="secondary" className="shrink-0 gap-1">
                <Trophy className="h-3 w-3" />#{rank}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-px bg-border">
          <SummaryStat
            icon={<Target className="h-3.5 w-3.5" />}
            label="Recent accuracy"
            value={
              recentAccuracy === null
                ? "—"
                : `${recentAccuracy.toFixed(0)}%`
            }
            tone={recentAccuracy !== null ? accuracyTone(recentAccuracy) : undefined}
          />
          <SummaryStat
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="Best run"
            value={
              bestScore
                ? `${bestScore.score}/${bestScore.total_questions}`
                : "—"
            }
          />
        </div>

        {/* History list */}
        <div className="max-h-[55vh] overflow-y-auto bg-card">
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              Loading quiz history…
            </div>
          ) : history.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
              <p className="text-sm text-muted-foreground">
                No completed quizzes yet.
              </p>
            </div>
          ) : (
            <div className="px-2 py-2">
              <p className="px-3 pt-1 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Last {history.length} {history.length === 1 ? "quiz" : "quizzes"}
              </p>
              <ul className="space-y-1">
                {history.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/60 transition-colors"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Brain />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {formatDate(h.created_at)}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(h.duration_seconds)}
                        </span>
                        <span aria-hidden>·</span>
                        <span>
                          {h.score}/{h.total_questions} correct
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn("text-sm font-semibold tabular-nums", accuracyTone(h.accuracy))}>
                        {h.accuracy.toFixed(0)}%
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const SummaryStat = ({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: string;
}) => (
  <div className="bg-card px-4 py-3">
    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
      {icon}
      {label}
    </div>
    <p className={cn("mt-1 text-lg font-semibold tabular-nums", tone)}>{value}</p>
  </div>
);

// Local Brain icon (avoids extra import line above)
const Brain = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
    <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
  </svg>
);

export default LearnerHistoryDialog;
