/**
 * supabase/functions/shared/push.ts
 * ---------------------------------------------------------------------------
 * Telling someone their build finished.
 *
 * A run can take minutes. On a phone that means the user locks the screen and
 * goes back to their life, and the whole point of building on a phone is lost if
 * they have to keep checking. This is the other half of that: they walk away and
 * get told.
 *
 * Two rules shape everything here:
 *
 *   1. A push must never affect the run. The user asked for work, not for a
 *      notification, so every failure in this file is logged and swallowed.
 *   2. A notification that was not worth sending is worse than none. A run that
 *      finished in four seconds does not get one — the user is still looking at
 *      the screen, and the buzz is pure noise.
 * ---------------------------------------------------------------------------
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Expo's documented ceiling for one send request. */
export const MAX_TOKENS_PER_REQUEST = 100;

/**
 * Below this, the user is still watching the screen and the run's own UI has
 * already told them. Buzzing a phone that is in someone's hand, showing the
 * thing the buzz is about, is the fastest way to get notifications turned off.
 */
export const MIN_RUN_MS_FOR_PUSH = 20_000;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** How long to give Expo before giving up. The run is already finished. */
const SEND_TIMEOUT_MS = 10_000;

export interface PushMessage {
  to: string[];
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: "default";
  priority: "high";
  channelId: "runs";
}

/**
 * A token that is only ever seen by this file's fetch call.
 *
 * Expo push tokens are not secrets in the usual sense — possessing one lets you
 * send a notification to that device, which is annoying rather than dangerous —
 * but they identify a device, so they are never returned to a client.
 */
export function isExpoPushToken(value: unknown): value is string {
  return typeof value === "string" &&
    /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$/.test(value);
}

/**
 * Should this run wake someone's phone?
 *
 * @param durationMs How long the run actually took.
 * @param succeeded  A failed run is worth telling someone about regardless of
 *                   how fast it failed: they need to come back and fix it.
 */
export function deservesPush(durationMs: number, succeeded: boolean): boolean {
  if (!succeeded) return true;
  return durationMs >= MIN_RUN_MS_FOR_PUSH;
}

/** One line of the model's answer, short enough for a lock screen. */
export function summarise(text: string, limit = 120): string {
  const firstLine = text.replace(/\s+/g, " ").trim();
  if (!firstLine) return "Open the app to see what changed.";
  if (firstLine.length <= limit) return firstLine;
  // Cut at a word boundary when there is one nearby, so the tail is not a
  // half-word followed by an ellipsis.
  const cut = firstLine.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > limit - 20 ? cut.slice(0, lastSpace) : cut}…`;
}

export interface RunOutcome {
  projectName: string | null;
  sessionId: string;
  projectId: string;
  succeeded: boolean;
  /** The model's final message, or the error. */
  detail: string;
}

/**
 * The notification's text.
 *
 * Named after the project rather than the app, because someone with three
 * projects needs to know which one finished from the lock screen alone.
 */
export function composeMessage(tokens: string[], outcome: RunOutcome): PushMessage {
  const where = outcome.projectName ?? "Your project";
  return {
    to: tokens,
    title: outcome.succeeded ? `${where} is ready` : `${where} needs you`,
    body: summarise(outcome.detail),
    // Deep-link data. The client uses these to open the session that finished
    // rather than dumping the user on the home screen to find it.
    data: {
      kind: outcome.succeeded ? "run_succeeded" : "run_failed",
      sessionId: outcome.sessionId,
      projectId: outcome.projectId,
    },
    sound: "default",
    priority: "high",
    // Android requires a channel for anything to be shown at all; the client
    // creates one with this id.
    channelId: "runs",
  };
}

export function chunkTokens(tokens: string[], size = MAX_TOKENS_PER_REQUEST): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < tokens.length; index += size) {
    chunks.push(tokens.slice(index, index + size));
  }
  return chunks;
}

export interface ExpoTicket {
  status?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Which tokens Expo says are dead, from one response.
 *
 * Tickets come back positionally, so the nth ticket belongs to the nth token.
 * `DeviceNotRegistered` means the app was uninstalled or the token rotated —
 * without acting on it, the table accumulates dead tokens and every run pays to
 * send to them forever.
 */
export function deadTokens(tokens: string[], tickets: ExpoTicket[]): string[] {
  const dead: string[] = [];
  tickets.forEach((ticket, index) => {
    if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
      const token = tokens[index];
      if (token) dead.push(token);
    }
  });
  return dead;
}

/**
 * Send one chunk. Resolves with the tickets, or an empty array on any failure —
 * a push that did not go out must not become an exception in the worker.
 */
async function sendChunk(message: PushMessage): Promise<ExpoTicket[]> {
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        // Expo compresses responses by default; being explicit avoids a
        // surprise when the runtime cannot inflate.
        "accept-encoding": "gzip, deflate",
      },
      body: JSON.stringify([message]),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`[push] Expo refused the send: ${response.status} ${await response.text().catch(() => "")}`);
      return [];
    }
    const parsed = await response.json() as { data?: ExpoTicket[] };
    return Array.isArray(parsed.data) ? parsed.data : [];
  } catch (error) {
    console.error(`[push] send failed: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Tell a user their run finished, on every device they still have registered.
 *
 * Never throws. Returns how many devices were sent to, which is what the
 * worker logs — a run that silently stopped notifying anyone is otherwise
 * invisible until a user complains.
 */
export async function notifyRunFinished(
  client: SupabaseClient,
  userId: string,
  outcome: RunOutcome,
  durationMs: number,
): Promise<{ sent: number; skipped?: string }> {
  if (!deservesPush(durationMs, outcome.succeeded)) {
    return { sent: 0, skipped: "run was too quick to be worth a notification" };
  }

  let tokens: string[] = [];
  try {
    const { data, error } = await client
      .from("push_tokens")
      .select("token")
      .eq("user_id", userId)
      .is("disabled_at", null);
    // The table arrives with a migration. Until it is applied this is a no-op
    // rather than a failed run.
    if (error) {
      const code = (error as { code?: string }).code;
      if (code === "PGRST205" || code === "42P01") return { sent: 0, skipped: "push_tokens table is not migrated" };
      throw error;
    }
    tokens = (data ?? []).map((row) => String(row.token)).filter(isExpoPushToken);
  } catch (error) {
    console.error(`[push] could not read tokens: ${error instanceof Error ? error.message : String(error)}`);
    return { sent: 0, skipped: "token lookup failed" };
  }

  if (tokens.length === 0) return { sent: 0, skipped: "no registered devices" };

  const dead: string[] = [];
  let sent = 0;
  for (const chunk of chunkTokens(tokens)) {
    const tickets = await sendChunk(composeMessage(chunk, outcome));
    sent += tickets.filter((ticket) => ticket?.status === "ok").length;
    dead.push(...deadTokens(chunk, tickets));
  }

  if (dead.length > 0) {
    // Disabled rather than deleted: the same device can register again, and
    // keeping the row means the history of a device is not silently rewritten.
    await client
      .from("push_tokens")
      .update({ disabled_at: new Date().toISOString(), last_error: "DeviceNotRegistered" })
      .in("token", dead)
      .then(undefined, (error: unknown) => {
        console.error(`[push] could not disable dead tokens: ${String(error)}`);
      });
  }

  return { sent };
}
