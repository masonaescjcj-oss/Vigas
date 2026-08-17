/**
 * A notification wakes a phone in someone's pocket, so the decisions worth
 * testing are the ones about restraint: not sending when it would be noise, not
 * sending to a device that is gone, and not letting any of it reach the run.
 */
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  MAX_TOKENS_PER_REQUEST,
  MIN_RUN_MS_FOR_PUSH,
  chunkTokens,
  composeMessage,
  deadTokens,
  deservesPush,
  isExpoPushToken,
  summarise,
} from "../shared/push.ts";

const TOKEN = "ExponentPushToken[abcdefghij1234567890]";

Deno.test("a real Expo token is accepted in both spellings", () => {
  assertEquals(isExpoPushToken(TOKEN), true);
  assertEquals(isExpoPushToken("ExpoPushToken[abcdefghij1234567890]"), true);
});

Deno.test("anything else is not a push token", () => {
  assertEquals(isExpoPushToken("abcdefghij1234567890"), false);
  assertEquals(isExpoPushToken("ExponentPushToken[]"), false, "empty body");
  assertEquals(isExpoPushToken("ExponentPushToken[short]"), false);
  assertEquals(isExpoPushToken("fcm:AAAA1234567890"), false, "raw FCM token");
  assertEquals(isExpoPushToken(""), false);
  assertEquals(isExpoPushToken(null), false);
  assertEquals(isExpoPushToken(42), false);
});

Deno.test("a quick successful run is not worth a notification", () => {
  // The user is still looking at the screen that already told them.
  assertEquals(deservesPush(3_000, true), false);
  assertEquals(deservesPush(MIN_RUN_MS_FOR_PUSH - 1, true), false);
});

Deno.test("a long successful run is", () => {
  assertEquals(deservesPush(MIN_RUN_MS_FOR_PUSH, true), true);
  assertEquals(deservesPush(5 * 60_000, true), true);
});

Deno.test("a failure is always worth telling someone, however fast it failed", () => {
  // They have to come back and fix it; speed is irrelevant.
  assertEquals(deservesPush(50, false), true);
});

Deno.test("a summary fits on a lock screen and collapses whitespace", () => {
  const text = "I added   the login screen.\n\nIt uses the existing auth store.";
  assertEquals(summarise(text), "I added the login screen. It uses the existing auth store.");
});

Deno.test("a long summary is cut at a word boundary", () => {
  const text = "word ".repeat(80);
  const result = summarise(text, 40);
  assertEquals(result.length <= 41, true, result);
  assertEquals(result.endsWith("…"), true);
  // Not a half-word before the ellipsis.
  assertEquals(/\Sword…$|\s…$|word…$/.test(result), true, result);
});

Deno.test("a single long word is still cut rather than dropped", () => {
  const result = summarise("x".repeat(200), 40);
  assertEquals(result.length, 41);
  assertEquals(result.endsWith("…"), true);
});

Deno.test("an empty answer gets something a user can act on", () => {
  assertStringIncludes(summarise("   \n  "), "Open the app");
});

Deno.test("the message names the project, not the app", () => {
  // Someone with three projects reads only the lock screen.
  const message = composeMessage([TOKEN], {
    projectName: "Coffee Finder",
    sessionId: "s1",
    projectId: "p1",
    succeeded: true,
    detail: "Built the map view.",
  });
  assertStringIncludes(message.title, "Coffee Finder");
  assertEquals(message.body, "Built the map view.");
  assertEquals(message.data.kind, "run_succeeded");
  assertEquals(message.data.sessionId, "s1");
  // Android shows nothing at all without a channel.
  assertEquals(message.channelId, "runs");
});

Deno.test("an unnamed project still reads as a sentence", () => {
  const message = composeMessage([TOKEN], {
    projectName: null,
    sessionId: "s1",
    projectId: "p1",
    succeeded: true,
    detail: "Done.",
  });
  assertEquals(message.title, "Your project is ready");
});

Deno.test("a failed run says it needs you, and carries the error", () => {
  const message = composeMessage([TOKEN], {
    projectName: "Coffee Finder",
    sessionId: "s1",
    projectId: "p1",
    succeeded: false,
    detail: "The provider rejected the key.",
  });
  assertStringIncludes(message.title, "needs you");
  assertEquals(message.body, "The provider rejected the key.");
  assertEquals(message.data.kind, "run_failed");
});

Deno.test("tokens are chunked to Expo's per-request ceiling", () => {
  const tokens = Array.from({ length: 250 }, (_, i) => `ExponentPushToken[device${i}00000000]`);
  const chunks = chunkTokens(tokens);
  assertEquals(chunks.length, 3);
  assertEquals(chunks[0].length, MAX_TOKENS_PER_REQUEST);
  assertEquals(chunks[2].length, 50);
  // Nothing lost, nothing duplicated.
  assertEquals(chunks.flat().length, 250);
  assertEquals(new Set(chunks.flat()).size, 250);
});

Deno.test("no tokens means no chunks, not one empty request", () => {
  assertEquals(chunkTokens([]).length, 0);
});

Deno.test("a DeviceNotRegistered ticket names the token at its position", () => {
  const tokens = ["a", "b", "c"];
  const dead = deadTokens(tokens, [
    { status: "ok" },
    { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } },
    { status: "ok" },
  ]);
  assertEquals(dead, ["b"]);
});

Deno.test("other errors do not disable a device", () => {
  // A rate limit or a malformed message is our problem, not the device's.
  const dead = deadTokens(["a", "b"], [
    { status: "error", details: { error: "MessageTooBig" } },
    { status: "error", details: { error: "MessageRateExceeded" } },
  ]);
  assertEquals(dead, []);
});

Deno.test("a short or missing ticket list never invents a token", () => {
  assertEquals(deadTokens(["a", "b"], []), []);
  assertEquals(
    deadTokens(["a"], [{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }]),
    [],
    "a ticket with no matching token is ignored",
  );
});
