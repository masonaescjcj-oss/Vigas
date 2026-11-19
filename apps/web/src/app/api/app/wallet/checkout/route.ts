import { z } from 'zod';
import type { CheckoutStartResponse } from '@vigas/core';
import {
  completeTopup,
  createPendingTopup,
  deletePendingTopup,
  getDb,
  setTopupProviderRef,
} from '@vigas/db';
import { activePaymentMode, createAvexPayCheckout } from '@/lib/avexpay';
import { absoluteUrl, serverEnv } from '@/lib/env';
import { apiError, privateJson, rateLimit, readJson, requireAuth } from '@/lib/http';
import { PREVIEW_MESSAGE, PREVIEW_MODE } from '@/lib/preview';

const MIN = 1_000_000; // $1
const MAX = 1_000_000_000; // $1,000

const schema = z.object({
  amountMicros: z
    .number()
    .int('amountMicros must be an integer.')
    .min(MIN, 'The minimum top-up is $1.')
    .max(MAX, 'The maximum top-up is $1,000.'),
});

export async function POST(req: Request) {
  if (PREVIEW_MODE) return apiError(503, 'preview_mode', PREVIEW_MESSAGE);
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const env = serverEnv();
  const mode = activePaymentMode(env);
  if (mode === 'none') {
    return apiError(501, 'payments_not_configured', 'Payments are not configured yet. Set AVEXPAY_API_KEY or PAYMENT_PROVIDER=test.');
  }

  const limited = rateLimit(`checkout:${auth.user.id}`, 12, 300_000);
  if (limited) return limited;

  const body = await readJson(req, schema);
  if (!body.ok) return body.res;

  const db = getDb();

  if (mode === 'test') {
    const result = await completeTopup(db, {
      accountId: auth.user.accountId,
      amountMicros: body.data.amountMicros,
      feeBps: env.topupFeeBps,
      provider: 'test',
    });
    const payload: CheckoutStartResponse = {
      mode: 'instant',
      provider: 'test',
      reference: 'test',
      amountMicros: body.data.amountMicros,
      feeMicros: result.feeMicros,
      totalMicros: result.chargedMicros,
      balanceMicros: result.balanceMicros,
    };
    return privateJson(payload);
  }

  const pending = await createPendingTopup(db, {
    accountId: auth.user.accountId,
    amountMicros: body.data.amountMicros,
    feeBps: env.topupFeeBps,
    provider: 'avexpay',
  });

  const successUrl = absoluteUrl(`/dashboard?checkout=success&ref=${encodeURIComponent(pending.id)}`);
  const cancelUrl = absoluteUrl(`/dashboard?checkout=cancelled&ref=${encodeURIComponent(pending.id)}`);

  try {
    const session = await createAvexPayCheckout({
      amountFiatMicros: pending.totalMicros,
      reference: pending.id,
      description: `Vigas credits ($${(pending.amountMicros / 1_000_000).toFixed(2)})`,
      successUrl,
      cancelUrl,
    });
    await setTopupProviderRef(db, pending.id, session.sessionId);

    const payload: CheckoutStartResponse = {
      mode: 'redirect',
      provider: 'avexpay',
      reference: pending.id,
      checkoutUrl: session.url,
      amountMicros: pending.amountMicros,
      feeMicros: pending.feeMicros,
      totalMicros: pending.totalMicros,
    };
    return privateJson(payload);
  } catch (err) {
    await deletePendingTopup(db, pending.id).catch(() => undefined);
    const msg = err instanceof Error ? err.message : 'Could not start AvexPay checkout.';
    return apiError(502, 'checkout_provider_failed', msg);
  }
}
