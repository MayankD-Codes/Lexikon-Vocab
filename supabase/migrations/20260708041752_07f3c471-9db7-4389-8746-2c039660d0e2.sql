
-- 1) Drop email column from profiles (email lives in auth.users)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- Update handle_new_user to stop writing email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uname text;
BEGIN
  _uname := lower(trim(COALESCE(NEW.raw_user_meta_data ->> 'username', '')));
  IF _uname IS NULL OR length(_uname) = 0 THEN
    _uname := 'user_' || substr(NEW.id::text, 1, 8);
  END IF;

  INSERT INTO public.profiles (user_id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    _uname,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      _uname
    ),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- 2) Add ownership guard to per-user SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.get_memory_palace_anchors(_user_id uuid)
RETURNS TABLE(id uuid, name text, anchor_order integer, style text, active_word_count integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    a.id,
    a.name,
    a.anchor_order,
    a.style,
    COALESCE((
      SELECT COUNT(*)::int FROM public.memory_palace_placements p
      WHERE p.anchor_id = a.id AND p.status = 'active'
    ), 0) AS active_word_count
  FROM public.memory_palace_anchors a
  WHERE a.user_id = _user_id
  ORDER BY a.anchor_order ASC, a.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_memory_palace_active(_user_id uuid)
RETURNS TABLE(id uuid, word_id uuid, word text, meaning_english text, anchor_id uuid, anchor_name text, imagery_text text, recall_correct integer, recall_incorrect integer, last_recalled_at timestamp with time zone, created_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    p.id, p.word_id, w.word, w.meaning_english, p.anchor_id, a.name AS anchor_name,
    p.imagery_text, p.recall_correct, p.recall_incorrect, p.last_recalled_at, p.created_at
  FROM public.memory_palace_placements p
  JOIN public.words w ON w.id = p.word_id
  JOIN public.memory_palace_anchors a ON a.id = p.anchor_id
  WHERE p.user_id = _user_id AND p.status = 'active'
  ORDER BY a.anchor_order ASC, p.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_unplaced_words(_user_id uuid)
RETURNS TABLE(id uuid, word text, meaning_english text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT w.id, w.word, w.meaning_english
  FROM public.words w
  WHERE w.user_id = _user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.memory_palace_placements p
      WHERE p.word_id = w.id AND p.status IN ('active', 'stable')
    )
  ORDER BY w.created_at DESC;
END;
$$;

-- get_learner_quiz_history: keep public-viewable (backs the leaderboard drill-down)
-- but require an authenticated caller.
CREATE OR REPLACE FUNCTION public.get_learner_quiz_history(_user_id uuid, _limit integer DEFAULT 10)
RETURNS TABLE(id uuid, quiz_date date, score integer, total_questions integer, duration_seconds integer, accuracy real, created_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    q.id, q.quiz_date, q.score, q.total_questions, q.duration_seconds,
    CASE WHEN q.total_questions > 0 THEN (q.score::real / q.total_questions::real) * 100 ELSE 0 END,
    q.created_at
  FROM public.quiz_sessions q
  WHERE q.user_id = _user_id AND q.completed = true
  ORDER BY q.created_at DESC
  LIMIT GREATEST(LEAST(COALESCE(_limit, 10), 50), 1);
END;
$$;

-- 3) Tighten EXECUTE permissions on SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.get_memory_palace_anchors(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_memory_palace_anchors(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_memory_palace_active(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_memory_palace_active(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_unplaced_words(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unplaced_words(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_learner_quiz_history(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_learner_quiz_history(uuid, integer) TO authenticated;

-- Username lookup / public profile / leaderboard / community are intentionally public.
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_by_username(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_community_messages(integer) TO anon, authenticated;
