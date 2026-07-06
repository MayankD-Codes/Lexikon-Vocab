// Canonical production URL for auth redirects.
// Supabase requires an absolute URL; we use the deployed Vercel origin so
// email verification / password reset / magic links always return here,
// regardless of where the user signed up from (preview, localhost, etc.).
export const SITE_URL = "https://lexikon-vocab.vercel.app";

export const authCallbackUrl = (next?: string) => {
  const base = `${SITE_URL}/auth/callback`;
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
};
