/** Gathr Premium duration plans (one-time purchases, no silent auto-renewal). */

export type PlanId = "m1" | "m3" | "m6" | "m12";

export type PremiumPlan = {
  id: PlanId;
  label: string;
  months: number;
  priceInr: number;
  /** Bonus points credited immediately on purchase. */
  bonusPoints: number;
  /** Free event boost credits granted on purchase. */
  boosts: number;
  /** Grants the unique "Founding Member" badge. */
  founding: boolean;
  bestValue?: boolean;
};

export const PREMIUM_PLANS: PremiumPlan[] = [
  { id: "m1", label: "1 Month", months: 1, priceInr: 79, bonusPoints: 0, boosts: 0, founding: false },
  { id: "m3", label: "3 Months", months: 3, priceInr: 149, bonusPoints: 50, boosts: 0, founding: false },
  { id: "m6", label: "6 Months", months: 6, priceInr: 249, bonusPoints: 150, boosts: 1, founding: false },
  { id: "m12", label: "1 Year", months: 12, priceInr: 399, bonusPoints: 400, boosts: 3, founding: true, bestValue: true },
];

export function getPlan(id: string): PremiumPlan | undefined {
  return PREMIUM_PLANS.find((p) => p.id === id);
}

/** Rounded per-month equivalent, used to show savings on longer plans. */
export function perMonth(plan: PremiumPlan): number {
  return Math.round(plan.priceInr / plan.months);
}

export function planPerks(plan: PremiumPlan): string[] {
  const out: string[] = [];
  if (plan.bonusPoints) out.push(`+${plan.bonusPoints} bonus points`);
  if (plan.boosts) out.push(`${plan.boosts} free event boost${plan.boosts > 1 ? "s" : ""}`);
  if (plan.founding) out.push(`"Founding Member" badge`);
  return out;
}
