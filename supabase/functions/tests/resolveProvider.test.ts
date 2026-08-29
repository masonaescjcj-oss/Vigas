import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveProvider } from "../shared/resolveProvider.ts";
import { sealSecret } from "../shared/secretBox.ts";

// Set before secretBox is asked for anything: these tests seal and open their
// own values, so they must not depend on the operator's real key being present
// or on the suite being run with --env-file.
Deno.env.set("PROVIDER_KEY_SECRET", "test-only-secret-that-is-long-enough-32+");

/**
 * A client that answers only the two tables this reads, so the test says which
 * table was consulted rather than merely that something came back.
 */
function fakeService(tables: {
  user_providers?: Array<Record<string, unknown>>;
  platform_providers?: Array<Record<string, unknown>>;
}): { client: SupabaseClient; seen: string[] } {
  const seen: string[] = [];
  const client = {
    from(table: string) {
      seen.push(table);
      const rows = (tables as Record<string, Array<Record<string, unknown>>>)[table] ?? [];
      const result = { data: rows, error: null };
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        not: () => chain,
        order: () => chain,
        limit: () => Promise.resolve(result),
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  return { client, seen };
}

Deno.test("a key added in the admin panel is actually used", async () => {
  // The gap this closes: the panel wrote to platform_providers and the build
  // read OPENAI_API_KEY from the environment, so changing a key in the panel
  // did nothing. A panel that looks like it works and does not is worse than
  // no panel.
  const { client, seen } = fakeService({
    user_providers: [],
    platform_providers: [{
      id: "pool-1",
      label: "Operator key",
      base_url: "https://api.example.com/v1",
      key_cipher: await sealSecret("sk-from-the-admin-panel"),
      model: "gpt-5.6-terra",
      priority: 100,
      is_active: true,
      last_used_at: null,
      exhausted_at: null,
      failure_count: 0,
    }],
  });

  const resolved = await resolveProvider(client, "user-without-own-key");

  assertEquals(resolved.apiKey, "sk-from-the-admin-panel");
  assertEquals(resolved.baseUrl, "https://api.example.com/v1");
  assertEquals(resolved.label, "Operator key");
  assertEquals(seen.includes("platform_providers"), true, "the pool was never consulted");
});

Deno.test("the user's own key still wins over the operator's", async () => {
  // They pay for their own tokens. The pool must not quietly take that over.
  const { client } = fakeService({
    user_providers: [{
      id: "mine",
      label: "My OpenAI",
      base_url: "https://api.openai.com/v1",
      key_cipher: await sealSecret("sk-the-users-own"),
      model: null,
      verified_at: "2026-01-01T00:00:00Z",
    }],
    platform_providers: [{
      id: "pool-1",
      label: "Operator key",
      base_url: "https://api.example.com/v1",
      key_cipher: await sealSecret("sk-from-the-admin-panel"),
      model: null,
      priority: 100,
      is_active: true,
      last_used_at: null,
      exhausted_at: null,
      failure_count: 0,
    }],
  });

  const resolved = await resolveProvider(client, "user-with-own-key");
  assertEquals(resolved.apiKey, "sk-the-users-own");
});

Deno.test("an empty pool falls through to the environment", async () => {
  // The normal case for a fresh install, and not an error: an empty result
  // means "use the server's configured provider".
  const { client } = fakeService({ user_providers: [], platform_providers: [] });
  const resolved = await resolveProvider(client, "nobody");
  assertEquals(resolved.apiKey, undefined);
});

Deno.test("an undecryptable pool key does not take the run down with it", async () => {
  // PROVIDER_KEY_SECRET was rotated. Skipping the key is right; failing every
  // build until someone notices is not.
  const { client } = fakeService({
    user_providers: [],
    platform_providers: [{
      id: "pool-broken",
      label: "Rotated",
      base_url: "https://api.example.com/v1",
      key_cipher: "not-a-real-sealed-value",
      model: null,
      priority: 100,
      is_active: true,
      last_used_at: null,
      exhausted_at: null,
      failure_count: 0,
    }],
  });

  const resolved = await resolveProvider(client, "nobody");
  assertEquals(resolved.apiKey, undefined);
});
