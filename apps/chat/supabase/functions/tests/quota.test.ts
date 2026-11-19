import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { describeWait, quotaMessage, withinQuota } from "../shared/quota.ts";

Deno.test("a limit of zero is not the same as no limit", () => {
  // The usual quota bug: null and 0 are both falsy, so one `if (!limit)` lets
  // a plan meant to allow nothing allow everything.
  assertEquals(withinQuota(null, 9_999), true, "null means unlimited");
  assertEquals(withinQuota(0, 0), false, "zero means none, not unlimited");
  assertEquals(withinQuota(4, 3), true);
  assertEquals(withinQuota(4, 4), false, "the fourth is used, so the fifth is refused");
  assertEquals(withinQuota(4, 5), false, "over is still over");
});

Deno.test("the wait is described in units a person can act on", () => {
  const now = new Date("2026-08-29T12:00:00Z");
  const at = (iso: string) => new Date(iso);

  assertEquals(describeWait(at("2026-08-29T12:00:30Z"), now), "in a minute");
  assertEquals(describeWait(at("2026-08-29T12:25:00Z"), now), "in 25 minutes");
  assertEquals(describeWait(at("2026-08-29T14:00:00Z"), now), "in 2 hours");
  assertEquals(describeWait(at("2026-08-29T13:00:00Z"), now), "in 1 hour");
  assertEquals(describeWait(at("2026-08-29T14:30:00Z"), now), "in 2h 30m");
  // Already past, which happens between the count and the follow-up query.
  assertEquals(describeWait(at("2026-08-29T11:59:00Z"), now), "in a minute");
  // No row came back, so say something true rather than inventing a time.
  assertEquals(describeWait(null, now), "shortly");
});

Deno.test("the refusal names the limit, the window and the wait", () => {
  // "You have hit your limit" without those leaves the user guessing whether
  // to wait a minute or come back tomorrow.
  const now = new Date("2026-08-29T12:00:00Z");
  const message = quotaMessage("build", 4, 12, new Date("2026-08-29T15:30:00Z"), now);

  assertEquals(message.includes("4 builds"), true, message);
  assertEquals(message.includes("12 hours"), true, message);
  assertEquals(message.includes("in 3h 30m"), true, message);
  // Nothing is for sale, so it must not suggest buying a way out.
  assertEquals(/upgrade|plan|subscri/i.test(message), false, message);
});

Deno.test("singulars read as English, not as a template", () => {
  const now = new Date("2026-08-29T12:00:00Z");
  assertEquals(
    quotaMessage("build", 1, 12, null, now).includes("1 build "),
    true,
  );
  assertEquals(
    quotaMessage("chat", 30, 12, null, now).includes("30 messages"),
    true,
  );
  assertEquals(
    quotaMessage("chat", 1, 6, null, now).includes("1 message "),
    true,
  );
});
