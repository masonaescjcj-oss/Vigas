import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, asAppError } from "./errorHandler.ts";

export interface UsageMeter {
  tokens_used: number;
  requests_count: number;
  plan_limit_tokens: number;
  period_start: string;
  period_end: string;
}

/**
 * Free Build runs per day. Asking a question is free and unmetered — talking to
 * a model costs us nothing but tokens — but a Build run occupies a worker and a
 * sandbox, and those are ours to pay for whoever supplied the model key.
 */
export const FREE_BUILD_RUNS_PER_DAY = 4;

/**
 * Whether a Build run may start. Deliberately separate from token metering:
 * this is about our infrastructure, not the model, so bringing your own API key
 * does not lift it.
 */
export function evaluateBuildQuota(
  tier: "free" | "pro" | "team",
  runsToday: number,
): { allowed: boolean; remaining: number } {
  if (tier !== "free") return { allowed: true, remaining: Number.POSITIVE_INFINITY };
  const remaining = Math.max(0, FREE_BUILD_RUNS_PER_DAY - runsToday);
  return { allowed: remaining > 0, remaining };
}

export function evaluateUsage(
  tier: "free" | "pro" | "team",
  meter: UsageMeter,
  now = new Date(),
): { allowed: true; remainingTokens: number } | { allowed: false; remainingTokens: 0 } {
  if (tier !== "free") return { allowed: true, remainingTokens: Math.max(0, meter.plan_limit_tokens - meter.tokens_used) };
  const active = new Date(meter.period_start) <= now && new Date(meter.period_end) > now;
  if (!active || meter.tokens_used < meter.plan_limit_tokens) {
    return { allowed: true, remainingTokens: Math.max(0, meter.plan_limit_tokens - meter.tokens_used) };
  }
  return { allowed: false, remainingTokens: 0 };
}

export async function checkUsage(service: SupabaseClient, userId: string): Promise<{ tier: string; meter: UsageMeter }> {
  const [{ data: profile, error: profileError }, { data: meter, error: meterError }] = await Promise.all([
    service.from("profiles").select("subscription_tier").eq("id", userId).maybeSingle(),
    service.from("usage_metering").select("tokens_used,requests_count,plan_limit_tokens,period_start,period_end")
      .eq("user_id", userId).lte("period_start", new Date().toISOString()).gt("period_end", new Date().toISOString())
      .order("period_start", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (profileError) asAppError(profileError, "Loading subscription tier");
  if (meterError) asAppError(meterError, "Loading usage meter");
  if (!profile) throw new AppError(404, "PROFILE_NOT_FOUND", "User profile was not found.");

  let current = meter as UsageMeter | null;
  if (!current) {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 86_400_000);
    const { data, error } = await service.from("usage_metering").upsert({
      user_id: userId,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      tokens_used: 0,
      requests_count: 0,
      plan_limit_tokens: 100_000,
    }, { onConflict: "user_id,period_start" }).select("tokens_used,requests_count,plan_limit_tokens,period_start,period_end").single();
    if (error || !data) asAppError(error, "Creating usage meter");
    current = data as UsageMeter;
  }
  const decision = evaluateUsage(profile.subscription_tier, current);
  if (!decision.allowed) {
    throw new AppError(429, "USAGE_LIMIT_REACHED", "سقف مصرف پلن رایگان شما پر شده است؛ برای ادامه به پلن Pro ارتقا دهید.", {
      upgrade_required: true,
      plan_limit_tokens: current.plan_limit_tokens,
      tokens_used: current.tokens_used,
      period_end: current.period_end,
    });
  }
  return { tier: profile.subscription_tier, meter: current };
}

/**
 * How many Build runs this user has started since midnight UTC. Counted from
 * job_queue rather than a counter column so it cannot drift, and so a run that
 * failed to enqueue never costs anyone an allowance.
 */
export async function buildRunsToday(service: SupabaseClient, userId: string): Promise<number> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count, error } = await service
    .from("job_queue")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());
  if (error) asAppError(error, "Counting today's runs");
  return count ?? 0;
}

/** Throws when a free user has spent their Build runs for the day. */
export async function checkBuildQuota(service: SupabaseClient, userId: string): Promise<void> {
  const { data: profile, error } = await service
    .from("profiles").select("subscription_tier").eq("id", userId).maybeSingle();
  if (error) asAppError(error, "Loading subscription tier");
  const tier = (profile?.subscription_tier ?? "free") as "free" | "pro" | "team";

  const decision = evaluateBuildQuota(tier, await buildRunsToday(service, userId));
  if (!decision.allowed) {
    throw new AppError(
      429,
      "BUILD_LIMIT_REACHED",
      `Free accounts get ${FREE_BUILD_RUNS_PER_DAY} builds a day. Chat is still unlimited, and the allowance resets at midnight UTC.`,
      { upgrade_required: true, free_builds_per_day: FREE_BUILD_RUNS_PER_DAY },
    );
  }
}

export async function recordUsage(service: SupabaseClient, userId: string, tokens: number): Promise<void> {
  const { error } = await service.rpc("record_agent_usage", { p_user_id: userId, p_tokens: Math.max(0, Math.floor(tokens)) });
  if (error) asAppError(error, "Recording agent usage");
}
