
CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (
  user_id uuid,
  display_name text,
  avatar_url text,
  total_quizzes integer,
  total_score integer,
  total_questions integer,
  accuracy real,
  words_added integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    COALESCE(p.display_name, 'Anonymous') AS display_name,
    p.avatar_url,
    COALESCE(q.total_quizzes, 0)::integer AS total_quizzes,
    COALESCE(q.total_score, 0)::integer AS total_score,
    COALESCE(q.total_questions, 0)::integer AS total_questions,
    CASE
      WHEN COALESCE(q.total_questions, 0) > 0
        THEN (q.total_score::real / q.total_questions::real) * 100
      ELSE 0
    END AS accuracy,
    COALESCE(w.words_added, 0)::integer AS words_added
  FROM public.profiles p
  LEFT JOIN (
    SELECT
      user_id,
      COUNT(*) FILTER (WHERE completed) AS total_quizzes,
      SUM(score) FILTER (WHERE completed) AS total_score,
      SUM(total_questions) FILTER (WHERE completed) AS total_questions
    FROM public.quiz_sessions
    WHERE user_id IS NOT NULL
    GROUP BY user_id
  ) q ON q.user_id = p.user_id
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS words_added
    FROM public.words
    WHERE user_id IS NOT NULL
    GROUP BY user_id
  ) w ON w.user_id = p.user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO authenticated;
