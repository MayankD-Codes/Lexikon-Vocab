
-- Enable citext for case-insensitive uniqueness
CREATE EXTENSION IF NOT EXISTS citext;

-- Add username column (nullable initially so existing rows don't break)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username citext;

-- Backfill existing rows with a safe placeholder from email or user_id
UPDATE public.profiles
SET username = lower(regexp_replace(
  COALESCE(split_part(email, '@', 1), 'user_' || substr(user_id::text, 1, 8)),
  '[^a-zA-Z0-9._]', '', 'g'
))
WHERE username IS NULL;

-- Ensure any nulls left get a fallback
UPDATE public.profiles
SET username = 'user_' || substr(user_id::text, 1, 8)
WHERE username IS NULL OR length(username) = 0;

-- Handle any collisions from backfill
WITH dupes AS (
  SELECT user_id, username,
    ROW_NUMBER() OVER (PARTITION BY username ORDER BY created_at) AS rn
  FROM public.profiles
)
UPDATE public.profiles p
SET username = p.username || '_' || substr(p.user_id::text, 1, 6)
FROM dupes d
WHERE p.user_id = d.user_id AND d.rn > 1;

ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;

-- Format check (letters, numbers, underscore, period; 1-30 chars)
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
  CHECK (username ~ '^[a-zA-Z0-9._]{1,30}$');

-- Unique index (citext handles case-insensitivity)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (username);

-- Allow public read of minimal profile info for /:username pages and availability checks
DROP POLICY IF EXISTS "Public can view profile basics" ON public.profiles;
CREATE POLICY "Public can view profile basics"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.profiles TO anon;

-- RPC: check availability (returns true if free)
CREATE OR REPLACE FUNCTION public.is_username_available(_username text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE username = _username::citext
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated;

-- RPC: fetch profile by username for /:username pages
CREATE OR REPLACE FUNCTION public.get_profile_by_username(_username text)
RETURNS TABLE(user_id uuid, username text, display_name text, avatar_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.username::text, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE p.username = _username::citext
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_by_username(text) TO anon, authenticated;

-- Update handle_new_user to store username from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uname text;
BEGIN
  _uname := lower(trim(COALESCE(NEW.raw_user_meta_data ->> 'username', '')));
  IF _uname IS NULL OR length(_uname) = 0 THEN
    _uname := 'user_' || substr(NEW.id::text, 1, 8);
  END IF;

  INSERT INTO public.profiles (user_id, username, display_name, avatar_url, email)
  VALUES (
    NEW.id,
    _uname,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      _uname
    ),
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.email
  );
  RETURN NEW;
END;
$$;
