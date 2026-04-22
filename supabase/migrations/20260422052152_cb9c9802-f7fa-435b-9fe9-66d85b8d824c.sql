CREATE OR REPLACE FUNCTION public.get_learner_quiz_history(_user_id uuid, _limit integer DEFAULT 10)
RETURNS TABLE(
  id uuid,
  quiz_date date,
  score integer,
  total_questions integer,
  duration_seconds integer,
  accuracy real,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    q.id,
    q.quiz_date,
    q.score,
    q.total_questions,
    q.duration_seconds,
    CASE
      WHEN q.total_questions > 0
        THEN (q.score::real / q.total_questions::real) * 100
      ELSE 0
    END AS accuracy,
    q.created_at
  FROM public.quiz_sessions q
  WHERE q.user_id = _user_id
    AND q.completed = true
  ORDER BY q.created_at DESC
  LIMIT GREATEST(LEAST(COALESCE(_limit, 10), 50), 1);
$$;