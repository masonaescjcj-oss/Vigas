import type { CheckoutStatusResponse } from '@vigas/core';
import {
  completePendingTopup,
  failPendingTopup,
  getAccount,
  getDb,
  getTopupByAccount,
} from '@vigas/db';
import { fetchAvexPayCheckout } from '@/lib/avexpay';
import { serverEnv } from '@/lib/env';
import { apiError, privateJson, requireAuth } from '@/lib/http';
import { PREVIEW_MESSAGE, PREVIEW_MODE } from '@/lib/preview';

export async function GET(req: Request, ctx: RouteContext<'/api/app/wallet/checkout/[reference]'>) {
  if (PREVIEW_MODE) return apiError(503, 'preview_mode', PREVIEW_MESSAGE);
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const { reference } = await ctx.params;
  if (!reference || reference.length > 100) {
    return apiError(400, 'invalid_reference', 'Invalid checkout reference.');
  }

  const db = getDb();
  let row = await getTopupByAccount(db, auth.user.accountId, reference);
  if (!row) return apiError(404, 'not_found', 'Checkout session not found.');

  const env = serverEnv();
  if (row.status === 'pending' && row.provider === 'avexpay' && row.providerRef && env.avexpayApiKey) {
    try {
      const remote = await fetchAvexPayCheckout(row.providerRef);
      if (remote) {
        if (remote.normalizedStatus === 'paid') {
          await completePendingTopup(db, {
            topupId: row.id,
            providerRef: remote.id,
            ...(remote.settledMicros !== undefined ? { settledMicros: remote.settledMicros } : {}),
          });
        } else if (remote.normalizedStatus === 'expired' || remote.normalizedStatus === 'failed') {
          await failPendingTopup(db, row.id, remote.id);
        }
        row = (await getTopupByAccount(db, auth.user.accountId, reference)) ?? row;
      }
    } catch {
      // Leave row pending if gateway lookup fails transiently; webhook will reconcile.
    }
  }

  const acc = await getAccount(db, auth.user.accountId);
  const payload: CheckoutStatusResponse = {
    reference: row.id,
    status: row.status,
    provider: row.provider,
    amountMicros: row.amountMicros,
    feeMicros: row.feeMicros,
    balanceMicros: acc?.balanceMicros ?? 0,
  };
  return privateJson(payload);
}
