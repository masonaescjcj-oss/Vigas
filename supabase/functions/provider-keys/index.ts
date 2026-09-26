/**
 * supabase/functions/provider-keys/index.ts
 * ---------------------------------------------------------------------------
 * Managing the API providers a user brings themselves.
 *
 * Any provider is allowed — a curated list would shut out every new entrant,
 * and the endpoint the user needs is often not a famous one. What is checked is
 * that the URL describes a public API server at all (see providerGuard).
 *
 * The key is encrypted before it is stored and is never sent back: list returns
 * the last four characters and nothing more. "test" proves the key works by
 * making one real, tiny completion against the provider, so a wrong key is
 * discovered here rather than in the middle of a build.
 * ---------------------------------------------------------------------------
 */
import { withSentryHandler } from "../shared/sentry.ts";
import { ProviderKeysSchema } from "../shared/zodSchemas.ts";
import { AppError, assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient, requireUser } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { checkProviderUrl } from "../shared/providerGuard.ts";
import { lastFour, openSecret, sealSecret } from "../shared/secretBox.ts";
import { isYoucomUrl, probeYoucom } from "../shared/youcom.ts";

/** Columns the client may see. The ciphertext is not among them. */
const PUBLIC_COLUMNS = "id,label,base_url,key_last4,model,verified_at,last_error,created_at";

/**
 * One tiny completion against the provider. Cheap enough to run on every save,
 * and it turns "your key does not work" into a specific message at the moment
 * the user can still fix it.
 */
async function probeProvider(
  baseUrl: string,
  apiKey: string,
  model: string | null,
): Promise<{ ok: boolean; detail: string }> {
  // A You.com key is tested against the Agents API — its OpenAI-compatible
  // endpoint refuses ordinary keys, which would fail a key that works.
  if (isYoucomUrl(baseUrl)) {
    const result = await probeYoucom(apiKey);
    return { ok: result.ok, detail: result.detail };
  }
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model ?? "gpt-3.5-turbo",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    return {
      ok: false,
      detail: `Could not reach ${endpoint}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (response.ok) return { ok: true, detail: "" };

  const body = await response.text().catch(() => "");
  let message = body.slice(0, 300);
  try {
    message = JSON.parse(body)?.error?.message ?? message;
  } catch { /* not JSON; the raw body is the best we have */ }

  // 401/403 is a wrong key; 404 usually means the base URL is missing /v1.
  const hint = response.status === 404
    ? " (does the endpoint need /v1 on the end?)"
    : "";
  return { ok: false, detail: `${response.status}: ${message}${hint}` };
}

/**
 * The feature needs a migration. Until it is applied every call fails as an
 * "unexpected server error", which sends you looking in the wrong place — so
 * say what is actually missing.
 */
function asMissingTable(error: unknown): never | void {
  const code = (error as { code?: string } | null)?.code;
  if (code === "PGRST205" || code === "42P01") {
    throw new AppError(
      503,
      "PROVIDERS_NOT_MIGRATED",
      "Custom providers need a database migration that has not been applied yet (user_providers).",
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
    const input = await parseJson(req, ProviderKeysSchema);
    const service = createServiceClient();
    await enforceRateLimit(service, "provider-keys", user.id, 20, 60);

    if (input.action === "list") {
      const { data, error } = await service
        .from("user_providers")
        .select(PUBLIC_COLUMNS)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) { asMissingTable(error); throw error; }
      return json({ providers: data ?? [] }, 200, headers);
    }

    if (input.action === "delete") {
      const { error } = await service
        .from("user_providers")
        .delete()
        .eq("id", input.id)
        .eq("user_id", user.id);
      if (error) { asMissingTable(error); throw error; }
      return json({ ok: true }, 200, headers);
    }

    if (input.action === "test") {
      const { data, error } = await service
        .from("user_providers")
        .select("id,base_url,key_cipher,model")
        .eq("id", input.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) { asMissingTable(error); throw error; }
      if (!data) throw new AppError(404, "PROVIDER_NOT_FOUND", "Provider was not found.");

      const probe = await probeProvider(
        String(data.base_url),
        await openSecret(String(data.key_cipher)),
        data.model ? String(data.model) : null,
      );
      await service.from("user_providers").update({
        verified_at: probe.ok ? new Date().toISOString() : null,
        last_error: probe.ok ? null : probe.detail,
      }).eq("id", input.id);

      return json({ ok: probe.ok, detail: probe.detail }, 200, headers);
    }

    // add
    const verdict = checkProviderUrl(input.baseUrl!);
    if (!verdict.ok) throw new AppError(400, "INVALID_PROVIDER_URL", verdict.reason!);

    // Prove it works before storing it: a saved key that has never been tried
    // fails later, inside a run, where the message is far less useful.
    const probe = await probeProvider(verdict.normalised!, input.apiKey!, input.model ?? null);
    if (!probe.ok) {
      throw new AppError(400, "PROVIDER_REJECTED", `That provider did not accept the key. ${probe.detail}`);
    }

    const { data, error } = await service.from("user_providers").insert({
      user_id: user.id,
      label: input.label!,
      base_url: verdict.normalised!,
      key_cipher: await sealSecret(input.apiKey!),
      key_last4: lastFour(input.apiKey!),
      model: input.model ?? null,
      verified_at: new Date().toISOString(),
    }).select(PUBLIC_COLUMNS).single();

    if (error?.code === "23505") {
      throw new AppError(409, "PROVIDER_LABEL_TAKEN", "You already have a provider with that name.");
    }
    if (error) asMissingTable(error);
    if (error || !data) throw error ?? new Error("Provider insert returned no row.");

    return json({ provider: data }, 201, headers);
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("provider-keys", handler));
}
