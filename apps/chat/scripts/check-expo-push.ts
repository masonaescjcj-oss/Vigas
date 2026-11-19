/**
 * scripts/check-expo-push.ts
 * ---------------------------------------------------------------------------
 * Checking our push payload against Expo's real API.
 *
 * This exists because of how the share-link bug got through: every unit test
 * passed while the feature was broken, since none of them could see a response
 * header. Ticket parsing has the same shape of blind spot — the tests only ever
 * see response shapes I invented myself.
 *
 * A deliberately fake (but well-formed) token is used, so this notifies nobody.
 * Expo answers with the DeviceNotRegistered ticket, which is exactly the branch
 * that matters: it is what causes a dead device's row to be disabled.
 *
 *   npx deno run --allow-net scripts/check-expo-push.ts
 * ---------------------------------------------------------------------------
 */
import { composeMessage, deadTokens, type ExpoTicket } from "../supabase/functions/shared/push.ts";

const FAKE = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${String(detail).slice(0, 300)}`}`);
  if (!ok) Deno.exitCode = 1;
}

const message = composeMessage([FAKE], {
  projectName: "Coffee Finder",
  sessionId: "11111111-1111-1111-1111-111111111111",
  projectId: "22222222-2222-2222-2222-222222222222",
  succeeded: true,
  detail: "Built the map view.",
});

let res: Response;
try {
  res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify([message]),
    signal: AbortSignal.timeout(15_000),
  });
} catch (error) {
  console.log(`SKIP  Expo is unreachable from here (${error instanceof Error ? error.message : error})`);
  Deno.exit(0);
}

const raw = await res.text();
check(`Expo accepts our payload as sent (${res.status})`, res.ok, raw.slice(0, 300));

let parsed: { data?: ExpoTicket[] } = {};
try {
  parsed = JSON.parse(raw);
} catch {
  check("the response is JSON", false, raw.slice(0, 200));
  Deno.exit(Deno.exitCode ?? 1);
}

check("it carries the `data` array the worker reads", Array.isArray(parsed.data), Object.keys(parsed));

const tickets = parsed.data ?? [];
check("one ticket per token", tickets.length === 1, tickets);
check("a dead device is reported as an error ticket", tickets[0]?.status === "error", tickets[0]);
check(
  "the reason sits at details.error, where the parser looks",
  tickets[0]?.details?.error === "DeviceNotRegistered",
  tickets[0],
);
check(
  "Expo names the token in details.expoPushToken, which we prefer over position",
  tickets[0]?.details?.expoPushToken === FAKE,
  tickets[0],
);

const dead = deadTokens([FAKE], tickets);
check("deadTokens identifies it, so the row would be disabled", dead.length === 1 && dead[0] === FAKE, dead);

// The fields Expo silently ignores are worth knowing about: a typo in one of
// these would mean a notification that never buzzes and never errors.
check("our message declares an Android channel", message.channelId === "runs");
check("our message asks for a sound and high priority",
  message.sound === "default" && message.priority === "high");
