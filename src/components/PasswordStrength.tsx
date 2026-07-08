import { useMemo } from "react";

interface PasswordStrengthProps {
  password: string;
}

type Strength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  // Tailwind classes using semantic tokens / supported palette
  barClass: string;
  textClass: string;
};

const evaluate = (pw: string): Strength => {
  if (!pw) {
    return { score: 0, label: "Empty", barClass: "bg-muted", textClass: "text-muted-foreground" };
  }

  // Length is the dominant signal; short passwords are always weak regardless of variety.
  if (pw.length < 8) {
    return { score: 1, label: "Too short", barClass: "bg-destructive", textClass: "text-destructive" };
  }

  let score = 0;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  // Common / obviously-guessable patterns → cap at Fair
  const lowered = pw.toLowerCase();
  const common = /^(password|welcome|qwerty|letmein|admin|iloveyou|123456|abc123|monkey|dragon)/i;
  if (common.test(lowered) || /^(.)\1+$/.test(pw) || /^(0123|1234|2345|3456|4567|5678|6789|7890)/.test(pw)) {
    return { score: 2, label: "Fair — easily guessed", barClass: "bg-amber-500", textClass: "text-amber-600 dark:text-amber-500" };
  }

  const final = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;

  switch (final) {
    case 0:
    case 1:
      return { score: 1, label: "Weak", barClass: "bg-destructive", textClass: "text-destructive" };
    case 2:
      return { score: 2, label: "Fair", barClass: "bg-amber-500", textClass: "text-amber-600 dark:text-amber-500" };
    case 3:
      return { score: 3, label: "Good", barClass: "bg-yellow-500", textClass: "text-yellow-600 dark:text-yellow-500" };
    case 4:
      return { score: 4, label: "Strong", barClass: "bg-emerald-500", textClass: "text-emerald-600 dark:text-emerald-500" };
  }
};

const PasswordStrength = ({ password }: PasswordStrengthProps) => {
  const { score, label, barClass, textClass } = useMemo(() => evaluate(password), [password]);
  const segments = 4;

  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={segments} aria-valuenow={score}>
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < score ? barClass : "bg-muted"
            }`}
          />
        ))}
      </div>
      {password && (
        <p className={`mt-1 text-xs ${textClass}`}>
          Password strength: <span className="font-medium">{label}</span>
        </p>
      )}
    </div>
  );
};

export default PasswordStrength;
