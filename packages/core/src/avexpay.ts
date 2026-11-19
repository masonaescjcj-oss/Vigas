/**
 * Pure AvexPay.net API v1 helpers (https://avexpay.net/docs).
 * Uses Web Crypto so it runs identically in Node, Next.js Edge/Server, and Deno Edge Functions.
 */

export const AVEXPAY_DEFAULT_BASE_URL = 'https://api.avexpay.net/v1';
export const AVEXPAY_DEFAULT_TOLERANCE_SECONDS = 300;

export type AvexPayMode = 'live' | 'test';

export type AvexPayEventType =
  | 'invoice.paid'
  | 'invoice.overpaid'
  | 'invoice.confirming'
  | 'invoice.underpaid'
  | 'invoice.expired'
  | 'payment.reversed';

export type AvexPayNormalizedStatus = 'paid' | 'pending' | 'expired' | 'failed' | 'reversed';

export interface ParsedAvexSignature {
  timestamp: number;
  signatures: string[];
}

/** Parses `t=<unix_seconds>,v1=<hex>` (supports comma-separated parts and multiple v1 signatures). */
export function parseAvexSignatureHeader(header: string | null | undefined): ParsedAvexSignature | null {
  if (!header) return null;
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of header.split(',')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim().toLowerCase();
    const value = trimmed.slice(eq + 1).trim();
    if (!value) continue;
    if (key === 't') {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed > 0) timestamp = parsed;
    } else if (key === 'v1') {
      signatures.push(value.toLowerCase());
    }
  }

  if (timestamp === null || signatures.length === 0) return null;
  return { timestamp, signatures };
}

function constantTimeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function signAvexPayPayload(
  timestamp: number,
  rawBody: string,
  webhookSecret: string,
): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface VerifyAvexSignatureResult {
  ok: boolean;
  reason?: string;
  timestamp?: number;
}

/**
 * Verifies the `avex-signature` header (`t=<sec>,v1=<hex>`) against `${t}.${rawBody}`
 * and checks that the timestamp is within `toleranceSeconds` (default 300s).
 */
export async function verifyAvexPaySignature(input: {
  rawBody: string;
  signatureHeader: string | null | undefined;
  webhookSecret: string | null | undefined;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): Promise<VerifyAvexSignatureResult> {
  const secret = input.webhookSecret?.trim();
  if (!secret) {
    return { ok: false, reason: 'missing_webhook_secret' };
  }
  const parsed = parseAvexSignatureHeader(input.signatureHeader);
  if (!parsed) {
    return { ok: false, reason: 'malformed_signature_header' };
  }

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = input.toleranceSeconds ?? AVEXPAY_DEFAULT_TOLERANCE_SECONDS;
  if (Math.abs(now - parsed.timestamp) > tolerance) {
    return { ok: false, reason: 'timestamp_out_of_range' };
  }

  const expected = await signAvexPayPayload(parsed.timestamp, input.rawBody, secret);
  const matched = parsed.signatures.some((sig) => constantTimeHexEqual(sig, expected));
  if (!matched) {
    return { ok: false, reason: 'signature_mismatch' };
  }
  return { ok: true, timestamp: parsed.timestamp };
}

export interface NormalizedAvexPayWebhook {
  eventId: string;
  event: AvexPayEventType | string;
  mode: AvexPayMode | string | null;
  invoiceId: string;
  reference: string;
  requestedMicros: number;
  settledMicros: number;
  status: AvexPayNormalizedStatus;
}

function parseMicros(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.round(value);
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return Number.isSafeInteger(n) ? n : 0;
  }
  return 0;
}

export function normalizeAvexPayEventStatus(event: string): AvexPayNormalizedStatus {
  switch (event) {
    case 'invoice.paid':
    case 'invoice.overpaid':
      return 'paid';
    case 'invoice.confirming':
    case 'confirming':
    case 'pending':
      return 'pending';
    case 'invoice.expired':
    case 'expired':
      return 'expired';
    case 'payment.reversed':
    case 'reversed':
      return 'reversed';
    case 'invoice.underpaid':
    case 'underpaid':
    default:
      return 'failed';
  }
}

export function normalizeAvexPayStatusField(status: string): AvexPayNormalizedStatus {
  switch (status.toLowerCase()) {
    case 'paid':
    case 'overpaid':
    case 'settled':
    case 'completed':
    case 'succeeded':
      return 'paid';
    case 'open':
    case 'pending':
    case 'confirming':
    case 'processing':
      return 'pending';
    case 'expired':
      return 'expired';
    case 'reversed':
    case 'refunded':
      return 'reversed';
    default:
      return 'failed';
  }
}

/**
 * Parses an AvexPay webhook JSON object into normalized facts.
 * Accepts both flat AvexPay payloads and `{ data: { ... } }` envelope shapes.
 */
export function parseAvexPayWebhookPayload(
  rawBody: string,
  headers?: Headers | Record<string, string | undefined>,
): NormalizedAvexPayWebhook {
  const payload = JSON.parse(rawBody) as Record<string, unknown>;
  const data =
    payload.data && typeof payload.data === 'object' ? (payload.data as Record<string, unknown>) : payload;

  const headerEvent =
    headers instanceof Headers ? headers.get('avex-event') : headers?.['avex-event'];
  const headerIdem =
    headers instanceof Headers ? headers.get('avex-idempotency-key') : headers?.['avex-idempotency-key'];

  const event = String(payload.event ?? payload.type ?? headerEvent ?? '');
  const eventId = String(payload.id ?? payload.eventId ?? headerIdem ?? `${data.invoiceId ?? data.id ?? ''}:${event}`);
  const modeRaw = payload.mode ?? data.mode;
  const mode = typeof modeRaw === 'string' && modeRaw ? modeRaw.toLowerCase() : null;
  const invoiceId = String(data.invoiceId ?? data.checkoutSessionId ?? data.id ?? payload.invoiceId ?? '');
  const reference = String(data.reference ?? payload.reference ?? '');
  const requestedMicros = parseMicros(data.amountFiatMicros ?? payload.amountFiatMicros);
  const explicitSettled = parseMicros(
    data.paidFiatMicros ??
      data.settledFiatMicros ??
      data.receivedFiatMicros ??
      payload.paidFiatMicros ??
      payload.settledFiatMicros,
  );
  const status = normalizeAvexPayEventStatus(event);
  const settledMicros = explicitSettled > 0 ? explicitSettled : status === 'paid' ? requestedMicros : 0;

  return {
    eventId,
    event,
    mode,
    invoiceId,
    reference,
    requestedMicros,
    settledMicros,
    status,
  };
}

/** Infers AvexPay mode (`live` vs `test`) from an API key prefix (`ak_live_...` / `ak_test_...`). */
export function inferAvexPayMode(apiKey: string | null | undefined, explicitMode?: string | null): AvexPayMode {
  const m = explicitMode?.trim().toLowerCase();
  if (m === 'live' || m === 'test') return m;
  if (apiKey?.startsWith('ak_test_')) return 'test';
  return 'live';
}
