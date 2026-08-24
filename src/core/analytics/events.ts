/**
 * frontend/src/core/analytics/events.ts
 * ---------------------------------------------------------------------------
 * What may be recorded about how the product is used.
 *
 * The agent's own system prompt promises never to send the user's repository,
 * history or session state anywhere. Analytics that shipped prompts, file names
 * or project titles would break that promise from a different direction, so the
 * shape of an event is fixed here rather than left to each call site.
 *
 * Two rules, both fail-closed:
 *
 *   - An event name not in this table is dropped. A typo becomes silence rather
 *     than a new column of garbage nobody notices for a month.
 *   - Properties are **allow-listed per event**. A deny-list of "prompt",
 *     "content", "path"… always misses the next one; this way a new key has to
 *     be added on purpose before it can ever leave the device.
 *
 * Values are bucketed, counted or enumerated — never free text. "How long did
 * builds take" is answerable from a bucket; it does not need the prompt.
 * ---------------------------------------------------------------------------
 */

/** Every event, with the property keys it is allowed to carry. */
export const EVENT_SCHEMA = {
  // ── Account
  signed_up: [],
  signed_in: [],
  signed_out: [],

  // ── The funnel that decides whether this product works
  project_created: ["template"],
  build_started: ["model", "skill_count", "has_own_provider"],
  build_finished: ["outcome", "duration_bucket", "tool_count", "step_count"],
  preview_opened: ["kind"],

  // ── What people do with a result
  share_published: [],
  project_exported: [],
  deploy_started: ["target"],

  // ── Money
  paywall_seen: ["reason"],
  checkout_started: ["plan"],
  model_locked_tapped: ["required_tier"],

  // ── Signals that something is wrong
  limit_reached: ["kind"],
  run_failed: ["reason"],
} as const;

export type EventName = keyof typeof EVENT_SCHEMA;

/** A property value that carries no user-authored text. */
export type SafeValue = string | number | boolean;

export interface AnalyticsEvent {
  event: EventName;
  properties: Record<string, SafeValue>;
}

/** Longest a property string may be. Anything longer is not an enum value. */
const MAX_VALUE_LENGTH = 40;

export function isEventName(value: unknown): value is EventName {
  return typeof value === "string" && Object.hasOwn(EVENT_SCHEMA, value);
}

/**
 * Bucket a duration instead of recording it.
 *
 * Exact milliseconds are close to an identifier when combined with a timestamp;
 * buckets answer "are builds getting slower" without being one.
 */
export function durationBucket(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "unknown";
  if (ms < 5_000) return "under_5s";
  if (ms < 15_000) return "5_15s";
  if (ms < 30_000) return "15_30s";
  if (ms < 60_000) return "30_60s";
  if (ms < 180_000) return "1_3m";
  return "over_3m";
}

/**
 * Keep only what this event is allowed to carry.
 *
 * Returns null for an unknown event, so the caller sends nothing at all rather
 * than something half-formed.
 */
export function sanitizeEvent(
  event: unknown,
  properties: Record<string, unknown> = {},
): AnalyticsEvent | null {
  if (!isEventName(event)) return null;

  const allowed = EVENT_SCHEMA[event] as readonly string[];
  const safe: Record<string, SafeValue> = {};

  for (const key of allowed) {
    const value = properties[key];
    if (value === undefined || value === null) continue;

    if (typeof value === "number") {
      // Non-finite numbers are not data, and JSON cannot hold them anyway.
      if (Number.isFinite(value)) safe[key] = value;
      continue;
    }
    if (typeof value === "boolean") {
      safe[key] = value;
      continue;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      // Truncated rather than dropped: a long value here means a caller passed
      // something it should not have, and a clipped marker is easier to notice
      // in the data than an absent key.
      if (trimmed) safe[key] = trimmed.slice(0, MAX_VALUE_LENGTH);
      continue;
    }
    // Objects and arrays are exactly how a payload smuggles content out.
  }

  return { event, properties: safe };
}
