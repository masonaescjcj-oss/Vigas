/**
 * supabase/functions/shared/secretBox.ts
 * ---------------------------------------------------------------------------
 * Encrypting user API keys at rest.
 *
 * The keys users paste in are payment instruments, so the database must not be
 * enough to read them. The encryption key lives in the edge function's
 * environment (PROVIDER_KEY_SECRET), never in Postgres — a database dump on its
 * own is then ciphertext and nothing else.
 *
 * AES-256-GCM via WebCrypto: authenticated, so a tampered ciphertext fails to
 * decrypt rather than silently returning wrong bytes. A fresh 12-byte nonce per
 * encryption is prepended to the payload, because reusing a nonce with GCM
 * leaks the key stream.
 * ---------------------------------------------------------------------------
 */

import { AppError } from "./errorHandler.ts";

const NONCE_BYTES = 12;

let cached: CryptoKey | null = null;

async function encryptionKey(): Promise<CryptoKey> {
  if (cached) return cached;

  const secret = Deno.env.get("PROVIDER_KEY_SECRET");
  if (!secret || secret.length < 32) {
    throw new AppError(
      500,
      "SERVER_MISCONFIGURED",
      "PROVIDER_KEY_SECRET is not configured (needs at least 32 characters).",
    );
  }

  // The secret is a passphrase, not 32 raw bytes, so derive a key of the right
  // length from it deterministically.
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  cached = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
  return cached;
}

/** Only for tests, which set a different secret between cases. */
export function resetEncryptionKey(): void {
  cached = null;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Returns base64 of nonce ‖ ciphertext. */
export async function sealSecret(plaintext: string): Promise<string> {
  const key = await encryptionKey();
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    new TextEncoder().encode(plaintext),
  );
  const payload = new Uint8Array(nonce.length + sealed.byteLength);
  payload.set(nonce, 0);
  payload.set(new Uint8Array(sealed), nonce.length);
  return toBase64(payload);
}

export async function openSecret(sealed: string): Promise<string> {
  const key = await encryptionKey();
  let payload: Uint8Array;
  try {
    payload = fromBase64(sealed);
  } catch {
    throw new AppError(500, "SECRET_UNREADABLE", "Stored key is not readable.");
  }
  if (payload.length <= NONCE_BYTES) {
    throw new AppError(500, "SECRET_UNREADABLE", "Stored key is not readable.");
  }

  try {
    const opened = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: payload.slice(0, NONCE_BYTES) },
      key,
      payload.slice(NONCE_BYTES),
    );
    return new TextDecoder().decode(opened);
  } catch {
    // Wrong secret, or the ciphertext was altered. Both mean the same thing to
    // the caller, and neither should say which.
    throw new AppError(
      500,
      "SECRET_UNREADABLE",
      "Stored key could not be decrypted. Re-add the provider.",
    );
  }
}

/** What the UI shows so a user can tell two keys apart. */
export function lastFour(key: string): string {
  const trimmed = key.trim();
  return trimmed.length <= 4 ? trimmed : trimmed.slice(-4);
}
