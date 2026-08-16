/**
 * frontend/src/services/providerService.ts
 * ---------------------------------------------------------------------------
 * The API providers a user brings themselves.
 *
 * The key is write-only from here: it goes up once, and everything that comes
 * back describes the provider without it. There is no "show key" call to build
 * later, because the backend cannot answer one — it stores ciphertext and the
 * client never gets the decryption secret.
 * ---------------------------------------------------------------------------
 */

import { invokeFunction } from "./functionsClient";

export interface UserProvider {
  id: string;
  label: string;
  base_url: string;
  /** Last four characters of the key, so two keys can be told apart. */
  key_last4: string;
  model: string | null;
  /** When a test call last succeeded. Null means it has never worked. */
  verified_at: string | null;
  last_error: string | null;
  created_at: string;
}

export async function listProviders(): Promise<UserProvider[]> {
  const data = await invokeFunction<{ providers?: UserProvider[] }>("provider-keys", {
    body: { action: "list" },
  });
  return data.providers ?? [];
}

/**
 * The backend makes one real call to the provider before storing anything, so
 * a rejected key fails here rather than in the middle of a build.
 */
export async function addProvider(input: {
  label: string;
  baseUrl: string;
  apiKey: string;
  model?: string;
}): Promise<UserProvider> {
  const data = await invokeFunction<{ provider: UserProvider }>("provider-keys", {
    body: {
      action: "add",
      label: input.label.trim(),
      baseUrl: input.baseUrl.trim(),
      apiKey: input.apiKey.trim(),
      ...(input.model?.trim() ? { model: input.model.trim() } : {}),
    },
  });
  return data.provider;
}

/** Re-check a stored provider — keys get revoked and endpoints move. */
export async function testProvider(id: string): Promise<{ ok: boolean; detail: string }> {
  return invokeFunction("provider-keys", { body: { action: "test", id } });
}

export async function deleteProvider(id: string): Promise<void> {
  await invokeFunction("provider-keys", { body: { action: "delete", id } });
}
