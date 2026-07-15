
-- =========================================================
-- user_subscriptions
-- =========================================================
CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro')),
  subscription_status text NOT NULL DEFAULT 'none'
    CHECK (subscription_status IN ('active','trialing','past_due','canceled','unpaid','incomplete','incomplete_expired','none')),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  billing_interval text CHECK (billing_interval IN ('monthly','quarterly','yearly')),
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_subscriptions TO authenticated;
GRANT ALL ON public.user_subscriptions TO service_role;

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
  ON public.user_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for authenticated: only service_role writes.

CREATE INDEX idx_user_subscriptions_stripe_customer ON public.user_subscriptions(stripe_customer_id);
CREATE INDEX idx_user_subscriptions_stripe_subscription ON public.user_subscriptions(stripe_subscription_id);

CREATE TRIGGER trg_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- stripe_processed_events (idempotency)
-- =========================================================
CREATE TABLE public.stripe_processed_events (
  stripe_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.stripe_processed_events TO service_role;
-- No grants to anon/authenticated; only service_role touches this.

ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;
-- No policies → locked to service_role via GRANTs.

-- =========================================================
-- is_user_pro helper (SECURITY DEFINER, safe for use in triggers)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_user_pro(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_subscriptions s
    WHERE s.user_id = _user_id
      AND s.plan = 'pro'
      AND (
        s.subscription_status IN ('active','trialing')
        OR (
          s.subscription_status = 'canceled'
          AND s.current_period_end IS NOT NULL
          AND s.current_period_end > now()
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_user_pro(uuid) TO authenticated, service_role;

-- =========================================================
-- Free-plan 10 word cap trigger (statement-level, handles bulk inserts)
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_free_word_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _current_count int;
  _incoming int;
  _limit constant int := 10;
BEGIN
  -- All new rows in a single statement must share the same user_id
  -- (enforced by RLS which pins user_id = auth.uid()).
  SELECT user_id, count(*) INTO _uid, _incoming
    FROM new_rows
    GROUP BY user_id
    LIMIT 1;

  IF _uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- Pro users bypass the limit.
  IF public.is_user_pro(_uid) THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO _current_count FROM public.words WHERE user_id = _uid;
  -- _current_count already includes the newly inserted rows at AFTER time.
  IF _current_count > _limit THEN
    RAISE EXCEPTION
      'Free plan limit reached: you can save up to % words. Upgrade to Lexikon Pro for unlimited words.',
      _limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_words_enforce_free_limit
  AFTER INSERT ON public.words
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.enforce_free_word_limit();
