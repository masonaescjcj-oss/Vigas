/**
 * supabase/functions/admin/index.ts
 * ---------------------------------------------------------------------------
 * The operator's panel: the key pool, the model catalogue, plan limits, and a
 * revenue overview.
 *
 * One function rather than six, because every action shares the same gate and
 * splitting it would mean six places to get that gate right. `requireAdmin`
 * reads the flag from the database, not from the token, and answers 404 rather
 * than 403 so the route does not announce itself.
 *
 * Keys are write-only here as everywhere else: they are encrypted on the way
 * in and the panel only ever sees the last four characters and the health the
 * pool recorded.
 * ---------------------------------------------------------------------------
 */
import { withSentryHandler } from "../shared/sentry.ts";
import { AdminSchema } from "../shared/zodSchemas.ts";
import { AppError, assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { requireAdmin } from "../shared/supabase.ts";
import { checkProviderUrl } from "../shared/providerGuard.ts";
import { lastFour, openSecret, sealSecret } from "../shared/secretBox.ts";
import { isYoucomUrl, probeYoucom } from "../shared/youcom.ts";
import { classifyFailure, nextHealth, type PoolKey } from "../shared/keyPool.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Everything about a pooled key except the key. */
const POOL_PUBLIC =
  "id,label,base_url,key_last4,model,priority,is_active,last_used_at,last_ok_at," +
  "last_error,failure_count,exhausted_at,created_at";

const POOL_FULL = POOL_PUBLIC + ",key_cipher";

/** One tiny completion, to prove a key works before it is relied on. */
async function probe(
  baseUrl: string,
  apiKey: string,
  model: string | null,
): Promise<{ ok: boolean; status: number; detail: string }> {
  // A You.com key is tested against the Agents API it will actually be used on.
  if (isYoucomUrl(baseUrl)) return await probeYoucom(apiKey);
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model ?? "gpt-3.5-turbo",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (response.ok) return { ok: true, status: response.status, detail: "" };

    const body = await response.text().catch(() => "");
    let message = body.slice(0, 300);
    try {
      message = JSON.parse(body)?.error?.message ?? message;
    } catch { /* raw body is the best available */ }
    return { ok: false, status: response.status, detail: `${response.status}: ${message}` };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      detail: `Could not reach ${endpoint}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/** Test one key and write down what happened. */
async function testKey(service: SupabaseClient, id: string) {
  const { data } = await service.from("platform_providers").select(POOL_FULL).eq("id", id).maybeSingle();
  if (!data) throw new AppError(404, "KEY_NOT_FOUND", "That key is not in the pool.");
  const key = data as unknown as PoolKey & { key_cipher: string };

  const result = await probe(
    key.base_url,
    await openSecret(key.key_cipher),
    key.model,
  );

  await service.from("platform_providers").update(
    result.ok
      ? nextHealth(key, { ok: true }, new Date())
      : nextHealth(
          key,
          { ok: false, kind: classifyFailure(result.status, result.detail), detail: result.detail },
          new Date(),
        ),
  ).eq("id", id);

  return { id, label: key.label, ok: result.ok, detail: result.detail };
}

export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = corsHeaders(req);
  const early = preflight(req);
  if (early) return early;
  try {
    assertMethod(req, ["POST"]);
    const { service } = await requireAdmin(req);
    const input = await parseJson(req, AdminSchema);

    switch (input.action) {
      /* ---- The key pool ------------------------------------------------- */

      case "keys.list": {
        const { data, error } = await service
          .from("platform_providers").select(POOL_PUBLIC)
          .order("priority", { ascending: true }).order("created_at", { ascending: true });
        if (error) throw error;
        return json({ keys: data ?? [] }, 200, headers);
      }

      case "keys.add": {
        const verdict = checkProviderUrl(input.baseUrl!);
        if (!verdict.ok) throw new AppError(400, "INVALID_PROVIDER_URL", verdict.reason!);

        // Adding many keys from one site is the point, so a key is stored even
        // if the probe fails — it is marked exhausted rather than refused, and
        // the panel shows why. Refusing would make bulk entry painful.
        const probed = await probe(verdict.normalised!, input.apiKey!, input.model ?? null);
        const now = new Date().toISOString();

        const { data, error } = await service.from("platform_providers").insert({
          label: input.label!,
          base_url: verdict.normalised!,
          key_cipher: await sealSecret(input.apiKey!),
          key_last4: lastFour(input.apiKey!),
          model: input.model ?? null,
          priority: input.priority ?? 100,
          last_ok_at: probed.ok ? now : null,
          last_error: probed.ok ? null : probed.detail,
          exhausted_at: probed.ok ? null : now,
          failure_count: probed.ok ? 0 : 1,
        }).select(POOL_PUBLIC).single();
        if (error || !data) throw error ?? new Error("Key insert returned no row.");

        return json({ key: data, verified: probed.ok, detail: probed.detail }, 201, headers);
      }

      case "keys.update": {
        const patch: Record<string, unknown> = {};
        if (input.label !== undefined) patch.label = input.label;
        if (input.priority !== undefined) patch.priority = input.priority;
        if (input.model !== undefined) patch.model = input.model;
        if (input.isActive !== undefined) patch.is_active = input.isActive;
        // Reactivating a key is the operator saying "I topped it up".
        if (input.isActive === true) {
          patch.exhausted_at = null;
          patch.failure_count = 0;
        }
        const { data, error } = await service
          .from("platform_providers").update(patch).eq("id", input.id!).select(POOL_PUBLIC).single();
        if (error || !data) throw error ?? new AppError(404, "KEY_NOT_FOUND", "That key is not in the pool.");
        return json({ key: data }, 200, headers);
      }

      case "keys.delete": {
        const { error } = await service.from("platform_providers").delete().eq("id", input.id!);
        if (error) throw error;
        return json({ ok: true }, 200, headers);
      }

      case "keys.test": {
        return json({ result: await testKey(service, input.id!) }, 200, headers);
      }

      case "keys.testAll": {
        // Sequential on purpose: firing twenty probes at one provider at once
        // is the fastest way to get rate limited and mark healthy keys dead.
        const { data } = await service.from("platform_providers").select("id").eq("is_active", true);
        const results = [];
        for (const row of data ?? []) results.push(await testKey(service, String(row.id)));
        return json({ results }, 200, headers);
      }

      /* ---- The model catalogue ------------------------------------------ */

      case "models.list": {
        const { data, error } = await service
          .from("models").select("*").order("sort_order", { ascending: true });
        if (error) throw error;
        return json({ models: data ?? [] }, 200, headers);
      }

      case "models.upsert": {
        const { data, error } = await service.from("models").upsert({
          id: input.modelId!,
          display_name: input.displayName!,
          description: input.description ?? null,
          tone: input.tone ?? "brandPrimary",
          icon: input.icon ?? "zap",
          min_tier: input.minTier ?? null,
          is_default: input.isDefault ?? false,
          is_active: input.isActive ?? true,
          sort_order: input.sortOrder ?? 0,
        }, { onConflict: "id" }).select().single();
        if (error || !data) throw error ?? new Error("Model upsert returned no row.");

        // Exactly one default, or the server has no answer for "auto".
        if (input.isDefault) {
          await service.from("models").update({ is_default: false }).neq("id", input.modelId!);
        }
        return json({ model: data }, 200, headers);
      }

      case "models.delete": {
        const { error } = await service.from("models").delete().eq("id", input.modelId!);
        if (error) throw error;
        return json({ ok: true }, 200, headers);
      }

      /* ---- Plans -------------------------------------------------------- */

      case "plans.list": {
        const { data, error } = await service
          .from("plans").select("*").order("sort_order", { ascending: true });
        if (error) throw error;
        return json({ plans: data ?? [] }, 200, headers);
      }

      case "plans.update": {
        const patch: Record<string, unknown> = {};
        if (input.displayName !== undefined) patch.display_name = input.displayName;
        if (input.buildRunsPerDay !== undefined) patch.build_runs_per_day = input.buildRunsPerDay;
        if (input.tokenLimitPerDay !== undefined) patch.token_limit_per_day = input.tokenLimitPerDay;
        if (input.maxProjects !== undefined) patch.max_projects = input.maxProjects;
        if (input.priceLabel !== undefined) patch.price_label = input.priceLabel;
        if (input.isActive !== undefined) patch.is_active = input.isActive;

        const { data, error } = await service
          .from("plans").update(patch).eq("key", input.planKey!).select().single();
        if (error || !data) throw error ?? new AppError(404, "PLAN_NOT_FOUND", "No such plan.");
        return json({ plan: data }, 200, headers);
      }

      /* ---- Revenue and usage -------------------------------------------- */

      case "overview": {
        const since = new Date();
        since.setUTCDate(since.getUTCDate() - 30);

        const [users, subs, runs, tokens] = await Promise.all([
          service.from("profiles").select("subscription_tier"),
          service.from("subscriptions").select("status,tier,current_period_end"),
          service.from("job_queue").select("id", { count: "exact", head: true })
            .gte("created_at", since.toISOString()),
          service.from("usage_metering").select("tokens_used")
            .gte("period_start", since.toISOString()),
        ]);

        const byTier: Record<string, number> = {};
        for (const row of users.data ?? []) {
          const tier = String((row as { subscription_tier: string }).subscription_tier);
          byTier[tier] = (byTier[tier] ?? 0) + 1;
        }

        const activeSubs = (subs.data ?? []).filter(
          (s) => String((s as { status: string }).status) === "active",
        );

        return json({
          users_total: (users.data ?? []).length,
          users_by_tier: byTier,
          active_subscriptions: activeSubs.length,
          builds_last_30_days: runs.count ?? 0,
          tokens_last_30_days: (tokens.data ?? [])
            .reduce((sum, row) => sum + Number((row as { tokens_used: number }).tokens_used ?? 0), 0),
          // Prices live with the stores, so revenue is not summed here. The
          // panel links out rather than inventing a number it cannot verify.
          revenue_note: "Amounts are held by the App Store, Google Play and RevenueCat.",
        }, 200, headers);
      }

      /**
       * The funnel: how many people reached each step in the last 30 days.
       *
       * Counted by distinct user rather than by event, because "builds started"
       * and "people who started a build" answer different questions and only
       * the second one is a funnel. Anonymous events have no user to count, so
       * they are reported separately rather than silently folded in.
       */
      case "funnel": {
        const since = new Date();
        since.setUTCDate(since.getUTCDate() - 30);

        const { data, error } = await service
          .from("analytics_events")
          .select("event,user_id,properties")
          .gte("created_at", since.toISOString())
          .limit(50_000);
        if (error) {
          if (error.code === "PGRST205" || error.code === "42P01") {
            throw new AppError(
              503,
              "ANALYTICS_NOT_MIGRATED",
              "Analytics needs a database migration that has not been applied yet (analytics_events).",
            );
          }
          throw error;
        }

        const rows = (data ?? []) as Array<{
          event: string;
          user_id: string | null;
          properties: Record<string, unknown> | null;
        }>;

        const people = new Map<string, Set<string>>();
        const totals: Record<string, number> = {};
        const outcomes: Record<string, number> = {};

        for (const row of rows) {
          totals[row.event] = (totals[row.event] ?? 0) + 1;
          if (row.user_id) {
            if (!people.has(row.event)) people.set(row.event, new Set());
            people.get(row.event)!.add(row.user_id);
          }
          if (row.event === "build_finished") {
            const outcome = String(row.properties?.outcome ?? "unknown");
            outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
          }
        }

        const users: Record<string, number> = {};
        for (const [event, set] of people) users[event] = set.size;

        return json({
          since: since.toISOString(),
          // Distinct people who reached each step.
          users_by_event: users,
          // Raw counts, for "how many builds" as opposed to "how many builders".
          events_total: totals,
          build_outcomes: outcomes,
          events_recorded: rows.length,
          // Says so out loud rather than quietly reporting a partial answer.
          truncated: rows.length >= 50_000,
        }, 200, headers);
      }
    }

    throw new AppError(400, "UNKNOWN_ACTION", "That admin action is not recognised.");
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("admin", handler));
}
