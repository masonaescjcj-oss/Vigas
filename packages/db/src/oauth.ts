import { and, eq, gt, isNull } from 'drizzle-orm';
import type { CreatedApiKey } from '@vigas/core';
import { pkceChallengeS256, randomBase62, safeEqual, sha256Hex, validateCallbackUrl } from '@vigas/core/server';
import { createApiKey } from './billing';
import type { Db } from './client';
import { oauthCodes } from './schema';

export const OAUTH_CODE_TTL_MS = 10 * 60_000;

export interface CreateAuthCodeInput {
  userId: string;
  accountId: string;
  appName: string;
  callbackUrl: string;
  codeChallenge: string;
  challengeMethod?: 'S256' | 'plain';
  /** Optional monthly cap for the key the app receives. */
  keyLimitMicros?: number | null;
}

export class OAuthError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid_callback_url' | 'invalid_challenge' | 'invalid_code' | 'invalid_verifier',
  ) {
    super(message);
  }
}

/**
 * Called after the signed-in user approves the app on the consent page. Returns the URL to
 * redirect the browser to (the callback with `?code=…`).
 */
export async function createAuthCode(db: Db, input: CreateAuthCodeInput): Promise<{ code: string; redirectUrl: string }> {
  const callback = validateCallbackUrl(input.callbackUrl);
  if (!callback) throw new OAuthError('callback_url must be https (or http://localhost)', 'invalid_callback_url');
  const method = input.challengeMethod ?? 'S256';
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(input.codeChallenge)) {
    throw new OAuthError('code_challenge must be 43–128 URL-safe characters', 'invalid_challenge');
  }
  const code = randomBase62(40);
  await db.insert(oauthCodes).values({
    codeHash: sha256Hex(code),
    userId: input.userId,
    accountId: input.accountId,
    appName: input.appName.trim().slice(0, 60) || 'App',
    callbackUrl: callback,
    codeChallenge: input.codeChallenge,
    challengeMethod: method,
    keyLimitMicros: input.keyLimitMicros && input.keyLimitMicros > 0 ? Math.round(input.keyLimitMicros) : null,
    expiresAt: new Date(Date.now() + OAUTH_CODE_TTL_MS),
  });
  const url = new URL(callback);
  url.searchParams.set('code', code);
  return { code, redirectUrl: url.toString() };
}

/**
 * Exchanges a one-time code and its PKCE verifier for a new API key on the user's account.
 * Codes expire after 10 minutes and work once.
 */
export async function exchangeAuthCode(
  db: Db,
  input: { code: string; codeVerifier: string },
): Promise<CreatedApiKey & { userId: string; appName: string }> {
  // Consume the code first, atomically, so it can never be exchanged twice. No transaction on
  // purpose: a wrong verifier must still burn the code (someone else may be holding it).
  const [row] = await db
    .update(oauthCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(oauthCodes.codeHash, sha256Hex(input.code)), isNull(oauthCodes.usedAt), gt(oauthCodes.expiresAt, new Date())))
    .returning();
  if (!row) throw new OAuthError('Code is invalid, expired or already used', 'invalid_code');
  const expected = row.challengeMethod === 'S256' ? pkceChallengeS256(input.codeVerifier) : input.codeVerifier;
  if (!safeEqual(expected, row.codeChallenge)) {
    throw new OAuthError('code_verifier does not match code_challenge', 'invalid_verifier');
  }
  const key = await createApiKey(db, row.accountId, `${row.appName} (Sign in with Vigas)`, {
    monthlyLimitMicros: row.keyLimitMicros,
  });
  return { ...key, userId: row.userId, appName: row.appName };
}
