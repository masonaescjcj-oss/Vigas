import { looksLikeApiKey, safeEqual } from '@vigas/core/server';
import { authenticateApiKey, getAccount, type Db, type UsageSource } from '@vigas/db';
import type { GatewayConfig } from './config';

export interface Caller {
  accountId: string;
  apiKeyId: string | null;
  source: UsageSource;
  /** Key used for rate limiting. */
  limitKey: string;
}

export type AuthResult = { ok: true; caller: Caller } | { ok: false; status: number; message: string };

const INTERNAL_SOURCES = new Set<UsageSource>(['chat', 'arena', 'retrobuild']);

/**
 * Two ways in:
 * - a customer API key: `Authorization: Bearer sk-vg-v1-…`
 * - Vigas' own apps (website chat, Arena, RetroBuild): the internal service token plus
 *   `X-Vigas-Account` and `X-Vigas-Source` headers.
 */
export async function authenticate(db: Db, config: GatewayConfig, headers: Headers): Promise<AuthResult> {
  const auth = headers.get('authorization') ?? '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, message: 'Missing API key. Send it as "Authorization: Bearer sk-vg-v1-…".' };

  if (config.internalServiceToken && safeEqual(token, config.internalServiceToken)) {
    const accountId = headers.get('x-vigas-account') ?? '';
    const source = (headers.get('x-vigas-source') ?? 'chat') as UsageSource;
    if (!accountId || !INTERNAL_SOURCES.has(source)) return { ok: false, status: 400, message: 'Invalid internal request headers' };
    const account = await getAccount(db, accountId);
    if (!account) return { ok: false, status: 401, message: 'Unknown account' };
    return { ok: true, caller: { accountId, apiKeyId: null, source, limitKey: `acct:${accountId}` } };
  }

  if (!looksLikeApiKey(token)) return { ok: false, status: 401, message: 'Invalid API key' };
  const key = await authenticateApiKey(db, token);
  if (!key) return { ok: false, status: 401, message: 'Invalid or revoked API key' };
  return { ok: true, caller: { accountId: key.accountId, apiKeyId: key.apiKeyId, source: 'api', limitKey: `key:${key.apiKeyId}` } };
}
