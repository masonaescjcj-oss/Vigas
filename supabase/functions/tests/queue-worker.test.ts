import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { processJobAttempt, retryDecision, retryDelaySeconds } from "../shared/queue.ts";

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
