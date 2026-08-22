/**
 * frontend/src/core/models/tiering.ts
 * ---------------------------------------------------------------------------
 * Which models a given account may pick, and how each one is labelled.
 *
 * The `models` table carries `min_tier` and the admin panel edits it; this turns
 * those rows into something a picker can render — a free/premium label and a
 * locked flag — without the screen having to know about plan ordering.
 *
 * Kept free of react-native and supabase imports so the rules can be tested
 * directly. The fetch lives in services/modelCatalog.ts.
 * ---------------------------------------------------------------------------
 */

/** The colour tokens a model may ask for. Anything else falls back. */
const TONES = ["brandPrimary", "success", "warning"] as const;
export type ModelTone = (typeof TONES)[number];

/** A row as it comes back from the models table. */
export interface ModelRow {
  id: string;
  display_name: string;
  description?: string | null;
  tone?: string | null;
  icon?: string | null;
  min_tier?: string | null;
  is_default?: boolean | null;
  is_active?: boolean | null;
  sort_order?: number | null;
}

/** A row as it comes back from the plans table. */
export interface PlanRow {
  key: string;
  display_name: string;
  sort_order: number;
}

export interface CatalogModel {
  id: string;
  name: string;
  description: string;
  tone: ModelTone;
  icon: string;
  isDefault: boolean;
  /** null when the model is free for everyone. */
  minTier: string | null;
  /** True when this account's plan does not reach minTier. */
  locked: boolean;
  /**
   * What the picker prints on the badge: "FREE", or the plan's display name for
   * anything gated. Never a raw key — "pro" is not what a user calls their plan.
   */
  badge: string;
}

/**
 * The always-present first entry.
 *
 * Not a table row: "auto" means "server decides", so it cannot be gated and
 * cannot be switched off without leaving the picker with no safe default.
 */
export const AUTO_MODEL: CatalogModel = {
  id: "auto",
  name: "Auto",
  description: "Let the server pick the default model",
  tone: "warning",
  icon: "zap",
  isDefault: false,
  minTier: null,
  locked: false,
  badge: "FREE",
};

function toneOf(value: unknown): ModelTone {
  return TONES.includes(value as ModelTone) ? (value as ModelTone) : "brandPrimary";
}

/**
 * Rank of the plan an account holds. Unknown ranks lowest.
 *
 * A typo or a removed plan on someone's profile must not read as "top tier".
 */
export function heldRank(plans: PlanRow[], key: string | null | undefined): number {
  if (!key) return 0;
  const plan = plans.find((entry) => entry.key === key);
  return plan ? Number(plan.sort_order) : 0;
}

/**
 * Rank a model demands. Unknown ranks *highest*.
 *
 * The opposite of heldRank, and deliberately so — both directions have to fail
 * closed. A model gated on a plan that has since been deleted would otherwise
 * rank 0, tie with the free tier, and quietly become free for everyone: exactly
 * the paid model given away that this whole mechanism exists to prevent.
 */
export function requiredRank(plans: PlanRow[], key: string | null | undefined): number {
  if (!key) return 0;
  const plan = plans.find((entry) => entry.key === key);
  return plan ? Number(plan.sort_order) : Number.POSITIVE_INFINITY;
}

/**
 * Turn catalogue rows into picker entries for one account.
 *
 * Inactive rows are dropped rather than shown as locked: switched off is an
 * operator decision about the model, not a statement about this user's plan, and
 * showing it would advertise an upgrade that buys nothing.
 *
 * @param tier The viewer's plan key, e.g. "free".
 */
export function decorateModels(
  models: ModelRow[],
  plans: PlanRow[],
  tier: string,
): CatalogModel[] {
  const held = heldRank(plans, tier);

  const decorated = models
    .filter((row) => row.is_active !== false)
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
    .map((row) => {
      const minTier = row.min_tier ?? null;
      const required = requiredRank(plans, minTier);
      // Compared by rank, not equality, so Ultra also gets everything Pro has.
      const locked = required > held;
      const planName = plans.find((entry) => entry.key === minTier)?.display_name;
      return {
        id: row.id,
        name: row.display_name,
        description: row.description ?? "",
        tone: toneOf(row.tone),
        icon: row.icon ?? "zap",
        isDefault: row.is_default === true,
        minTier,
        locked,
        // A gated model with no matching plan row still reads as gated: falling
        // back to the key is ugly, but calling it FREE would be a lie.
        badge: minTier ? (planName ?? minTier).toUpperCase() : "FREE",
      };
    });

  return [AUTO_MODEL, ...decorated];
}
