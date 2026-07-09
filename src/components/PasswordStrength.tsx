import { useMemo } from "react";
import { Check, X } from "lucide-react";

interface PasswordStrengthProps {
  password: string;
  /** Set true once the backend has rejected this password (e.g. HIBP breach hit). */
  serverRejected?: boolean;
}

export type PasswordChecks = {
  length: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
  special: boolean;
};

export function evaluatePassword(pw: string): PasswordChecks {
  return {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /\d/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
}

export function passesAllChecks(pw: string): boolean {
  const c = evaluatePassword(pw);
  return c.length && c.upper && c.lower && c.number && c.special;
}

const COMMON = [
  "password", "welcome", "qwerty", "letmein", "admin", "iloveyou",
  "123456", "12345678", "abc123", "monkey", "dragon", "football",
  "baseball", "master", "shadow", "superman", "batman", "trustno1",
];

function isObviouslyWeak(pw: string): boolean {
  const l = pw.toLowerCase();
  if (COMMON.some((w) => l.includes(w))) return true;
  if (/^(.)\1+$/.test(pw)) return true; // aaaaaaa
  if (/^(0123|1234|2345|3456|4567|5678|6789|7890|abcd|qwer|asdf)/i.test(pw)) return true;
  return false;
}

type Level = { label: "Weak" | "Medium" | "Strong"; filled: 1 | 2 | 3; bar: string; text: string };

function levelFor(pw: string, serverRejected: boolean): Level {
  const c = evaluatePassword(pw);
  const passedCount = Object.values(c).filter(Boolean).length;
  const all = passesAllChecks(pw);

  if (serverRejected || isObviouslyWeak(pw) || !c.length) {
    return { label: "Weak", filled: 1, bar: "bg-destructive", text: "text-destructive" };
  }
  if (all && pw.length >= 12) {
    return { label: "Strong", filled: 3, bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-500" };
  }
  if (all || passedCount >= 4) {
    return { label: "Medium", filled: 2, bar: "bg-yellow-500", text: "text-yellow-600 dark:text-yellow-500" };
  }
  return { label: "Weak", filled: 1, bar: "bg-destructive", text: "text-destructive" };
}

const Rule = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <li className={`flex items-center gap-1.5 text-xs ${ok ? "text-emerald-600 dark:text-emerald-500" : "text-muted-foreground"}`}>
    {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
    <span>{children}</span>
  </li>
);

const PasswordStrength = ({ password, serverRejected = false }: PasswordStrengthProps) => {
  const checks = useMemo(() => evaluatePassword(password), [password]);
  const level = useMemo(() => levelFor(password, serverRejected), [password, serverRejected]);
  const segments = 3;

  return (
    <div className="mt-2 space-y-2" aria-live="polite">
      <div
        className="flex gap-1"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={segments}
        aria-valuenow={password ? level.filled : 0}
      >
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              password && i < level.filled ? level.bar : "bg-muted"
            }`}
          />
        ))}
      </div>
      {password && (
        <p className={`text-xs ${level.text}`}>
          Password strength: <span className="font-medium">{level.label}</span>
          {serverRejected && level.label === "Weak" && (
            <span className="text-muted-foreground"> — found in a data breach</span>
          )}
        </p>
      )}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
        <Rule ok={checks.length}>Minimum 8 characters</Rule>
        <Rule ok={checks.upper}>Uppercase letter</Rule>
        <Rule ok={checks.lower}>Lowercase letter</Rule>
        <Rule ok={checks.number}>Number</Rule>
        <Rule ok={checks.special}>Special character</Rule>
      </ul>
    </div>
  );
};

export default PasswordStrength;
