import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, asAppError } from "./errorHandler.ts";
import { RevenueCatSubscriberSchema, type RevenueCatEvent } from "./zodSchemas.ts";

const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RcStatus = "active" | "canceled" | "expired" | "grace_period";
export interface ExistingSubscription {
  status?: RcStatus;
  current_period_end?: string | null;
  grace_expires_at?: string | null;
  last_event_at?: string | null;
  last_event_id?: string | null;
  plan_id?: string | null;
}
export interface DerivedSubscription {
  status: RcStatus;
  tier: "free" | "pro";
  currentPeriodEnd: string | null;
  graceExpiresAt: string | null;
  planId: string | null;
}

function dateFromMs(value: number | null | undefined): string | null {
  return value == null ? null : new Date(value).toISOString();
}

export function deriveRevenueCatState(
  event: Pick<RevenueCatEvent, "type" | "product_id" | "expiration_at_ms" | "event_timestamp_ms"> & { grace_period_expiration_at_ms?: number | null },
  existing: ExistingSubscription | null,
  now = new Date(),
): DerivedSubscription {
  const expiration = dateFromMs(event.expiration_at_ms);
  const effectiveEnd = expiration ?? existing?.current_period_end ?? null;
  const existingGrace = existing?.grace_expires_at ? new Date(existing.grace_expires_at) : null;
  const futureGrace = existingGrace && existingGrace > now ? existingGrace.toISOString() : null;
  const futureExpiration = effectiveEnd && new Date(effectiveEnd) > now;
  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
      return { status: "active", tier: "pro", currentPeriodEnd: expiration, graceExpiresAt: null, planId: event.product_id ?? existing?.plan_id ?? null };
    case "CANCELLATION":
      if (futureGrace) return { status: "grace_period", tier: "pro", currentPeriodEnd: effectiveEnd, graceExpiresAt: futureGrace, planId: event.product_id ?? existing?.plan_id ?? null };
      return { status: "canceled", tier: futureExpiration ? "pro" : "free", currentPeriodEnd: effectiveEnd, graceExpiresAt: null, planId: event.product_id ?? existing?.plan_id ?? null };
    case "BILLING_ISSUE": {
      const grace = new Date(now.getTime() + GRACE_PERIOD_MS).toISOString();
      return { status: "grace_period", tier: "pro", currentPeriodEnd: effectiveEnd, graceExpiresAt: grace, planId: event.product_id ?? existing?.plan_id ?? null };
    }
    case "EXPIRATION":
      if (futureGrace) return { status: "grace_period", tier: "pro", currentPeriodEnd: effectiveEnd, graceExpiresAt: futureGrace, planId: event.product_id ?? existing?.plan_id ?? null };
      return { status: "expired", tier: "free", currentPeriodEnd: effectiveEnd, graceExpiresAt: null, planId: event.product_id ?? existing?.plan_id ?? null };
  }
}

function eventUserCandidates(event: RevenueCatEvent): string[] {
  return [event.app_user_id, event.original_app_user_id ?? "", ...(event.aliases ?? [])].filter((id, index, all) => UUID_RE.test(id) && all.indexOf(id) === index);
}

async function resolveUserId(service: SupabaseClient, event: RevenueCatEvent): Promise<string> {
  const ids = eventUserCandidates(event);
  if (ids.length === 0) throw new AppError(422, "REVENUECAT_USER_ID_INVALID", "RevenueCat app_user_id is not a Supabase user UUID.");
  const { data, error } = await service.from("profiles").select("id").in("id", ids).limit(1).maybeSingle();
  if (error) asAppError(error, "Resolving RevenueCat user");
  if (!data) throw new AppError(404, "REVENUECAT_USER_NOT_FOUND", "No Issac profile matches the RevenueCat app_user_id.");
  return String(data.id);
}

export async function applyRevenueCatEvent(
  service: SupabaseClient,
  event: RevenueCatEvent,
  now = new Date(),
): Promise<{ duplicate: boolean; ignored: boolean; userId: string; subscription: DerivedSubscription }> {
  const eventAt = new Date(event.event_timestamp_ms).toISOString();
  const { data: stored, error: eventError } = await service.from("revenuecat_webhook_events")
    .upsert({ event_id: event.id, event_type: event.type, event_timestamp: eventAt, payload: event }, { onConflict: "event_id", ignoreDuplicates: false })
    .select("event_id,processed_at")
    .single();
  if (eventError || !stored) asAppError(eventError, "Recording RevenueCat webhook");
  if (stored.processed_at) return { duplicate: true, ignored: false, userId: "", subscription: { status: "expired", tier: "free", currentPeriodEnd: null, graceExpiresAt: null, planId: null } };

  const userId = await resolveUserId(service, event);
  const { data: profile, error: profileError } = await service.from("profiles").select("subscription_tier").eq("id", userId).single();
  if (profileError || !profile) asAppError(profileError, "Loading RevenueCat profile");
  const { data: existing, error: existingError } = await service.from("subscriptions").select("status,current_period_end,grace_expires_at,last_event_at,last_event_id,plan_id").eq("user_id", userId).maybeSingle();
  if (existingError) asAppError(existingError, "Loading subscription");
  if (existing?.last_event_at && new Date(existing.last_event_at) > new Date(eventAt)) {
    await service.from("revenuecat_webhook_events").update({ processed_at: new Date().toISOString() }).eq("event_id", event.id);
    return { duplicate: false, ignored: true, userId, subscription: deriveRevenueCatState(event, existing, now) };
  }

  const subscription = deriveRevenueCatState(event, existing, now);
  const { error: subscriptionError } = await service.from("subscriptions").upsert({
    user_id: userId,
    revenuecat_customer_id: event.app_user_id,
    plan_id: subscription.planId,
    status: subscription.status,
    current_period_end: subscription.currentPeriodEnd,
    grace_expires_at: subscription.graceExpiresAt,
    last_event_at: eventAt,
    last_event_id: event.id,
  }, { onConflict: "user_id" });
  if (subscriptionError) asAppError(subscriptionError, "Updating subscription");
  const tier = profile.subscription_tier === "team" ? "team" : subscription.tier;
  const { error: profileUpdateError } = await service.from("profiles").update({ subscription_tier: tier }).eq("id", userId);
  if (profileUpdateError) asAppError(profileUpdateError, "Updating subscription tier");
  const { error: processedError } = await service.from("revenuecat_webhook_events").update({ processed_at: new Date().toISOString() }).eq("event_id", event.id);
  if (processedError) asAppError(processedError, "Finalizing RevenueCat webhook");
  return { duplicate: false, ignored: false, userId, subscription };
}

export async function syncRevenueCatCustomer(
  service: SupabaseClient,
  userId: string,
  now = new Date(),
): Promise<DerivedSubscription> {
  const apiKey = Deno.env.get("REVENUECAT_API_KEY");
  if (!apiKey) throw new AppError(500, "SERVER_MISCONFIGURED", "REVENUECAT_API_KEY is not configured.");
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" },
  });
  if (!response.ok && response.status !== 404) throw new AppError(502, "REVENUECAT_UNAVAILABLE", "RevenueCat status could not be retrieved.");
  const payload = response.status === 404 ? null : RevenueCatSubscriberSchema.parse(await response.json());
  const { data: existing, error: existingError } = await service.from("subscriptions").select("status,current_period_end,grace_expires_at,plan_id").eq("user_id", userId).maybeSingle();
  if (existingError) asAppError(existingError, "Loading subscription");
  const entitlementId = Deno.env.get("REVENUECAT_ENTITLEMENT_ID") ?? "pro";
  const entitlements = payload?.subscriber.entitlements ?? {};
  const entitlement = entitlements[entitlementId] ?? Object.values(entitlements).find((item) => !item.expires_date || new Date(item.expires_date) > now);
  const graceActive = Object.values(entitlements).some((item) => item.grace_period_expires_date && new Date(item.grace_period_expires_date) > now);
  const existingGrace = existing?.grace_expires_at && new Date(existing.grace_expires_at) > now ? existing.grace_expires_at : null;
  let subscription: DerivedSubscription;
  if (graceActive || existingGrace) {
    subscription = { status: "grace_period", tier: "pro", currentPeriodEnd: entitlement?.expires_date ?? existing?.current_period_end ?? null, graceExpiresAt: existingGrace ?? new Date(now.getTime() + GRACE_PERIOD_MS).toISOString(), planId: entitlement?.product_identifier ?? existing?.plan_id ?? null };
  } else if (entitlement && (!entitlement.expires_date || new Date(entitlement.expires_date) > now)) {
    subscription = { status: "active", tier: "pro", currentPeriodEnd: entitlement.expires_date, graceExpiresAt: null, planId: entitlement.product_identifier };
  } else {
    subscription = { status: "expired", tier: "free", currentPeriodEnd: entitlement?.expires_date ?? existing?.current_period_end ?? null, graceExpiresAt: null, planId: entitlement?.product_identifier ?? existing?.plan_id ?? null };
  }
  const { error: subError } = await service.from("subscriptions").upsert({ user_id: userId, revenuecat_customer_id: userId, plan_id: subscription.planId, status: subscription.status, current_period_end: subscription.currentPeriodEnd, grace_expires_at: subscription.graceExpiresAt }, { onConflict: "user_id" });
  if (subError) asAppError(subError, "Saving RevenueCat sync");
  const { data: profile, error: profileLookupError } = await service.from("profiles").select("subscription_tier").eq("id", userId).single();
  if (profileLookupError || !profile) asAppError(profileLookupError, "Loading subscription tier");
  const { error: profileError } = await service.from("profiles").update({ subscription_tier: profile.subscription_tier === "team" ? "team" : subscription.tier }).eq("id", userId);
  if (profileError) asAppError(profileError, "Saving subscription tier");
  return subscription;
}

export { GRACE_PERIOD_MS };
