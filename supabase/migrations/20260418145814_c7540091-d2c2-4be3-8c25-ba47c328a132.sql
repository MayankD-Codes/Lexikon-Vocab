CREATE TABLE public.words (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  word TEXT NOT NULL,
  pronunciation TEXT,
  spelling TEXT,
  meaning_english TEXT,
  meaning_hindi TEXT,
  part_of_speech TEXT,
  word_forms TEXT,
  example_sentence TEXT,
  synonyms TEXT,
  antonyms TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view words"
ON public.words FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert words"
ON public.words FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update words"
ON public.words FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete words"
ON public.words FOR DELETE
USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_words_updated_at
BEFORE UPDATE ON public.words
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_words_created_at ON public.words(created_at DESC);
CREATE INDEX idx_words_word ON public.words(word);