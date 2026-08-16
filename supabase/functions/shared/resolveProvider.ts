/**
 * supabase/functions/shared/resolveProvider.ts
 * ---------------------------------------------------------------------------
 * Which credentials a run or a question should use.
 *
 * A user who has added their own provider pays for their own tokens, so theirs
 * wins. Everyone else gets the server's. The key is decrypted here, at the
 * moment of use, and returned to the caller — it is never written into a job
 * payload, a session row, or a log line, because those are all readable by
 * anything holding the service role.
 * ---------------------------------------------------------------------------
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { openSecret } from "./secretBox.ts";

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
  if (error || !data || data.length === 0) return {};

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
    return {};
  }
}
