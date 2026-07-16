
-- Extend user_subscriptions for provider-agnostic model (Instamojo v1)
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_payment_id text,
  ADD COLUMN IF NOT EXISTS provider_payment_request_id text,
  ADD COLUMN IF NOT EXISTS provider_link_id text,
  ADD COLUMN IF NOT EXISTS amount_paid integer,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz;

-- Widen subscription_status to include 'expired','pending','manual'
ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_subscription_status_check;
ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_subscription_status_check
  CHECK (subscription_status IN (
    'active','trialing','past_due','canceled','unpaid',
    'incomplete','incomplete_expired','none',
    'expired','pending','manual'
  ));

-- Update is_user_pro to be provider-agnostic and honor current_period_end
CREATE OR REPLACE FUNCTION public.is_user_pro(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_subscriptions s
    WHERE s.user_id = _user_id
      AND s.plan = 'pro'
      AND s.subscription_status IN ('active','trialing','manual')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  );
$$;

-- Provider-agnostic payment events (idempotency)
CREATE TABLE IF NOT EXISTS public.payment_events (
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text,
  raw_payload jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_id)
);
GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
-- No policies → locked to service_role.

-- Manual verification requests submitted by users
CREATE TABLE IF NOT EXISTS public.payment_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'instamojo',
  payment_id text NOT NULL,
  selected_plan text NOT NULL CHECK (selected_plan IN ('monthly','quarterly','yearly')),
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

GRANT SELECT, INSERT ON public.payment_verification_requests TO authenticated;
GRANT ALL ON public.payment_verification_requests TO service_role;

ALTER TABLE public.payment_verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own verification requests"
  ON public.payment_verification_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own verification requests"
  ON public.payment_verification_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE INDEX IF NOT EXISTS idx_pvr_user ON public.payment_verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_pvr_status ON public.payment_verification_requests(status);
