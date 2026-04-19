-- Per-word memory tracking for adaptive quiz bucketing
CREATE TABLE public.word_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  word_id UUID NOT NULL UNIQUE REFERENCES public.words(id) ON DELETE CASCADE,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  last_tested_at TIMESTAMPTZ,
  difficulty_score REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.word_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view word_stats" ON public.word_stats FOR SELECT USING (true);
CREATE POLICY "Anyone can insert word_stats" ON public.word_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update word_stats" ON public.word_stats FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete word_stats" ON public.word_stats FOR DELETE USING (true);

CREATE TRIGGER update_word_stats_updated_at
BEFORE UPDATE ON public.word_stats
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Daily quiz session log
CREATE TABLE public.quiz_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_date DATE NOT NULL UNIQUE,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view quiz_sessions" ON public.quiz_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert quiz_sessions" ON public.quiz_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update quiz_sessions" ON public.quiz_sessions FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete quiz_sessions" ON public.quiz_sessions FOR DELETE USING (true);

CREATE TRIGGER update_quiz_sessions_updated_at
BEFORE UPDATE ON public.quiz_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_word_stats_word_id ON public.word_stats(word_id);
CREATE INDEX idx_quiz_sessions_quiz_date ON public.quiz_sessions(quiz_date DESC);