/**
 * supabase/functions/push-register/index.ts
 * ---------------------------------------------------------------------------
 * Registering a device so the app can come and find you when a build finishes.
 *
 * The token is written only here, never by the client directly: a client that
 * could insert rows could register someone else's device against its own
 * account, or spray tokens to make the worker fan out.
 *
 * A token is unique across the table, so signing in on a device that already
 * belonged to another account **moves** it. That is deliberate — the token
 * addresses a phone, and a phone has one person holding it.
 * ---------------------------------------------------------------------------
 */
import { withSentryHandler } from "../shared/sentry.ts";
import { PushRegisterSchema } from "../shared/zodSchemas.ts";
import { AppError, assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient, requireUser } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { isExpoPushToken } from "../shared/push.ts";

/**
 * The feature needs a migration. Until it is applied, registration would fail as
 * an "unexpected server error" on every app launch.
 */
function asMissingTable(error: unknown): void {
  const code = (error as { code?: string } | null)?.code;
  if (code === "PGRST205" || code === "42P01") {
    throw new AppError(
      503,
      "PUSH_NOT_MIGRATED",
      "Notifications need a database migration that has not been applied yet (push_tokens).",
    );
  }
}

export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = corsHeaders(req);
  const early = preflight(req);
  if (early) return early;
  try {
    assertMethod(req, ["POST"]);
    const { user } = await requireUser(req);
    const input = await parseJson(req, PushRegisterSchema);
    const service = createServiceClient();
    // Registration runs on every cold start, so the limit is generous; it exists
    // to stop a loop, not to ration normal use.
    await enforceRateLimit(service, "push-register", user.id, 30, 60);

    if (input.action === "list") {
      const { data, error } = await service
        .from("push_tokens")
        .select("id,platform,device_name,last_seen_at,created_at")
        .eq("user_id", user.id)
        .is("disabled_at", null)
        .order("last_seen_at", { ascending: false });
      if (error) { asMissingTable(error); throw error; }
      // The token itself is not among the columns: it identifies a device, and
      // nothing in the app needs to read one back.
      return json({ devices: data ?? [] }, 200, headers);
    }

    if (input.action === "unregister") {
      const { error } = await service
        .from("push_tokens")
        .delete()
        .eq("token", input.token!)
        .eq("user_id", user.id);
      if (error) { asMissingTable(error); throw error; }
      return json({ ok: true }, 200, headers);
    }

    // register
    if (!isExpoPushToken(input.token!)) {
      throw new AppError(400, "INVALID_PUSH_TOKEN", "That is not an Expo push token.");
    }

    // Conflict on the token, not on (user_id, token): the same device changing
    // hands must move rather than end up registered twice. disabled_at and
    // last_error are cleared, because a device that just registered is alive
    // whatever Expo said about it last week.
    const { error } = await service
      .from("push_tokens")
      .upsert({
        user_id: user.id,
        token: input.token!,
        platform: input.platform!,
        device_name: input.deviceName ?? null,
        disabled_at: null,
        last_error: null,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: "token" });

    if (error) { asMissingTable(error); throw error; }

    return json({ ok: true }, 200, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("push-register", handler));
}
