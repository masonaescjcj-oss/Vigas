import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { CONTINUE_PROMPT, continuationPayload, isUpstreamOverloaded, processJobAttempt, retryDecision, retryDelaySeconds } from "../shared/queue.ts";

Deno.test("queue worker uses the required exponential backoff schedule", () => {
  assertEquals(retryDelaySeconds(1), 10);
  assertEquals(retryDelaySeconds(2), 30);
  assertEquals(retryDelaySeconds(3), 60);
  assertEquals(retryDecision(4), { status: "failed", delaySeconds: null });
});

Deno.test("queue worker completes a successful job and retries a failed attempt", async () => {
  const events: string[] = [];
  const success = await processJobAttempt({
    attempts: 1,
    execute: async () => "result",
    complete: async (result) => { events.push(`completed:${result}`); },
    retry: async () => { events.push("unexpected-retry"); },
    fail: async () => { events.push("unexpected-fail"); },
  });
  assertEquals(success.status, "completed");

  const retry = await processJobAttempt({
    attempts: 2,
    execute: async () => { throw new Error("model unavailable"); },
    complete: async () => { events.push("unexpected-complete"); },
    retry: async (error, seconds) => { events.push(`retry:${error.message}:${seconds}`); },
    fail: async () => { events.push("unexpected-terminal"); },
  });
  assertEquals(retry.status, "pending");
  assertEquals(events, ["completed:result", "retry:model unavailable:30"]);
});

Deno.test("a build that runs out of steps continues in the next job", () => {
  const payload = { mode: "run", prompt: "build me a whole shop", model: "x", skills: ["a"] };
  const next = continuationPayload(payload, 4);

  // Everything the run needs to carry on is preserved...
  assertEquals(next?.model, "x");
  assertEquals(next?.skills, ["a"]);
  // ...but it is a new turn, not a replay of the original request. Repeating
  // "build me a whole shop" would make the agent start the shop over.
  assertEquals(next?.mode, "run");
  assertEquals(next?.prompt, CONTINUE_PROMPT);
  assertEquals(next?.continuation, 1);
});

Deno.test("continuations stop at the limit rather than billing forever", () => {
  // An agent can always find one more improvement to make. Each leg costs
  // tokens, so the chain has to end somewhere and let the user decide.
  let payload: Record<string, unknown> = { mode: "run", prompt: "big" };
  for (let i = 1; i <= 4; i++) {
    const next = continuationPayload(payload, 4);
    assertEquals(next?.continuation, i);
    payload = next!;
  }
  assertEquals(continuationPayload(payload, 4), null);
});

Deno.test("continuation can be switched off, and a broken counter fails closed", () => {
  assertEquals(continuationPayload({ prompt: "x" }, 0), null);
  // A payload whose counter is not a number must not read as "plenty left".
  assertEquals(continuationPayload({ continuation: "lots" }, 4), null);
  assertEquals(continuationPayload({ continuation: -5 }, 4)?.continuation, 1);
});

Deno.test("a provider refusing work is retried patiently, not given up on", () => {
  // Measured against the configured gateway: "system cpu overloaded" four
  // times inside 100 seconds killed a build that was going fine. The next
  // attempt would have worked.
  const overload = "system cpu overloaded (current: 100.0%, threshold: 90%)";
  assertEquals(isUpstreamOverloaded(overload), true);
  assertEquals(retryDecision(4, overload), { status: "pending", delaySeconds: 240 });
  // Where the ordinary schedule would already have given up.
  assertEquals(retryDecision(4), { status: "failed", delaySeconds: null });
  // It does still end.
  assertEquals(retryDecision(9, overload), { status: "failed", delaySeconds: null });
});

Deno.test("only transient upstream errors get the long schedule", () => {
  // Retrying these for twenty minutes would be its own kind of broken.
  for (const message of [
    "invalid api key",
    "the model refused to answer",
    "TypeError: cannot read property 'x' of undefined",
  ]) {
    assertEquals(isUpstreamOverloaded(message), false, message);
    assertEquals(retryDecision(4, message).status, "failed");
  }
  // Recognised on shape rather than one vendor's wording — the provider is
  // configurable and every gateway phrases this differently.
  for (const message of [
    "503 Service Unavailable",
    "Rate limit exceeded, please try again later",
    "upstream request timed out",
    "The engine is currently overloaded",
  ]) {
    assertEquals(isUpstreamOverloaded(message), true, message);
  }
});

Deno.test("the gateway's misleading quota error is retried, not believed", () => {
  // Measured: the configured gateway answers a momentary refusal with
  // "insufficient_user_quota" and a balance of $0.000000 on an account holding
  // $98, and the same key returns 200 seconds later. Taking that at its word
  // failed builds permanently on a transient condition.
  const spurious = "用户额度不足, 剩余额度: ＄0.000000 (request id: 2026...)";
  assertEquals(isUpstreamOverloaded(spurious), true, spurious);
  assertEquals(isUpstreamOverloaded("insufficient_user_quota"), true);
  assertEquals(retryDecision(4, spurious), { status: "pending", delaySeconds: 240 });

  // Still ends, so a genuinely empty account fails in twenty minutes rather
  // than never.
  assertEquals(retryDecision(9, spurious), { status: "failed", delaySeconds: null });

  // And a real mistake on our side is still not retried for twenty minutes.
  assertEquals(retryDecision(4, "invalid api key").status, "failed");
});
