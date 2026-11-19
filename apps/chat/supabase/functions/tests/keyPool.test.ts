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
});

Deno.test("a missing model is the provider's gap, not a bad request", () => {
  // This expectation used to be request_rejected, which stopped the whole run at
  // the first key. But "model not found" is a statement about *that provider* —
  // another key may well carry the model — so the right move is to try the next
  // one while leaving this key's health alone. Changed deliberately, not to make
  // a test pass.
  assertEquals(classifyFailure(404, "model not found"), "model_unavailable");
});

Deno.test("neither of the blameless kinds ever rests a key", () => {
  // The invariant the two tests above are really protecting.
  for (const kind of ["request_rejected", "model_unavailable"] as const) {
    const health = nextHealth(
      key({ failure_count: 2, exhausted_at: null }),
      { ok: false, kind, detail: "d" },
      new Date(NOW),
    );
    assertEquals(health.exhausted_at, undefined, kind);
    assertEquals(health.failure_count, undefined, kind);
  }
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

/**
 * The cases below are real responses from the configured provider, captured by
 * making the calls. Every classification test before them used bodies I made up,
 * and two of them were wrong about what actually arrives.
 */
const REAL_INVALID_KEY = '{"error":{"code":"","message":"Invalid token (request id: 2026...)","type":"new_api_error"}}';
const REAL_NO_MODEL_ACCESS = '{"error":{"code":"","message":"This token has no access to model totally-not-a-model-xyz (request id: 2026...)","type":"new_api_error"}}';
const REAL_MALFORMED = '{"error":{"message":"json: cannot unmarshal string into Go struct field ***.messages of type []***.Message","type":"new_api_error","param":"","code":"invalid_request"}}';

Deno.test("a real invalid key rests that key so the pool rotates", () => {
  assertEquals(classifyFailure(401, REAL_INVALID_KEY), "key_exhausted");
});

Deno.test("a real 'no access to model' does NOT rest the key", () => {
  // It arrives as a 403, which used to mean key_exhausted — so every key in the
  // pool answered the same way and every key got a 30-minute cooldown. One
  // unsupported model id took the whole service down for half an hour.
  assertEquals(classifyFailure(403, REAL_NO_MODEL_ACCESS), "model_unavailable");
});

Deno.test("a key that lacks a model keeps its health untouched", () => {
  const subject = key({ failure_count: 1, exhausted_at: null });
  const health = nextHealth(subject, { ok: false, kind: "model_unavailable", detail: "no access" }, new Date());
  assertEquals(health.exhausted_at, undefined, "must not be rested");
  assertEquals(health.failure_count, undefined, "must not count against it");
  assertEquals(health.last_error, "no access", "but the reason is recorded");
});

Deno.test("a real malformed request is our fault even though it arrives as a 500", () => {
  // The provider reports our bad JSON with status 500. Read as a bare status that
  // is an outage, and the request would tour the entire pool costing money on
  // something that can never succeed.
  assertEquals(classifyFailure(500, REAL_MALFORMED), "request_rejected");
});

Deno.test("a genuine provider outage is still provider_down", () => {
  // The body must not be over-read: an empty or generic 500 is an outage.
  assertEquals(classifyFailure(500, ""), "provider_down");
  assertEquals(classifyFailure(502, "<html>Bad Gateway</html>"), "provider_down");
  assertEquals(classifyFailure(0, ""), "provider_down");
});

Deno.test("a quota message still rests the key, even alongside other wording", () => {
  assertEquals(classifyFailure(429, '{"error":{"message":"You exceeded your current quota"}}'), "key_exhausted");
  assertEquals(classifyFailure(200, '{"error":{"message":"insufficient credit"}}'), "key_exhausted");
});

/**
 * The same provider, a different account: the shape of "that model is not
 * available" changed entirely between two real keys. Captured verbatim, because
 * matching on prose alone let the second one through as an outage — which rests a
 * healthy key after three tries.
 */
const REAL_MODEL_NOT_FOUND_503 = '{"error":{"code":"model_not_found","message":"Failed to get available channel for model totally-not-a-model-xyz under group default (distributor): no enabled channel for cheapest routing (request id: 2026...)","type":"new_api_error"}}';

Deno.test("a 503 whose code says model_not_found does not blame the key", () => {
  // Read as a bare status this is an outage, and provider_down counts against the
  // key's health. The structured code is the honest signal.
  assertEquals(classifyFailure(503, REAL_MODEL_NOT_FOUND_503), "model_unavailable");
});

Deno.test("the underscore spelling is recognised as well as the spaced one", () => {
  assertEquals(classifyFailure(404, '{"code":"model_not_found"}'), "model_unavailable");
  assertEquals(classifyFailure(404, "model not found"), "model_unavailable");
  assertEquals(classifyFailure(404, "model-not-available"), "model_unavailable");
});

Deno.test("a genuine 503 with no model complaint is still an outage", () => {
  // The new matching must not swallow real outages into model_unavailable, or a
  // dead provider would never rest anything.
  assertEquals(classifyFailure(503, ""), "provider_down");
  assertEquals(classifyFailure(503, "<html>Service Unavailable</html>"), "provider_down");
  assertEquals(classifyFailure(503, '{"error":{"message":"upstream timeout"}}'), "provider_down");
});
