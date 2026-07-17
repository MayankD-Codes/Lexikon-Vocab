# Lexikon — Full Rebuild Spec

Lexikon is a vocabulary-learning web app: users save English words, get AI-generated
definitions/etymology/examples, run daily quizzes, build a Memory Palace, chat with
"Lexi" (AI coach), compete on a leaderboard, and upgrade to Pro via Instamojo.

This README is the complete blueprint. Hand it to Lovable (or any dev) and the app
can be rebuilt end-to-end.

---

## 1. Tech Stack

- **Frontend:** Vite 5 + React 18 + TypeScript 5, React Router, TailwindCSS 3, shadcn/ui, Sonner (toasts), TanStack Query
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions in Deno)
- **AI:** Google Gemini (`gemini-flash-latest`) via multi-key failover (`GEMINI_API_KEY`, `GEMINI_API_KEY_2..5`)
- **Payments:** Instamojo one-time Payment Links (INR). Stripe scaffolding exists but is disabled in v1.
- **Auth providers:** Email/password + Google OAuth
- **Hosting:** Vercel (frontend), Supabase (backend)

Own Supabase project used by this build: `hwxyeutnuojfbamomkit.supabase.co`.

---

## 2. Environment Variables

### Frontend `.env` (Vite)
```
VITE_SUPABASE_PROJECT_ID="hwxyeutnuojfbamomkit"
VITE_SUPABASE_URL="https://hwxyeutnuojfbamomkit.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon/publishable key from Supabase → Settings → API>"

# Optional Instamojo link overrides (fallbacks live in src/lib/billing.ts)
VITE_INSTAMOJO_MONTHLY_LINK=https://imjo.in/S9NDB4
VITE_INSTAMOJO_QUARTERLY_LINK=https://imjo.in/Zd3BDM
VITE_INSTAMOJO_YEARLY_LINK=https://imjo.in/qQbXfY
```

### Supabase Edge Function Secrets (set via `supabase secrets set`)
| Name | Purpose |
|---|---|
| `GEMINI_API_KEY`, `GEMINI_API_KEY_2..5` | Gemini API keys (rotated on quota/5xx) |
| `SUPABASE_URL` | Auto-provided by Supabase |
| `SUPABASE_ANON_KEY` | Auto-provided |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-provided; used by webhook-style functions |
| `SUPABASE_JWKS` | Auto-provided (used by `getClaims`) |
| `INSTAMOJO_API_KEY` | Only if you enable Instamojo webhook verification |
| `INSTAMOJO_AUTH_TOKEN` | Same as above |
| `INSTAMOJO_SALT` | For payload signature check |
| `STRIPE_SECRET_KEY` | Reserved (Stripe not in production v1) |
| `STRIPE_WEBHOOK_SECRET` | Reserved |

---

## 3. Database Schema (Postgres / Supabase `public` schema)

Every `CREATE TABLE` is followed by `GRANT` statements and RLS policies scoped to
`auth.uid()`. Timestamps `created_at` / `updated_at` on every table (updated_at via
trigger `update_updated_at_column`).

### Tables

**`profiles`** — one row per user (created by `handle_new_user` trigger on `auth.users`)
- `user_id uuid PK → auth.users`, `username citext UNIQUE`, `display_name text`, `avatar_url text`
- RLS: users read/update own row; `SELECT` allowed via `get_profile_by_username` RPC for lookups.

**`words`** — user's saved vocabulary
- `id uuid`, `user_id uuid`, `word text`, `pronunciation`, `spelling`, `meaning_english`, `meaning_hindi`, `part_of_speech`, `word_forms`, `example_sentence`, `synonyms`, `antonyms`, `notes`, `source`
- RLS: full CRUD scoped to `user_id = auth.uid()`.
- **Free plan limit:** trigger `enforce_free_word_limit` (statement-level AFTER INSERT) blocks inserts once a free user has > 10 words. Pro bypasses via `is_user_pro(user_id)`.

**`word_stats`** — per-word quiz counters (`correct_count`, `incorrect_count`, `last_seen_at`, `streak`).

**`quiz_sessions`** — `quiz_date`, `score`, `total_questions`, `duration_seconds`, `completed`. Feeds `get_leaderboard()` and `get_learner_quiz_history()`.

**`memory_palace_anchors`** — 5 fixed anchors per user (`name`, `anchor_order`, `style`).
**`memory_palace_placements`** — `word_id`, `anchor_id`, `imagery_text`, `status` ('active'|'stable'|'archived'), `recall_correct/incorrect`.
- Trigger `validate_memory_palace_placement` enforces max 2 active per anchor and 10 active total.

**`community_messages`** — `content` (ASCII only, ≤500 chars) via `validate_community_message` trigger.

**`user_subscriptions`** (payments)
- `user_id`, `plan` ('free'|'pro'), `subscription_status` ('active'|'trialing'|'manual'|'canceled'|'past_due'),
  `provider` ('stripe'|'instamojo'|'manual'), `provider_customer_id`, `provider_subscription_id`,
  `provider_payment_id`, `interval` ('monthly'|'quarterly'|'yearly'), `amount_paid`, `currency`,
  `current_period_start`, `current_period_end`, `cancel_at_period_end`.
- Only the user reads their own row; writes are server-only (service_role).

**`payment_events`** — raw provider events (idempotency).
**`stripe_processed_events`** — Stripe event dedupe.
**`payment_verification_requests`** — user-submitted Instamojo payment IDs for admin approval:
- `user_id`, `plan_interval`, `payment_id`, `amount`, `status` ('pending'|'approved'|'rejected'), `admin_notes`.
- User inserts their own row; user/admin reads own; admin (service_role) approves.

### Enums
- `app_role` = `('admin','moderator','user')` (used with a `user_roles` table if you add admins).

### Security Definer Functions
- `is_user_pro(uuid) → boolean` — used by trigger and UI.
- `has_role(uuid, app_role)` — role check pattern.
- `get_leaderboard()`, `get_learner_quiz_history(uuid, int)`
- `get_memory_palace_anchors(uuid)`, `get_memory_palace_active(uuid)`, `get_unplaced_words(uuid)`
- `get_community_messages(int)`, `get_profile_by_username(text)`, `is_username_available(text)`
- `handle_new_user()` (trigger on `auth.users` AFTER INSERT) creates the `profiles` row.
- `update_updated_at_column()` (BEFORE UPDATE trigger on every table with `updated_at`).

### Storage
- **Bucket `avatars`** — public. Path convention: `avatars/{user_id}/{filename}`. RLS: users can upload/replace/delete own folder; anyone can read.

---

## 4. Authentication

- **Providers:** Email/password + Google OAuth.
- Google is configured in Supabase → Auth → Providers with Google Cloud OAuth Client ID/Secret. Authorized redirect URI = `https://hwxyeutnuojfbamomkit.supabase.co/auth/v1/callback`. Site URL and Additional Redirect URLs in Supabase must include your Vercel domain(s) and `http://localhost:8080`.
- No anonymous sign-ups. Email confirmation ON.
- On sign-in, frontend calls `supabase.auth.signInWithOAuth({provider:'google', options:{redirectTo: `${window.location.origin}/auth/callback`}})`.
- `/auth/callback` page hydrates session then redirects to intended `next` param or `/dashboard`.
- `AuthContext` (`src/contexts/AuthContext.tsx`) listens to `onAuthStateChange` and detects session expiry to toast the user.
- `ProtectedRoute` gates all app routes; unauthenticated users bounce to `/auth`.

Password requirements: enable **HIBP leaked-password check** in Supabase Auth settings.

---

## 5. Frontend Routes (`src/App.tsx`)

Public: `/`, `/auth`, `/auth/callback`, `/reset-password`, `/pricing`, `/payment-success`, `/payment-cancelled`, `/u/:username`.
Protected (inside `AppLayout` with sidebar):
- `/dashboard` — stats + recent words
- `/dictionary` — full word list, Excel/CSV import & export
- `/add-word` — manual add + "Lexi Fill" (calls `lexi-fill-word`)
- `/capture-word` — camera/upload → `lexi-scan-word` extracts words for bulk save
- `/word/:id` — detail + "Ask Lexi" (calls `lexi-explain-word`, streaming)
- `/edit-word/:id`
- `/quiz` — daily quiz, writes `quiz_sessions` + updates `word_stats`
- `/memory-palace` — anchors/placements + imagery from `memory-palace-guide`
- `/community` — chat wall
- `/leaderboard` — `get_leaderboard()` RPC
- `/profile` — profile edit, avatar upload to `avatars` bucket, subscription status

Global: `LexiChat` floating widget on every protected page, calls `lexi-chat` (SSE).

Design system: shadcn tokens in `src/index.css`; never hardcode colors. Dark/light via `ThemeProvider`.

---

## 6. Business Logic

### Free vs Pro
- **Free:** up to 10 saved words; all other features (quiz, palace, Lexi, community, leaderboard) work.
- **Pro:** unlimited words + Excel/CSV import + Capture Word + Memory Palace imagery + unlimited Lexi.

Enforcement points:
- DB trigger `enforce_free_word_limit` (last line of defense).
- Frontend guard `src/lib/wordLimit.ts` used by `AddWord`, `CaptureWord` (bulk), `Dictionary` (import).
- `useSubscription()` hook returns `{ isPro, plan, status, periodEnd, ... }`.

### Payments (Instamojo v1)
Plans (`src/lib/billing.ts`):
| Plan | Price | Duration | Link |
|---|---|---|---|
| Monthly | ₹499 | 30 days | https://imjo.in/S9NDB4 |
| Quarterly | ₹1,299 | 90 days | https://imjo.in/Zd3BDM |
| Yearly | ₹3,999 | 365 days | https://imjo.in/qQbXfY |

Flow:
1. User picks plan on `/pricing` → redirected to Instamojo hosted page.
2. Instamojo redirects to `/payment-success` after payment.
3. User submits Instamojo payment ID + plan on that page → inserts into `payment_verification_requests`.
4. Admin approves: sets `user_subscriptions.plan='pro'`, `subscription_status='manual'`, `provider='instamojo'`, `current_period_end = now() + durationDays`.
5. `is_user_pro()` returns true while `current_period_end > now()`.

(Stripe webhook + `create-checkout-session` code is retained for future automation.)

---

## 7. Edge Functions (Deno, in `supabase/functions/`)

All import CORS headers, call `requireUser` from `_shared/auth.ts` for auth (except public webhooks), and use `_shared/gemini.ts` for multi-key Gemini failover with structured JSON output.

| Function | Purpose | Auth | Streaming |
|---|---|---|---|
| `lexi-chat` | Lexi conversational assistant | required | SSE |
| `lexi-explain-word` | Deep dive for a saved word | required | SSE |
| `lexi-fill-word` | Auto-fill dictionary entry (JSON schema) | required | no |
| `lexi-scan-word` | Extract vocabulary words from a photo | required | no |
| `memory-palace-guide` | Generate imagery text for word ↔ anchor | required | no |
| `create-checkout-session` | (Reserved) Stripe checkout | required | no |
| `stripe-webhook` | (Reserved) Stripe webhook handler | `verify_jwt=false` | no |

`supabase/config.toml` only overrides `verify_jwt` for `stripe-webhook`.

---

## 8. Key Files

```
src/
  App.tsx                     # routes
  contexts/AuthContext.tsx    # session + expiry toast
  components/AppLayout.tsx    # sidebar shell
  components/LexiChat.tsx     # floating AI chat
  components/ProtectedRoute.tsx
  hooks/useSubscription.ts    # Pro/Free state
  lib/billing.ts              # plans + Instamojo links
  lib/wordLimit.ts            # free-plan guard
  lib/lexi.ts                 # edge-function invokers
  lib/quiz.ts                 # quiz builder
  integrations/supabase/{client.ts, types.ts}
  pages/… (see route list)
supabase/
  functions/…                 # edge functions
  migrations/…                # ordered SQL (single source of truth)
  config.toml                 # project_id + per-function overrides
```

---

## 9. Rebuild-From-Scratch Checklist

1. Create Vite React TS project, install shadcn/ui, tailwind, react-router-dom, @supabase/supabase-js, @tanstack/react-query, sonner, lucide-react, xlsx, zod.
2. Create Supabase project. Enable Google OAuth. Turn on HIBP password check. Set Site URL + redirect URLs.
3. Create `avatars` storage bucket (public) with RLS letting users write to `{user_id}/*`.
4. Run all migrations in `supabase/migrations/` in order (via `supabase db push` from a linked CLI).
5. Set all Edge Function secrets (§2).
6. Deploy edge functions (§10 below).
7. Set frontend `.env` values (§2).
8. Configure Instamojo Payment Links to redirect to `https://<your-domain>/payment-success`.
9. Deploy frontend to Vercel; add its URL to Supabase Auth redirects and to Google OAuth authorized origins.
10. Create at least one admin: insert a row into `user_roles` with `role='admin'` for your `user_id` if you want an admin UI later.

---

## 10. How to Migrate Edge Functions & Secrets to Your Supabase

You cannot pull from a Lovable-managed Supabase (no service-role or DB password
exposed). Migrate **from this repo** into your own project instead.

### Prereqs
```bash
npm i -g supabase
supabase login          # opens browser, paste your access token
```

### Link the CLI to your project
```bash
supabase link --project-ref hwxyeutnuojfbamomkit
# it will ask for the database password — paste it from
# Supabase Dashboard → Project Settings → Database → Reset/Show password
```

### Push the database schema
```bash
supabase db push        # runs every file in supabase/migrations/ in order
```
If the project already has some tables and push complains, run only the newer
migrations manually via SQL Editor, or use `supabase db diff` to reconcile.

### Deploy every edge function
```bash
# one-shot deploy everything under supabase/functions/
for fn in lexi-chat lexi-explain-word lexi-fill-word lexi-scan-word \
          memory-palace-guide create-checkout-session stripe-webhook; do
  supabase functions deploy "$fn" --project-ref hwxyeutnuojfbamomkit
done
```
`supabase/config.toml` in the repo already sets `verify_jwt=false` for
`stripe-webhook`; the CLI honours that on deploy. All other functions verify JWTs
in code (`requireUser`), so leave their defaults.

### Set edge-function secrets
```bash
supabase secrets set \
  GEMINI_API_KEY=xxxx \
  GEMINI_API_KEY_2=xxxx \
  GEMINI_API_KEY_3=xxxx \
  GEMINI_API_KEY_4=xxxx \
  GEMINI_API_KEY_5=xxxx \
  INSTAMOJO_API_KEY=xxxx \
  INSTAMOJO_AUTH_TOKEN=xxxx \
  INSTAMOJO_SALT=xxxx \
  STRIPE_SECRET_KEY=sk_test_xxx \
  STRIPE_WEBHOOK_SECRET=whsec_xxx \
  --project-ref hwxyeutnuojfbamomkit

supabase secrets list --project-ref hwxyeutnuojfbamomkit   # verify
```
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and
`SUPABASE_JWKS` are auto-injected into every function — do not set them.

### If you need to copy secrets *out of* the old Lovable-managed project
Lovable Cloud does not expose secret **values** through any tool. You must:
1. Open the third-party dashboards where they came from (Google AI Studio for
   Gemini keys, Instamojo dashboard for its keys, Stripe dashboard for Stripe
   keys) and copy the values from there.
2. Paste them into `supabase secrets set` against your own project.

If a key can't be retrieved from the origin service, rotate/create a new one
there — cheaper than trying to extract it from Lovable.

### Verify
```bash
# 1. Call a function with a valid user JWT (get one by logging into the app)
curl -X POST https://hwxyeutnuojfbamomkit.supabase.co/functions/v1/lexi-fill-word \
  -H "Authorization: Bearer <user-access-token>" \
  -H "Content-Type: application/json" \
  -d '{"word":"ephemeral"}'

# 2. Check function logs
supabase functions logs lexi-fill-word --project-ref hwxyeutnuojfbamomkit
```

---

## 11. Known Gotchas

- **Every new public table needs GRANTs** in the same migration (`authenticated`, plus `service_role`; `anon` only when policy allows). Without them PostgREST returns permission errors.
- Don't hardcode colors — use design tokens in `src/index.css`.
- Google OAuth `redirectTo` must be a full same-origin URL, not a protected route.
- `handle_new_user` trigger lives on `auth.users`; verify it exists after restoring — it's created via a migration in this repo.
- `enforce_free_word_limit` is a **statement-level** trigger using a `new_rows` transition table — needed so bulk inserts (imports) are counted atomically.
