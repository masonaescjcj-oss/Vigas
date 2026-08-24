/**
 * supabase/functions/shared/analytics.ts
 * ---------------------------------------------------------------------------
 * Recording an event from the server.
 *
 * Some things only the server knows the truth about. Whether a build actually
 * succeeded is the clearest: the client sees the run start, then the app may be
 * backgrounded, the network may drop, or the user may close it — and a funnel
 * built from client-reported outcomes would quietly under-count every failure
 * that also stopped the report.
 *
 * Same allow-list as the client, imported rather than restated, so an event can
 * never mean two different shapes depending on who sent it.
 * ---------------------------------------------------------------------------
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeEvent } from "../../../src/core/analytics/events.ts";

/**
 * Write one event. Never throws.
 *
 * A failure here must not fail the job that was being recorded — the run has
 * already happened, and losing a counter is cheaper than losing the work.
 */
export async function trackServer(
  service: SupabaseClient,
  userId: string | null,
  event: string,
  properties: Record<string, unknown> = {},
): Promise<void> {
  try {
    const safe = sanitizeEvent(event, properties);
    if (!safe) return;
    await service.from("analytics_events").insert({
      user_id: userId,
      event: safe.event,
      properties: safe.properties,
      platform: "server",
      app_version: null,
    });
  } catch (error) {
    console.warn(`[analytics] server event "${event}" dropped: ${(error as Error).message}`);
  }
}
