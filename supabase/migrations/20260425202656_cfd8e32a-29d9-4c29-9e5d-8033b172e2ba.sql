-- Memory Palace: anchors and word placements

CREATE TABLE public.memory_palace_anchors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  anchor_order INTEGER NOT NULL DEFAULT 0,
  style TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_mp_anchors_user ON public.memory_palace_anchors(user_id, anchor_order);

ALTER TABLE public.memory_palace_anchors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own anchors"
ON public.memory_palace_anchors FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own anchors"
ON public.memory_palace_anchors FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own anchors"
ON public.memory_palace_anchors FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own anchors"
ON public.memory_palace_anchors FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_mp_anchors_updated_at
BEFORE UPDATE ON public.memory_palace_anchors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.memory_palace_placements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  word_id UUID NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
  anchor_id UUID NOT NULL REFERENCES public.memory_palace_anchors(id) ON DELETE CASCADE,
  imagery_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  recall_correct INTEGER NOT NULL DEFAULT 0,
  recall_incorrect INTEGER NOT NULL DEFAULT 0,
  last_recalled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, word_id)
);

CREATE INDEX idx_mp_placements_user_status ON public.memory_palace_placements(user_id, status);
CREATE INDEX idx_mp_placements_anchor ON public.memory_palace_placements(anchor_id);

ALTER TABLE public.memory_palace_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own placements"
ON public.memory_palace_placements FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own placements"
ON public.memory_palace_placements FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own placements"
ON public.memory_palace_placements FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own placements"
ON public.memory_palace_placements FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_mp_placements_updated_at
BEFORE UPDATE ON public.memory_palace_placements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_memory_palace_placement()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  active_per_anchor INTEGER;
  active_total INTEGER;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT COUNT(*) INTO active_per_anchor
    FROM public.memory_palace_placements
    WHERE anchor_id = NEW.anchor_id
      AND status = 'active'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    IF active_per_anchor >= 2 THEN
      RAISE EXCEPTION 'This anchor already has 2 active words. Stabilize one before adding more.';
    END IF;

    SELECT COUNT(*) INTO active_total
    FROM public.memory_palace_placements
    WHERE user_id = NEW.user_id
      AND status = 'active'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    IF active_total >= 10 THEN
      RAISE EXCEPTION 'Your palace is full (10 active words). Stabilize some before adding more.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_mp_placement
BEFORE INSERT OR UPDATE ON public.memory_palace_placements
FOR EACH ROW EXECUTE FUNCTION public.validate_memory_palace_placement();

CREATE OR REPLACE FUNCTION public.get_memory_palace_anchors(_user_id UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  anchor_order INTEGER,
  style TEXT,
  active_word_count INTEGER
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.get_memory_palace_active(_user_id UUID)
RETURNS TABLE(
  id UUID,
  word_id UUID,
  word TEXT,
  meaning_english TEXT,
  anchor_id UUID,
  anchor_name TEXT,
  imagery_text TEXT,
  recall_correct INTEGER,
  recall_incorrect INTEGER,
  last_recalled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.word_id,
    w.word,
    w.meaning_english,
    p.anchor_id,
    a.name AS anchor_name,
    p.imagery_text,
    p.recall_correct,
    p.recall_incorrect,
    p.last_recalled_at,
    p.created_at
  FROM public.memory_palace_placements p
  JOIN public.words w ON w.id = p.word_id
  JOIN public.memory_palace_anchors a ON a.id = p.anchor_id
  WHERE p.user_id = _user_id AND p.status = 'active'
  ORDER BY a.anchor_order ASC, p.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_unplaced_words(_user_id UUID)
RETURNS TABLE(
  id UUID,
  word TEXT,
  meaning_english TEXT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.id, w.word, w.meaning_english
  FROM public.words w
  WHERE w.user_id = _user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.memory_palace_placements p
      WHERE p.word_id = w.id AND p.status IN ('active', 'stable')
    )
  ORDER BY w.created_at DESC;
$$;