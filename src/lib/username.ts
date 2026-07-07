// Username utilities — Instagram-style rules.
// Allowed: letters, digits, "_" and "."; length 1-30; case-insensitive.

export const USERNAME_MAX = 30;
export const USERNAME_REGEX = /^[a-zA-Z0-9._]{1,30}$/;

// Synthetic email domain used to satisfy Supabase auth (email+password backend)
// while presenting a pure username experience to users.
const USERNAME_EMAIL_DOMAIN = "users.lexikon.app";

export interface UsernameCheck {
  ok: boolean;
  normalized: string;
  reason: string;
}


export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): UsernameCheck {
  const u = normalizeUsername(raw);
  if (u.length === 0) return { ok: false, normalized: u, reason: "Username is required." };
  if (u.length > USERNAME_MAX)
    return { ok: false, normalized: u, reason: `Username must be ${USERNAME_MAX} characters or fewer.` };
  const invalid = u.match(/[^a-z0-9._]/);
  if (invalid) {
    const ch = invalid[0];
    if (ch === " ") return { ok: false, normalized: u, reason: "Spaces are not allowed." };
    if (ch === "-") return { ok: false, normalized: u, reason: "Hyphens are not allowed." };
    return { ok: false, normalized: u, reason: `The character "${ch}" is not allowed.` };
  }
  if (!USERNAME_REGEX.test(u))
    return { ok: false, normalized: u, reason: "Only letters, numbers, underscore and period are allowed." };
  return { ok: true, normalized: u, reason: "" };
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${USERNAME_EMAIL_DOMAIN}`;
}
