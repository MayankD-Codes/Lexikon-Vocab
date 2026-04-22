-- Create community_messages table
CREATE TABLE public.community_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view all messages
CREATE POLICY "Authenticated users can view all messages"
ON public.community_messages
FOR SELECT
TO authenticated
USING (true);

-- Users can post their own messages
CREATE POLICY "Users can insert their own messages"
ON public.community_messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own messages
CREATE POLICY "Users can update their own messages"
ON public.community_messages
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own messages
CREATE POLICY "Users can delete their own messages"
ON public.community_messages
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Validation: enforce reasonable length and English-only characters
CREATE OR REPLACE FUNCTION public.validate_community_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.content := btrim(NEW.content);
  IF length(NEW.content) = 0 THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;
  IF length(NEW.content) > 500 THEN
    RAISE EXCEPTION 'Message is too long (max 500 characters)';
  END IF;
  -- English-only: ASCII printable characters and basic whitespace
  IF NEW.content !~ '^[\x20-\x7E\n\r\t]+$' THEN
    RAISE EXCEPTION 'Only English (ASCII) characters are allowed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_community_message_trigger
BEFORE INSERT OR UPDATE ON public.community_messages
FOR EACH ROW
EXECUTE FUNCTION public.validate_community_message();

-- Update timestamps trigger
CREATE TRIGGER update_community_messages_updated_at
BEFORE UPDATE ON public.community_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for ordering
CREATE INDEX idx_community_messages_created_at ON public.community_messages (created_at DESC);
CREATE INDEX idx_community_messages_user_id ON public.community_messages (user_id);

-- Enable realtime
ALTER TABLE public.community_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;