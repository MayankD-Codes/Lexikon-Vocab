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

// Env override support (VITE_INSTAMOJO_*_LINK) with production defaults.
const LINK_MONTHLY =
  import.meta.env.VITE_INSTAMOJO_MONTHLY_LINK || "https://imjo.in/S9NDB4";
const LINK_QUARTERLY =
  import.meta.env.VITE_INSTAMOJO_QUARTERLY_LINK || "https://imjo.in/Zd3BDM";
const LINK_YEARLY =
  import.meta.env.VITE_INSTAMOJO_YEARLY_LINK || "https://imjo.in/qQbXfY";

export const PLAN_OPTIONS: PlanOption[] = [
  {
    interval: "monthly",
    label: "Monthly",
    price: "₹499",
    cadence: "per month",
    paymentLink: LINK_MONTHLY,
    durationDays: 30,
  },
  {
    interval: "quarterly",
    label: "Quarterly",
    price: "₹1,299",
    cadence: "every 3 months",
    perMonth: "≈ ₹433 / mo",
    paymentLink: LINK_QUARTERLY,
    durationDays: 90,
  },
  {
    interval: "yearly",
    label: "Yearly",
    price: "₹3,999",
    cadence: "per year",
    perMonth: "≈ ₹333 / mo",
    paymentLink: LINK_YEARLY,
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
