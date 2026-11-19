import { parseAvexPayWebhookPayload, verifyAvexPaySignature } from '@vigas/core';
import {
  completePendingTopup,
  failPendingTopup,
  getDb,
  getTopupById,
  reverseTopupById,
} from '@vigas/db';
import { serverEnv } from '@/lib/env';
import { apiError, privateJson } from '@/lib/http';
import { PREVIEW_MESSAGE, PREVIEW_MODE } from '@/lib/preview';

const MAX_BODY_BYTES = 64_000;

export async function POST(req: Request) {
  if (PREVIEW_MODE) return apiError(503, 'preview_mode', PREVIEW_MESSAGE);

  const env = serverEnv();
  if (!env.avexpayWebhookSecret) {
    return apiError(500, 'server_misconfigured', 'AVEXPAY_WEBHOOK_SECRET is not configured.');
  }

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return apiError(413, 'payload_too_large', 'Webhook payload is too large.');
  }

  const verified = await verifyAvexPaySignature({
    rawBody,
    signatureHeader: req.headers.get('avex-signature'),
    webhookSecret: env.avexpayWebhookSecret,
  });
  if (!verified.ok) {
    return apiError(401, 'invalid_webhook_signature', 'Webhook signature verification failed.');
  }

  let parsed;
  try {
    parsed = parseAvexPayWebhookPayload(rawBody, req.headers);
  } catch {
    return apiError(400, 'invalid_json', 'Malformed webhook payload.');
  }

  if (parsed.mode && parsed.mode !== env.avexpayMode) {
    return apiError(400, 'mode_mismatch', `Ignored ${parsed.mode} webhook while configured for ${env.avexpayMode} mode.`);
  }

  if (!parsed.reference) {
    return apiError(400, 'missing_reference', 'Webhook did not include a top-up reference.');
  }

  const db = getDb();
  const row = await getTopupById(db, parsed.reference);
  if (!row) {
    return apiError(404, 'unknown_checkout', 'No matching checkout top-up found.');
  }

  if (parsed.status === 'paid') {
    const settled = await completePendingTopup(db, {
      topupId: row.id,
      providerRef: parsed.invoiceId || row.providerRef || undefined,
      ...(parsed.settledMicros > 0 ? { settledMicros: parsed.settledMicros } : {}),
    });
    if (!settled.ok) {
      return privateJson({ ok: true, granted: false, reason: settled.reason });
    }
    return privateJson({
      ok: true,
      granted: !settled.alreadySucceeded,
      duplicate: settled.alreadySucceeded,
    });
  }

  if (parsed.status === 'pending') {
    return privateJson({ ok: true, granted: false, status: 'pending' });
  }

  if (parsed.status === 'reversed') {
    const reversed = await reverseTopupById(db, row.id);
    return privateJson({ ok: true, granted: false, reversed });
  }

  await failPendingTopup(db, row.id, parsed.invoiceId || undefined);
  return privateJson({ ok: true, granted: false, status: parsed.status });
}
