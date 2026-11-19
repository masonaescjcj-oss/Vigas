/**
 * frontend/src/core/billing/plans.ts
 * ---------------------------------------------------------------------------
 * The plans as the app draws them.
 *
 * These prices are for display only. The server keeps its own copy in
 * shared/checkout.ts and charges from that, so a client that has drifted shows
 * a wrong number but cannot cause a wrong charge — the amount is never sent
 * from here, only the plan's key.
 *
 * They still have to match. A user who is shown $8 and billed $12 will not care
 * which copy was authoritative.
 * ---------------------------------------------------------------------------
 */

export interface DisplayPlan {
  /** Must match a key in the server's PLAN_PRICES. */
  id: string;
  title: string;
  priceString: string;
  period: string;
  savings?: string;
}

export const DISPLAY_PLANS: DisplayPlan[] = [
  {
    id: "pro_yearly",
    title: "Pro, yearly",
    priceString: "$96",
    period: "per year",
    // 12 × $12 is $144, so a year saves $48.
    savings: "Save $48",
  },
  {
    id: "pro_monthly",
    title: "Pro, monthly",
    priceString: "$12",
    period: "per month",
  },
];
