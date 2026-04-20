
-- 1. Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by owner"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Add user_id to existing tables (nullable so existing rows survive)
ALTER TABLE public.words ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.quiz_sessions ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX idx_words_user_id ON public.words(user_id);
CREATE INDEX idx_quiz_sessions_user_id ON public.quiz_sessions(user_id);

-- 4. Replace permissive RLS with per-user policies on words
DROP POLICY IF EXISTS "Anyone can delete words" ON public.words;
DROP POLICY IF EXISTS "Anyone can insert words" ON public.words;
DROP POLICY IF EXISTS "Anyone can update words" ON public.words;
DROP POLICY IF EXISTS "Anyone can view words" ON public.words;

CREATE POLICY "Users view own words"
  ON public.words FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own words"
  ON public.words FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own words"
  ON public.words FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own words"
  ON public.words FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Replace permissive RLS on quiz_sessions
DROP POLICY IF EXISTS "Anyone can delete quiz_sessions" ON public.quiz_sessions;
DROP POLICY IF EXISTS "Anyone can insert quiz_sessions" ON public.quiz_sessions;
DROP POLICY IF EXISTS "Anyone can update quiz_sessions" ON public.quiz_sessions;
DROP POLICY IF EXISTS "Anyone can view quiz_sessions" ON public.quiz_sessions;

CREATE POLICY "Users view own quizzes"
  ON public.quiz_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own quizzes"
  ON public.quiz_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own quizzes"
  ON public.quiz_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own quizzes"
  ON public.quiz_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- 6. word_stats: scope via the parent word's owner
DROP POLICY IF EXISTS "Anyone can delete word_stats" ON public.word_stats;
DROP POLICY IF EXISTS "Anyone can insert word_stats" ON public.word_stats;
DROP POLICY IF EXISTS "Anyone can update word_stats" ON public.word_stats;
DROP POLICY IF EXISTS "Anyone can view word_stats" ON public.word_stats;

CREATE POLICY "Users view own word_stats"
  ON public.word_stats FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.words w WHERE w.id = word_stats.word_id AND w.user_id = auth.uid()));

CREATE POLICY "Users insert own word_stats"
  ON public.word_stats FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.words w WHERE w.id = word_stats.word_id AND w.user_id = auth.uid()));

CREATE POLICY "Users update own word_stats"
  ON public.word_stats FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.words w WHERE w.id = word_stats.word_id AND w.user_id = auth.uid()));

CREATE POLICY "Users delete own word_stats"
  ON public.word_stats FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.words w WHERE w.id = word_stats.word_id AND w.user_id = auth.uid()));
