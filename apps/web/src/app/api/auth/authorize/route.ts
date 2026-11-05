import { z } from 'zod';
import { createAuthCode, getDb, OAuthError } from '@vigas/db';
import { apiError, privateJson, readJson, requireAuth } from '@/lib/http';

const bodySchema = z.object({
  callbackUrl: z.string().min(8).max(2000),
  codeChallenge: z.string().min(43).max(128),
  codeChallengeMethod: z.enum(['S256', 'plain']).default('S256'),
  app: z.string().trim().min(1).max(60),
  limitMicros: z.number().int().min(1_000_000).max(100_000_000_000).nullable().optional(),
});

/**
 * Approves a "Sign in with Vigas" request: creates a one-time code and returns the callback URL to
 * send the browser to. Cookie session only — an app must never be able to approve itself.
 */
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  if (auth.via !== 'cookie') return apiError(403, 'cookie_required', 'Approve apps from the Vigas website.');
  const parsed = await readJson(req, bodySchema);
  if (!parsed.ok) return parsed.res;
  const b = parsed.data;
  try {
    const { redirectUrl } = await createAuthCode(getDb(), {
      userId: auth.user.id,
      accountId: auth.user.accountId,
      appName: b.app,
      callbackUrl: b.callbackUrl,
      codeChallenge: b.codeChallenge,
      challengeMethod: b.codeChallengeMethod,
      keyLimitMicros: b.limitMicros ?? null,
    });
    return privateJson({ redirectUrl });
  } catch (err) {
    if (err instanceof OAuthError) return apiError(400, err.code, err.message);
    throw err;
  }
}
