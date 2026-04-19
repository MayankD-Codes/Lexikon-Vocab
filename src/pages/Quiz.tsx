import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brain, CheckCircle2, XCircle, ArrowRight, RotateCcw, Library, Sparkles, Trophy, Clock } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import type { Word } from "@/lib/types";
import {
  buildQuestions,
  selectQuizWords,
  todayISO,
  MIN_WORDS_REQUIRED,
  type AnswerRecord,
  type QuizQuestion,
  type WordStat,
} from "@/lib/quiz";

type Phase = "loading" | "intro" | "blocked" | "active" | "results" | "already_done";

const Quiz = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("loading");
  const [words, setWords] = useState<Word[]>([]);
  const [stats, setStats] = useState<WordStat[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [questionStart, setQuestionStart] = useState<number>(Date.now());
  const [sessionStart, setSessionStart] = useState<number>(Date.now());
  const [todaysSession, setTodaysSession] = useState<{ score: number; total: number; duration: number } | null>(null);

  useEffect(() => {
    document.title = "Daily Quiz — Lexikon";
    void load();
  }, []);

  const load = async () => {
    setPhase("loading");
    const today = todayISO();
    const [wordsRes, statsRes, sessionRes] = await Promise.all([
      supabase.from("words").select("*"),
      supabase.from("word_stats").select("*"),
      supabase.from("quiz_sessions").select("*").eq("quiz_date", today).maybeSingle(),
    ]);

    const w = (wordsRes.data ?? []) as Word[];
    const s = (statsRes.data ?? []) as unknown as WordStat[];
    setWords(w);
    setStats(s);

    if (sessionRes.data?.completed) {
      setTodaysSession({
        score: sessionRes.data.score,
        total: sessionRes.data.total_questions,
        duration: sessionRes.data.duration_seconds ?? 0,
      });
      setPhase("already_done");
      return;
    }

    if (w.length < MIN_WORDS_REQUIRED) {
      setPhase("blocked");
      return;
    }
    setPhase("intro");
  };

  const startQuiz = () => {
    const chosen = selectQuizWords(words, stats);
    const qs = buildQuestions(chosen, words);
    if (qs.length === 0) {
      setPhase("blocked");
      return;
    }
    setQuestions(qs);
    setCurrentIdx(0);
    setAnswers([]);
    setSelected(null);
    setAnswered(false);
    setSessionStart(Date.now());
    setQuestionStart(Date.now());
    setPhase("active");
  };

  const handleSelect = (option: string) => {
    if (answered) return;
    setSelected(option);
    setAnswered(true);
    const q = questions[currentIdx];
    const isCorrect = option === q.correctAnswer;
    const responseTime = Date.now() - questionStart;
    setAnswers((prev) => [
      ...prev,
      {
        word_id: q.word.id,
        question_type: q.type,
        correct_answer: q.correctAnswer,
        user_answer: option,
        is_correct: isCorrect,
        response_time_ms: responseTime,
      },
    ]);
  };

  const handleNext = async () => {
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx((i) => i + 1);
      setSelected(null);
      setAnswered(false);
      setQuestionStart(Date.now());
    } else {
      await finishQuiz();
    }
  };

  const finishQuiz = async () => {
    const score = answers.filter((a) => a.is_correct).length;
    const duration = Math.round((Date.now() - sessionStart) / 1000);

    // Aggregate per-word updates
    const perWord = new Map<string, { correct: number; incorrect: number }>();
    for (const a of answers) {
      const cur = perWord.get(a.word_id) ?? { correct: 0, incorrect: 0 };
      if (a.is_correct) cur.correct += 1;
      else cur.incorrect += 1;
      perWord.set(a.word_id, cur);
    }

    const statsByWord = new Map(stats.map((s) => [s.word_id, s]));
    const now = new Date().toISOString();
    const upserts = Array.from(perWord.entries()).map(([word_id, delta]) => {
      const existing = statsByWord.get(word_id);
      const correct_count = (existing?.correct_count ?? 0) + delta.correct;
      const incorrect_count = (existing?.incorrect_count ?? 0) + delta.incorrect;
      const total = correct_count + incorrect_count;
      const difficulty_score = total === 0 ? 0 : incorrect_count / total;
      return {
        word_id,
        correct_count,
        incorrect_count,
        last_tested_at: now,
        difficulty_score,
      };
    });

    await Promise.all([
      supabase.from("word_stats").upsert(upserts, { onConflict: "word_id" }),
      supabase.from("quiz_sessions").upsert(
        {
          quiz_date: todayISO(),
          score,
          total_questions: answers.length,
          duration_seconds: duration,
          answers: answers as unknown as never,
          completed: true,
        },
        { onConflict: "quiz_date" }
      ),
    ]);

    setTodaysSession({ score, total: answers.length, duration });
    setPhase("results");
  };

  const wordById = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);

  return (
    <div className="min-h-screen bg-gradient-paper">
      <Header />
      <main className="container py-10 sm:py-14 max-w-2xl">
        {phase === "loading" && (
          <div className="text-center text-muted-foreground py-20">Loading your quiz…</div>
        )}

        {phase === "blocked" && (
          <div className="rounded-2xl bg-card border border-border/60 p-8 sm:p-12 shadow-card text-center">
            <div className="h-14 w-14 rounded-2xl bg-secondary mx-auto flex items-center justify-center mb-5">
              <Brain className="h-7 w-7 text-primary" />
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold mb-3">
              Add a few more words first
            </h1>
            <p className="text-muted-foreground mb-6">
              You need at least <span className="font-semibold text-foreground">{MIN_WORDS_REQUIRED} words</span> with
              meanings in your dictionary before the daily quiz unlocks. You currently have{" "}
              <span className="font-semibold text-foreground">{words.length}</span>.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg">
                <Link to="/add">Add a Word</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/dictionary">
                  <Library className="h-4 w-4" /> Browse Dictionary
                </Link>
              </Button>
            </div>
          </div>
        )}

        {phase === "already_done" && todaysSession && (
          <ResultsCard
            score={todaysSession.score}
            total={todaysSession.total}
            duration={todaysSession.duration}
            answers={[]}
            wordById={wordById}
            alreadyDone
            onReview={() => navigate("/dictionary")}
          />
        )}

        {phase === "intro" && (
          <div className="rounded-2xl bg-card border border-border/60 p-8 sm:p-12 shadow-card text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium mb-6">
              <Sparkles className="h-3 w-3" /> Daily Quiz
            </div>
            <div className="h-16 w-16 rounded-2xl bg-gradient-warm mx-auto flex items-center justify-center shadow-elegant mb-5">
              <Brain className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold mb-3">
              Ready to test yourself?
            </h1>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              7 personalized questions drawn from your weakest, newest, and best-known words.
              Takes about 5 minutes.
            </p>
            <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto mb-8 text-sm">
              <Stat label="Questions" value="7" />
              <Stat label="~Time" value="5 min" />
              <Stat label="Words" value={String(words.length)} />
            </div>
            <Button size="lg" className="text-base h-12 px-8 shadow-elegant" onClick={startQuiz}>
              Start Quiz <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {phase === "active" && questions[currentIdx] && (
          <ActiveQuestion
            question={questions[currentIdx]}
            index={currentIdx}
            total={questions.length}
            selected={selected}
            answered={answered}
            onSelect={handleSelect}
            onNext={handleNext}
          />
        )}

        {phase === "results" && todaysSession && (
          <ResultsCard
            score={todaysSession.score}
            total={todaysSession.total}
            duration={todaysSession.duration}
            answers={answers}
            wordById={wordById}
            onReview={() => navigate("/dictionary")}
          />
        )}
      </main>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg bg-secondary/60 border border-border/60 py-3">
    <div className="font-display text-xl font-semibold">{value}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </div>
);

const ActiveQuestion = ({
  question,
  index,
  total,
  selected,
  answered,
  onSelect,
  onNext,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  selected: string | null;
  answered: boolean;
  onSelect: (o: string) => void;
  onNext: () => void;
}) => {
  const progress = ((index + (answered ? 1 : 0)) / total) * 100;
  const isCorrect = selected === question.correctAnswer;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2 text-sm text-muted-foreground">
          <span>
            Question {index + 1} of {total}
          </span>
          <span className="capitalize">{question.type.replace(/_/g, " ")}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="rounded-2xl bg-card border border-border/60 p-6 sm:p-8 shadow-card">
        <h2 className="font-display text-xl sm:text-2xl font-semibold leading-snug">
          {question.prompt}
        </h2>
        {question.hint && (
          <p className="mt-3 text-base sm:text-lg italic text-muted-foreground leading-relaxed">
            “{question.hint}”
          </p>
        )}

        <div className="mt-6 grid gap-2.5">
          {question.options.map((opt) => {
            const isSelected = selected === opt;
            const isAnswerCorrect = answered && opt === question.correctAnswer;
            const isWrongPick = answered && isSelected && !isCorrect;
            return (
              <button
                key={opt}
                onClick={() => onSelect(opt)}
                disabled={answered}
                className={[
                  "text-left rounded-xl border px-4 py-3 transition-all",
                  "flex items-center justify-between gap-3",
                  !answered && "hover:border-primary hover:bg-secondary/60",
                  isAnswerCorrect && "border-primary bg-primary/10 text-foreground",
                  isWrongPick && "border-destructive bg-destructive/10",
                  !answered && isSelected && "border-primary",
                  answered && !isAnswerCorrect && !isWrongPick && "opacity-60",
                  "disabled:cursor-default",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="text-sm sm:text-base">{opt}</span>
                {isAnswerCorrect && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
                {isWrongPick && <XCircle className="h-5 w-5 text-destructive shrink-0" />}
              </button>
            );
          })}
        </div>

        {answered && (
          <div className="mt-6 rounded-xl bg-secondary/50 border border-border/60 p-4 text-sm">
            {isCorrect ? (
              <p className="font-medium text-foreground">Correct! Nicely done.</p>
            ) : (
              <p className="text-foreground">
                <span className="font-medium">Correct answer:</span>{" "}
                <span className="font-semibold">{question.correctAnswer}</span>
              </p>
            )}
            {question.word.meaning_english && (
              <p className="mt-1.5 text-muted-foreground">
                <span className="font-medium text-foreground">{question.word.word}</span> —{" "}
                {question.word.meaning_english}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button size="lg" disabled={!answered} onClick={onNext} className="px-8">
          {index + 1 === total ? "See Results" : "Next"} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

const ResultsCard = ({
  score,
  total,
  duration,
  answers,
  wordById,
  alreadyDone = false,
  onReview,
}: {
  score: number;
  total: number;
  duration: number;
  answers: AnswerRecord[];
  wordById: Map<string, Word>;
  alreadyDone?: boolean;
  onReview: () => void;
}) => {
  const accuracy = total === 0 ? 0 : Math.round((score / total) * 100);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  const weakWords = answers.filter((a) => !a.is_correct).map((a) => wordById.get(a.word_id)?.word).filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-card border border-border/60 p-8 sm:p-10 shadow-card text-center">
        <div className="h-14 w-14 rounded-2xl bg-gradient-warm mx-auto flex items-center justify-center shadow-elegant mb-5">
          <Trophy className="h-7 w-7 text-primary-foreground" />
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mb-2">
          {alreadyDone ? "You've finished today's quiz" : "Quiz complete"}
        </h1>
        <p className="text-muted-foreground mb-8">
          {alreadyDone ? "Come back tomorrow for a fresh round." : "Here's how you did."}
        </p>
        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto mb-8">
          <BigStat label="Score" value={`${score}/${total}`} />
          <BigStat label="Accuracy" value={`${accuracy}%`} />
          <BigStat
            label="Time"
            value={duration === 0 ? "—" : `${minutes}:${String(seconds).padStart(2, "0")}`}
            icon={<Clock className="h-3.5 w-3.5" />}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" variant="outline" onClick={onReview}>
            <Library className="h-4 w-4" /> Open Dictionary
          </Button>
          {!alreadyDone && (
            <Button asChild size="lg" variant="ghost">
              <Link to="/">
                <RotateCcw className="h-4 w-4" /> Done for Today
              </Link>
            </Button>
          )}
        </div>
      </div>

      {weakWords.length > 0 && (
        <div className="rounded-2xl bg-card border border-border/60 p-6 shadow-card">
          <h2 className="font-display text-lg font-semibold mb-3">Words to review</h2>
          <div className="flex flex-wrap gap-2">
            {weakWords.map((w) => (
              <span
                key={w}
                className="px-3 py-1.5 rounded-full bg-destructive/10 text-foreground text-sm border border-destructive/20"
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const BigStat = ({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) => (
  <div className="rounded-xl bg-secondary/60 border border-border/60 py-4">
    <div className="font-display text-2xl sm:text-3xl font-semibold">{value}</div>
    <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-1">
      {icon}
      {label}
    </div>
  </div>
);

export default Quiz;
