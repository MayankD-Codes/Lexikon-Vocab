-- Google/OAuth sign-ups can miss the auth.users trigger on some Supabase paths.
-- ensure_my_profile() is the idempotent fallback; the trigger remains the primary path.

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
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _u auth.users%ROWTYPE;
  _uname text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO _u FROM auth.users WHERE id = auth.uid();
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _u.id) THEN
    RETURN;
  END IF;

  _uname := lower(trim(COALESCE(_u.raw_user_meta_data ->> 'username', '')));
  IF _uname IS NULL OR length(_uname) = 0 THEN
    _uname := 'user_' || substr(_u.id::text, 1, 8);
  END IF;

  INSERT INTO public.profiles (user_id, username, display_name, avatar_url)
  VALUES (
    _u.id,
    _uname,
    COALESCE(
      _u.raw_user_meta_data ->> 'full_name',
      _u.raw_user_meta_data ->> 'name',
      _uname
    ),
    _u.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_my_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill any auth users still missing a profile (safe to re-run).
INSERT INTO public.profiles (user_id, username, display_name, avatar_url)
SELECT
  u.id,
  COALESCE(
    NULLIF(lower(trim(u.raw_user_meta_data ->> 'username')), ''),
    'user_' || substr(u.id::text, 1, 8)
  ),
  COALESCE(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    'user_' || substr(u.id::text, 1, 8)
  ),
  u.raw_user_meta_data ->> 'avatar_url'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;
