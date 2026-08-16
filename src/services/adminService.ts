/**
 * frontend/src/services/adminService.ts
 * ---------------------------------------------------------------------------
 * The operator's panel, over one endpoint.
 *
 * Every call goes to `admin`, which checks the is_admin flag against the
 * database before doing anything. A non-admin gets 404 rather than 403, so
 * these functions surface "Not found" — that is deliberate, not a bug.
 *
 * API keys are write-only, as everywhere else in this app: a key goes up once
 * and never comes back. Nothing here can show one, because the backend cannot.
 * ---------------------------------------------------------------------------
 */

import { invokeFunction } from "./functionsClient";

export interface PoolKeySummary {
  id: string;
  label: string;
  base_url: string;
  /** Last four characters, so two keys from one site can be told apart. */
  key_last4: string;
  model: string | null;
  /** Lower runs first. Keys sharing a priority rotate between themselves. */
  priority: number;
  is_active: boolean;
  last_used_at: string | null;
  last_ok_at: string | null;
  last_error: string | null;
  failure_count: number;
  /** Set while the key is resting after running out of credit or being limited. */
  exhausted_at: string | null;
  created_at: string;
}

export interface ModelRow {
  id: string;
  display_name: string;
  description: string | null;
  tone: "brandPrimary" | "success" | "warning" | "failed";
  icon: string;
  min_tier: string | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface PlanRow {
  key: string;
  display_name: string;
  /** Null means unlimited — not "unset". */
  build_runs_per_day: number | null;
  token_limit_per_day: number | null;
  max_projects: number | null;
  price_label: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface AdminOverview {
  users_total: number;
  users_by_tier: Record<string, number>;
  active_subscriptions: number;
  builds_last_30_days: number;
  tokens_last_30_days: number;
  revenue_note: string;
}

export interface KeyTestResult {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

const call = <T,>(body: Record<string, unknown>) => invokeFunction<T>("admin", { body });

/* ---- The key pool -------------------------------------------------------- */

export const listKeys = () =>
  call<{ keys: PoolKeySummary[] }>({ action: "keys.list" }).then((r) => r.keys ?? []);

/**
 * The backend probes the provider before storing, but stores either way — with
 * a failed probe recorded as the reason. Adding twenty keys should not mean
 * twenty rejections to fight through.
 */
export const addKey = (input: {
  label: string;
  baseUrl: string;
  apiKey: string;
  model?: string;
  priority?: number;
}) =>
  call<{ key: PoolKeySummary; verified: boolean; detail: string }>({
    action: "keys.add",
    label: input.label.trim(),
    baseUrl: input.baseUrl.trim(),
    apiKey: input.apiKey.trim(),
    ...(input.model?.trim() ? { model: input.model.trim() } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
  });

export const updateKey = (
  id: string,
  patch: { label?: string; priority?: number; model?: string | null; isActive?: boolean },
) => call<{ key: PoolKeySummary }>({ action: "keys.update", id, ...patch });

export const deleteKey = (id: string) => call<{ ok: true }>({ action: "keys.delete", id });

export const testKey = (id: string) =>
  call<{ result: KeyTestResult }>({ action: "keys.test", id }).then((r) => r.result);

/** Tested one at a time server-side — twenty at once is how you get rate limited. */
export const testAllKeys = () =>
  call<{ results: KeyTestResult[] }>({ action: "keys.testAll" }).then((r) => r.results ?? []);

/* ---- Models -------------------------------------------------------------- */

export const listModels = () =>
  call<{ models: ModelRow[] }>({ action: "models.list" }).then((r) => r.models ?? []);

export const saveModel = (model: {
  modelId: string;
  displayName: string;
  description?: string | null;
  tone?: ModelRow["tone"];
  icon?: string;
  minTier?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}) => call<{ model: ModelRow }>({ action: "models.upsert", ...model });

export const deleteModel = (modelId: string) =>
  call<{ ok: true }>({ action: "models.delete", modelId });

/* ---- Plans --------------------------------------------------------------- */

export const listPlans = () =>
  call<{ plans: PlanRow[] }>({ action: "plans.list" }).then((r) => r.plans ?? []);

export const updatePlan = (
  planKey: string,
  patch: {
    displayName?: string;
    buildRunsPerDay?: number | null;
    tokenLimitPerDay?: number | null;
    maxProjects?: number | null;
    priceLabel?: string | null;
    isActive?: boolean;
  },
) => call<{ plan: PlanRow }>({ action: "plans.update", planKey, ...patch });

/* ---- Overview ------------------------------------------------------------ */

export const fetchOverview = () => call<AdminOverview>({ action: "overview" });

// Presentation helpers are pure and live in ./adminFormat so they can be
// tested without a Supabase client.
export { healthLabel, keyHealth, limitLabel, parseLimit, type KeyHealth } from "./adminFormat";
