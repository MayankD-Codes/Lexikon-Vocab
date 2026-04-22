CREATE OR REPLACE FUNCTION public.get_community_messages(_limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  content text,
  created_at timestamp with time zone,
  display_name text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.user_id,
    m.content,
    m.created_at,
    COALESCE(p.display_name, 'Anonymous') AS display_name,
    p.avatar_url
  FROM public.community_messages m
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  ORDER BY m.created_at DESC
  LIMIT GREATEST(LEAST(COALESCE(_limit, 100), 200), 1);
$$;

REVOKE ALL ON FUNCTION public.get_community_messages(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_community_messages(integer) TO authenticated;