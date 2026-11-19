/**
 * frontend/src/services/analytics.ts
 * ---------------------------------------------------------------------------
 * Recording what happens, into this project's own database.
 *
 * The shape of an event is decided in core/analytics/events.ts — an allow-list
 * of names and, per name, an allow-list of property keys. This file is only the
 * plumbing: batching, and never letting a failure here affect the app.
 *
 * Two rules it enforces on its own:
 *
 *   - `track` never throws and never awaits anything the caller cares about.
 *     A build must not fail because a counter could not be written.
 *   - Events are batched and flushed, because a phone on a bad connection
 *     should not pay a round trip per tap.
 * ---------------------------------------------------------------------------
 */

import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import { supabase } from "./supabase";
import { sanitizeEvent } from "../core/analytics/events";

/** How many events to hold before sending. */
const BATCH_SIZE = 10;
/** How long an event may wait before it is sent anyway. */
const FLUSH_INTERVAL_MS = 15_000;
/** Beyond this the queue is dropping the oldest — the network is gone. */
const MAX_QUEUE = 200;

interface QueuedEvent {
  user_id: string | null;
  event: string;
  properties: Record<string, string | number | boolean>;
  platform: string;
  app_version: string | null;
  created_at: string;
}

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let enabled = true;

/**
 * Whose events these are.
 *
 * A plain value the auth store keeps updated, rather than something read from
 * the session on each call, so track() stays synchronous — and so an event
 * fired during sign-out cannot resurrect a user id.
 */
let currentUserId: string | null = null;

export function setAnalyticsUser(userId: string | null): void {
  currentUserId = userId;
}

const APP_VERSION =
  (Constants.expoConfig?.version as string | undefined) ?? null;

/**
 * Turn recording off for the rest of the process.
 *
 * Called when a write is rejected in a way that retrying cannot fix — the table
 * is missing, or the policy refuses us. Retrying every 15 seconds for the whole
 * session would turn one misconfiguration into a stream of failed requests.
 */
function disable(reason: string): void {
  if (!enabled) return;
  enabled = false;
  queue = [];
  console.warn(`[analytics] disabled for this session: ${reason}`);
}

async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!enabled || queue.length === 0) return;

  const batch = queue;
  queue = [];
  const { error } = await supabase.from("analytics_events").insert(batch);
  if (!error) return;

  // 42P01 is "no such table" and 42501 is "policy refused"; neither is
  // transient, so stop rather than retry forever.
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "42501") {
    disable(error.message);
    return;
  }
  // Anything else may be a dropped connection. Put the batch back at the front
  // so ordering survives, and let the next flush try again.
  queue = [...batch, ...queue].slice(-MAX_QUEUE);
}

function scheduleFlush(): void {
  if (timer || !enabled) return;
  timer = setTimeout(() => void flush(), FLUSH_INTERVAL_MS);
}

/**
 * Record something.
 *
 * Fire and forget by design: no await, no throw, no return value the caller
 * could branch on. Anything a caller needs to know about should not be an
 * analytics call.
 */
export function track(
  event: string,
  properties: Record<string, unknown> = {},
): void {
  if (!enabled) return;
  try {
    const safe = sanitizeEvent(event, properties);
    // Unknown event, or one whose properties were all rejected. Dropping it is
    // the designed behaviour, not an error.
    if (!safe) return;

    queue.push({
      user_id: currentUserId,
      event: safe.event,
      properties: safe.properties,
      platform: Platform.OS,
      app_version: APP_VERSION,
      created_at: new Date().toISOString(),
    });

    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
    if (queue.length >= BATCH_SIZE) void flush();
    else scheduleFlush();
  } catch (error) {
    // Never let recording break the thing being recorded.
    console.warn(`[analytics] dropped "${event}":`, error);
  }
}

/**
 * Send anything queued.
 *
 * Called when the app goes to the background, which on a phone is the last
 * moment before the process may be frozen or killed.
 */
export function startAnalytics(): () => void {
  const subscription = AppState.addEventListener("change", (state) => {
    if (state !== "active") void flush();
  });
  return () => {
    subscription.remove();
    void flush();
  };
}

/** Test seam. */
export function __resetAnalyticsForTests(): void {
  queue = [];
  enabled = true;
  currentUserId = null;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
