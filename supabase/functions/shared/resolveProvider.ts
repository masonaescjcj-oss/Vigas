/**
 * supabase/functions/shared/resolveProvider.ts
 * ---------------------------------------------------------------------------
 * Which credentials a run or a question should use.
 *
 * Three sources, in this order:
 *
 *   1. the user's own provider — they pay for their own tokens, so theirs wins
 *   2. the platform key pool the admin panel manages
 *   3. the server's environment
 *
 * Step 2 was missing. The admin panel wrote keys to `platform_providers` and
 * poolClient.ts knew how to read them, but nothing connected the two: adding or
 * changing a key in the panel had no effect on a build, which kept using
 * OPENAI_API_KEY from the worker's environment. The panel looked like it worked
 * and did nothing, which is worse than not having it.
 *
 * The key is decrypted here, at the moment of use, and returned to the caller —
 * it is never written into a job payload, a session row, or a log line, because
 * those are all readable by anything holding the service role.
 * ---------------------------------------------------------------------------
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { openSecret } from "./secretBox.ts";
import { poolCandidates } from "./poolClient.ts";

export interface ResolvedProvider {
  /** Absent means "use the server's configured provider". */
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  /** For telling the user which credentials a run used. Never the key. */
  label?: string;
}

/**
 * @param providerId Pick a specific one; otherwise the earliest verified.
 */
export async function resolveProvider(
  service: SupabaseClient,
  userId: string,
  providerId?: string | null,
): Promise<ResolvedProvider> {
  let query = service
    .from("user_providers")
    .select("id,label,base_url,key_cipher,model,verified_at")
    .eq("user_id", userId);

  if (providerId) {
    query = query.eq("id", providerId);
  } else {
    // An unverified provider is one we know does not work; falling back to the
    // server's is better than failing a run the user did not ask to fail.
    query = query.not("verified_at", "is", null);
  }

  const { data, error } = await query.order("created_at", { ascending: true }).limit(1);
  if (error || !data || data.length === 0) return await resolvePlatformProvider(service);

  const row = data[0];
  try {
    return {
      apiKey: await openSecret(String(row.key_cipher)),
      baseUrl: String(row.base_url),
      model: row.model ? String(row.model) : undefined,
      label: String(row.label),
    };
  } catch {
    // Undecryptable (the encryption secret was rotated). Fall back rather than
    // stop the user working; provider-keys will report it when they next test.
    return await resolvePlatformProvider(service);
  }
}

/**
 * The operator's own key, from the pool the admin panel manages.
 *
 * Highest-priority healthy key wins; `orderKeys` has already put exhausted and
 * failing ones last. Only the first is returned because this is the resolution
 * step — mid-request failover across the rest of the pool is poolClient's job
 * and belongs where the request is actually made.
 *
 * An empty pool is the normal case for a fresh install, so it is not an error:
 * the caller falls through to the environment.
 */
async function resolvePlatformProvider(service: SupabaseClient): Promise<ResolvedProvider> {
  try {
    // restedOnly: a run takes the first candidate and never revisits the pool,
    // so a key inside its cool-down must be skipped rather than ranked last.
    // Otherwise one bad key an operator pasted in becomes the only key, and
    // every user is stuck behind it until somebody notices. Falling through to
    // the server's own key is the whole point of having one.
    const candidates = await poolCandidates(service, true);
    const best = candidates[0];
    if (!best) return {};
    return {
      apiKey: best.apiKey,
      baseUrl: best.baseUrl,
      model: best.model,
      label: best.label,
    };
  } catch {
    // The pool is a convenience over the environment key, never a reason to
    // fail a run the user asked for.
    return {};
  }
}
