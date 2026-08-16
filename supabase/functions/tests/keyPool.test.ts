/**
 * Two failure modes this guards against, both expensive:
 *   - rotating on a malformed request, which marks every key in the pool dead
 *     for a problem none of them caused
 *   - always picking the same key, so one of ten burns out while nine idle
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  EXHAUSTED_COOLDOWN_MS,
  FAILURE_LIMIT,
  classifyFailure,
  isRested,
  nextHealth,
  orderKeys,
  type PoolKey,
} from "../shared/keyPool.ts";

const NOW = Date.parse("2026-08-16T12:00:00Z");

function key(over: Partial<PoolKey> = {}): PoolKey {
  return {
    id: "a", label: "k", base_url: "https://x/v1", key_cipher: "c", model: null,
    priority: 100, is_active: true, last_used_at: null, exhausted_at: null,
    failure_count: 0, ...over,
  };
}

Deno.test("no credit, rate limit and revoked keys all mean: try the next one", () => {
  for (const status of [401, 402, 403, 429]) {
    assertEquals(classifyFailure(status, ""), "key_exhausted", `status ${status}`);
  }
  for (const body of [
    "You exceeded your current quota",
    "Insufficient credits",
    "billing hard limit reached",
  ]) {
    assertEquals(classifyFailure(400, body), "key_exhausted", body);
  }
});

Deno.test("a malformed request does not blame the key", () => {
  // The critical case: rotating here would mark all ten keys dead for a
  // problem every one of them would have rejected identically.
  assertEquals(classifyFailure(400, "invalid 'messages': expected an array"), "request_rejected");
  assertEquals(classifyFailure(404, "model not found"), "request_rejected");
});

Deno.test("an upstream outage is the provider's fault, not the key's", () => {
  assertEquals(classifyFailure(500, "internal"), "provider_down");
  assertEquals(classifyFailure(503, ""), "provider_down");
  assertEquals(classifyFailure(0, "fetch failed"), "provider_down");
});

Deno.test("priority decides first, so the cheap provider runs before the dear one", () => {
  const order = orderKeys([
    key({ id: "expensive", priority: 200 }),
    key({ id: "cheap", priority: 10 }),
  ], NOW);
  assertEquals(order.map((k) => k.id), ["cheap", "expensive"]);
});

Deno.test("keys at the same priority share the load, least recently used first", () => {
  const order = orderKeys([
    key({ id: "just-used", last_used_at: new Date(NOW - 1000).toISOString() }),
    key({ id: "never-used", last_used_at: null }),
    key({ id: "used-an-hour-ago", last_used_at: new Date(NOW - 3_600_000).toISOString() }),
  ], NOW);
  assertEquals(order.map((k) => k.id), ["never-used", "used-an-hour-ago", "just-used"]);
});

Deno.test("an inactive key is never chosen", () => {
  const order = orderKeys([key({ id: "off", is_active: false }), key({ id: "on" })], NOW);
  assertEquals(order.map((k) => k.id), ["on"]);
});

Deno.test("a resting key goes last but is not thrown away", () => {
  // If every key is exhausted, a stale attempt beats refusing to answer.
  const order = orderKeys([
    key({ id: "resting", exhausted_at: new Date(NOW - 60_000).toISOString(), priority: 1 }),
    key({ id: "healthy", priority: 500 }),
  ], NOW);
  assertEquals(order.map((k) => k.id), ["healthy", "resting"]);
});

Deno.test("a key that has rested long enough rejoins the rotation normally", () => {
  const old = new Date(NOW - EXHAUSTED_COOLDOWN_MS - 1000).toISOString();
  assertEquals(isRested(key({ exhausted_at: old }), NOW), true);
  assertEquals(isRested(key({ exhausted_at: new Date(NOW - 60_000).toISOString() }), NOW), false);
  assertEquals(isRested(key(), NOW), true);
});

Deno.test("ordering is stable when everything else ties", () => {
  const order = orderKeys([key({ id: "b" }), key({ id: "a" })], NOW);
  assertEquals(order.map((k) => k.id), ["a", "b"]);
});

Deno.test("success wipes the slate, including a previous exhaustion", () => {
  const health = nextHealth(
    key({ failure_count: 2, exhausted_at: new Date(NOW).toISOString(), }),
    { ok: true },
    new Date(NOW),
  );
  assertEquals(health.failure_count, 0);
  assertEquals(health.exhausted_at, null);
  assertEquals(health.last_error, null);
});

Deno.test("an exhausted key is rested immediately", () => {
  const health = nextHealth(key(), { ok: false, kind: "key_exhausted", detail: "402" }, new Date(NOW));
  assertEquals(typeof health.exhausted_at, "string");
  assertEquals(health.failure_count, 1);
});

Deno.test("a rejected request leaves the key's health untouched", () => {
  const health = nextHealth(
    key({ failure_count: 1 }),
    { ok: false, kind: "request_rejected", detail: "bad body" },
    new Date(NOW),
  );
  assertEquals(health.failure_count, undefined, "failures must not be counted");
  assertEquals(health.exhausted_at, undefined, "the key must not be rested");
});

Deno.test("repeated outages eventually rest a key even without a clear signal", () => {
  let current = key();
  for (let i = 1; i < FAILURE_LIMIT; i += 1) {
    const health = nextHealth(current, { ok: false, kind: "provider_down", detail: "500" }, new Date(NOW));
    assertEquals(health.exhausted_at, null, `not yet at ${i}`);
    current = { ...current, failure_count: health.failure_count as number };
  }
  const final = nextHealth(current, { ok: false, kind: "provider_down", detail: "500" }, new Date(NOW));
  assertEquals(typeof final.exhausted_at, "string");
});

Deno.test("a resting key keeps its original rest time, so cooldown cannot be extended forever", () => {
  const started = new Date(NOW - 60_000).toISOString();
  const health = nextHealth(
    key({ exhausted_at: started, failure_count: 5 }),
    { ok: false, kind: "key_exhausted", detail: "402" },
    new Date(NOW),
  );
  assertEquals(health.exhausted_at, started);
});
