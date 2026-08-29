/**
 * supabase/functions/shared/quota.ts
 * ---------------------------------------------------------------------------
 * How much someone may do in a rolling window, and what to tell them when they
 * have done it.
 *
 * The allowance used to be per calendar day, so waiting until 23:59 bought two
 * days' worth in two minutes. A rolling window has no such edge: four in any
 * twelve hours means four, whenever you ask.
 *
 * The rules live here as pure functions and the database calls live in the
 * caller, so "what counts as over the limit" and "what does the user read" can
 * be tested without a database — including the awkward cases, which is where
 * quota code usually goes wrong.
 * ---------------------------------------------------------------------------
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "./errorHandler.ts";

export type QuotaKind = "build" | "chat";

export interface QuotaPlan {
  /** Null means unlimited, and is deliberate rather than missing data. */
  buildsPerWindow: number | null;
  chatPerWindow: number | null;
  windowHours: number;
}

/**
 * What a tier gets when the plans table cannot be read.
 *
 * Deliberately the launch limits rather than "unlimited": these callers use the
 * result to *restrict*, so a failed read must not read as permission.
 */
export const FALLBACK_FREE_PLAN: QuotaPlan = {
  buildsPerWindow: 4,
  chatPerWindow: 30,
  windowHours: 12,
};

/** How long until an allowance frees up, in words a person can act on. */
export function describeWait(nextFreeAt: Date | null, now: Date): string {
  if (!nextFreeAt) return "shortly";
  const minutes = Math.ceil((nextFreeAt.getTime() - now.getTime()) / 60_000);
  if (minutes <= 1) return "in a minute";
  if (minutes < 60) return `in ${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  return `in ${hours}h ${rest}m`;
}

/**
 * Whether one more request fits.
 *
 * @param limit Null is unlimited. Zero means none are allowed, which is not the
 *              same thing and must not be read as unlimited — the usual bug.
 */
export function withinQuota(limit: number | null, used: number): boolean {
  if (limit === null) return true;
  return used < limit;
}

/**
 * What to say to someone who has run out.
 *
 * Names the limit and the window, because "you have hit your limit" without
 * either leaves the user guessing whether to wait a minute or a day. Says
 * nothing about upgrading — see config/billing on the client for why there is
 * nothing to upgrade to yet.
 */
export function quotaMessage(
  kind: QuotaKind,
  limit: number,
  windowHours: number,
  nextFreeAt: Date | null,
  now: Date,
): string {
  const thing = kind === "build" ? (limit === 1 ? "build" : "builds") : (limit === 1 ? "message" : "messages");
  return (
    `You have used your ${limit} ${thing} for the last ${windowHours} hours. ` +
    `You can send another ${describeWait(nextFreeAt, now)}.`
  );
}

/** Read a tier's allowance, falling back to the launch limits. */
export async function planQuota(service: SupabaseClient, tier: string): Promise<QuotaPlan> {
  const { data, error } = await service
    .from("plans")
    .select("build_runs_per_window,chat_messages_per_window,quota_window_hours")
    .eq("key", tier)
    .maybeSingle();

  if (error || !data) {
    // An unmigrated or unreachable plans table must not let everyone through.
    return tier === "free" ? FALLBACK_FREE_PLAN : { buildsPerWindow: null, chatPerWindow: null, windowHours: 12 };
  }

  const row = data as {
    build_runs_per_window: number | null;
    chat_messages_per_window: number | null;
    quota_window_hours: number | null;
  };
  return {
    buildsPerWindow: row.build_runs_per_window === null ? null : Number(row.build_runs_per_window),
    chatPerWindow: row.chat_messages_per_window === null ? null : Number(row.chat_messages_per_window),
    windowHours: Number(row.quota_window_hours ?? 12),
  };
}

/**
 * Refuse the request if the window is full; otherwise let it through.
 *
 * Does not record anything: a refused request must not count against the very
 * allowance that refused it, and a request that fails later for its own reasons
 * should not have been charged either. The caller records once it has accepted.
 */
export async function enforceQuota(
  service: SupabaseClient,
  userId: string,
  kind: QuotaKind,
  plan: QuotaPlan,
  now = new Date(),
): Promise<void> {
  const limit = kind === "build" ? plan.buildsPerWindow : plan.chatPerWindow;
  if (limit === null) return;

  const { data: usedRaw, error } = await service.rpc("quota_used", {
    p_user_id: userId,
    p_kind: kind,
    p_window_hours: plan.windowHours,
  });
  // A counting failure is not permission. Letting the request through would
  // turn a database blip into an unmetered afternoon.
  if (error) {
    throw new AppError(503, "QUOTA_UNAVAILABLE", "Could not check your usage just now. Please try again.");
  }

  const used = Number(usedRaw ?? 0);
  if (withinQuota(limit, used)) return;

  const { data: nextRaw } = await service.rpc("quota_next_free_at", {
    p_user_id: userId,
    p_kind: kind,
    p_window_hours: plan.windowHours,
    p_limit: limit,
  });
  const nextFreeAt = nextRaw ? new Date(String(nextRaw)) : null;

  throw new AppError(
    429,
    kind === "build" ? "BUILD_LIMIT_REACHED" : "CHAT_LIMIT_REACHED",
    quotaMessage(kind, limit, plan.windowHours, nextFreeAt, now),
    {
      kind,
      limit,
      window_hours: plan.windowHours,
      next_free_at: nextFreeAt?.toISOString() ?? null,
    },
  );
}

/**
 * Record one accepted request.
 *
 * Never throws: the work has already been accepted, and failing the request
 * after that because bookkeeping did not land would be the wrong trade. A lost
 * row costs one extra request in the window.
 */
export async function recordQuotaEvent(
  service: SupabaseClient,
  userId: string,
  kind: QuotaKind,
): Promise<void> {
  await service.rpc("quota_record", { p_user_id: userId, p_kind: kind }).then(
    () => undefined,
    () => undefined,
  );
}
