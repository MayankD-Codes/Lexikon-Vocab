GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.words TO authenticated;
GRANT ALL ON public.words TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.word_stats TO authenticated;
GRANT ALL ON public.word_stats TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_sessions TO authenticated;
GRANT ALL ON public.quiz_sessions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_messages TO authenticated;
GRANT ALL ON public.community_messages TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_palace_anchors TO authenticated;
GRANT ALL ON public.memory_palace_anchors TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_palace_placements TO authenticated;
GRANT ALL ON public.memory_palace_placements TO service_role;