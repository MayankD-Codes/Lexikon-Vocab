
-- Drop any old quiz_date-only unique constraint if it exists, then add per-user one
ALTER TABLE public.quiz_sessions DROP CONSTRAINT IF EXISTS quiz_sessions_quiz_date_key;
DROP INDEX IF EXISTS public.quiz_sessions_quiz_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS quiz_sessions_user_date_key
  ON public.quiz_sessions (user_id, quiz_date);
