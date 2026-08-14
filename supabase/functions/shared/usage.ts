import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, asAppError } from "./errorHandler.ts";

export interface UsageMeter {
  tokens_used: number;
  requests_count: number;
  plan_limit_tokens: number;
  period_start: string;
  period_end: string;
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

export async function recordUsage(service: SupabaseClient, userId: string, tokens: number): Promise<void> {
  const { error } = await service.rpc("record_agent_usage", { p_user_id: userId, p_tokens: Math.max(0, Math.floor(tokens)) });
  if (error) asAppError(error, "Recording agent usage");
}
