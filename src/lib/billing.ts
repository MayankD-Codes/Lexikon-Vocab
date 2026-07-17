// Centralized subscription/billing config for Lexikon.
// Payment provider (v1): Instamojo one-time Payment Links.
// Instamojo links are one-time, not recurring — each payment grants Pro access
// for a fixed duration (30 / 90 / 365 days) tracked via current_period_end.

export type BillingInterval = "monthly" | "quarterly" | "yearly";

export interface PlanOption {
  interval: BillingInterval;
  label: string;
  price: string;
  cadence: string;
  paymentLink: string;
  perMonth?: string;
  bestValue?: boolean;
  durationDays: number;
}

export const FREE_WORD_LIMIT = 10;

const trimLink = (value: string | undefined, fallback: string) => value?.trim() || fallback;

// Env override support (VITE_INSTAMOJO_*_LINK) with production defaults.
export const INSTAMOJO_LINKS = {
  monthly: trimLink(import.meta.env.VITE_INSTAMOJO_MONTHLY_LINK, "https://imjo.in/S9NDB4"),
  quarterly: trimLink(import.meta.env.VITE_INSTAMOJO_QUARTERLY_LINK, "https://imjo.in/Zd3BDM"),
  yearly: trimLink(import.meta.env.VITE_INSTAMOJO_YEARLY_LINK, "https://imjo.in/qQbXfY"),
} as const;

export const PLAN_OPTIONS: PlanOption[] = [
  {
    interval: "monthly",
    label: "Lexikon Pro Monthly",
    price: "₹499",
    cadence: "30 days access",
    paymentLink: INSTAMOJO_LINKS.monthly,
    durationDays: 30,
  },
  {
    interval: "quarterly",
    label: "Lexikon Pro Quarterly",
    price: "₹1,299",
    cadence: "90 days access",
    perMonth: "≈ ₹433 / mo",
    paymentLink: INSTAMOJO_LINKS.quarterly,
    durationDays: 90,
  },
  {
    interval: "yearly",
    label: "Lexikon Pro Yearly",
    price: "₹3,999",
    cadence: "365 days access",
    perMonth: "≈ ₹333 / mo",
    paymentLink: INSTAMOJO_LINKS.yearly,
    bestValue: true,
    durationDays: 365,
  },
];

export const PRO_FEATURES = [
  "Unlimited saved vocabulary words",
  "Unlimited Excel/CSV import",
  "Ask Lexi for word details, unlimited",
  "Capture Word (photo → vocabulary)",
  "Memory Palace with imagery generation",
  "Daily Quiz, leaderboard and community",
];
