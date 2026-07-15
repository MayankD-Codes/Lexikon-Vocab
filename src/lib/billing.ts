// Centralized subscription/billing config.
// Payment Links are used for v1 checkout UX. For authenticated dynamic Checkout Sessions
// (with client_reference_id = user_id), the `create-checkout-session` edge function is used.

export type BillingInterval = "monthly" | "quarterly" | "yearly";

export interface PlanOption {
  interval: BillingInterval;
  label: string;
  price: string;
  cadence: string;
  paymentLink: string;
  bestValue?: boolean;
  perMonth?: string;
}

export const FREE_WORD_LIMIT = 10;

export const PLAN_OPTIONS: PlanOption[] = [
  {
    interval: "monthly",
    label: "Monthly",
    price: "$5.99",
    cadence: "per month",
    paymentLink: "https://buy.stripe.com/test_00w7sEgal9NO76g4jD1ZS00",
  },
  {
    interval: "quarterly",
    label: "Quarterly",
    price: "$14.99",
    cadence: "every 3 months",
    perMonth: "$5.00 / mo",
    paymentLink: "https://buy.stripe.com/test_fZufZa1fr5xy9eog2l1ZS01",
  },
  {
    interval: "yearly",
    label: "Yearly",
    price: "$39.99",
    cadence: "per year",
    perMonth: "$3.33 / mo",
    paymentLink: "https://buy.stripe.com/test_aFafZa2jvf882Q0aI11ZS02",
    bestValue: true,
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
