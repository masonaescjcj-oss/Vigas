import { describe, expect, it } from 'vitest';
import {
  AUTO_MODEL_ID,
  bradleyTerry,
  bradleyTerryWithIntervals,
  chatCompletionRequestSchema,
  costMicros,
  estimateMaxCostMicros,
  formatCompact,
  formatPricePerMillion,
  formatUsd,
  inferAvexPayMode,
  paretoFrontier,
  parseAvexSignatureHeader,
  parseAvexPayWebhookPayload,
  planRoute,
  quoteTopup,
  RouteError,
  signAvexPayPayload,
  slugify,
  usdToMicros,
  verifyAvexPaySignature,
  type Battle,
} from '../src';
import { seedArticles, seedEndpoints, seedLeaderboard, seedModels, seedTools } from '../src/seed';
import { generateApiKey, hashPassword, looksLikeApiKey, verifyPassword, safeEqual } from '../src/server';

describe('money', () => {
  it('charges per token and rounds up', () => {
    const price = { inputPerMillionMicros: usdToMicros(0.07), outputPerMillionMicros: usdToMicros(0.28) };
    // 1,000 × 0.07 + 284 × 0.28 = 149.52 micros → 150
    expect(costMicros({ promptTokens: 1000, completionTokens: 284 }, price)).toBe(150);
    expect(costMicros({ promptTokens: 0, completionTokens: 0 }, price)).toBe(0);
  });

  it('formats dollars, small amounts and free prices', () => {
    expect(formatUsd(48_200_000)).toBe('$48.20');
    expect(formatUsd(4_100)).toBe('$0.0041');
    expect(formatPricePerMillion(0)).toBe('Free');
    expect(formatPricePerMillion(70_000)).toBe('$0.07');
    expect(formatPricePerMillion(15_000_000)).toBe('$15.00');
  });

  it('keeps the first $5 of top-ups fee-free', () => {
    expect(quoteTopup(usdToMicros(5), 0, 500)).toMatchObject({ feeMicros: 0, totalMicros: usdToMicros(5) });
    // $10 with $2 already topped up: $3 free, $7 at 5% = $0.35
    expect(quoteTopup(usdToMicros(10), usdToMicros(2), 500).feeMicros).toBe(350_000);
    expect(quoteTopup(usdToMicros(25), usdToMicros(100), 500).feeMicros).toBe(1_250_000);
    expect(() => quoteTopup(0, 0, 500)).toThrow();
  });
});

describe('routing', () => {
  it('orders a model’s endpoints by price and keeps fallbacks', () => {
    const plan = planRoute({ model: 'deepseek/v4.1-flash', catalog: seedModels, endpoints: seedEndpoints });
    expect(plan.map((c) => c.endpoint.provider)).toEqual(['sevenapi', 'deepseek', 'together']);
  });

  it('moves unhealthy endpoints to the back instead of dropping them', () => {
    const plan = planRoute({
      model: 'deepseek/v4.1-flash',
      catalog: seedModels,
      endpoints: seedEndpoints,
      stats: {
        'sevenapi:deepseek/v4.1-flash': { healthy: false },
        'deepseek:deepseek/v4.1-flash': { healthy: false },
      },
    });
    expect(plan.map((c) => c.endpoint.provider)).toEqual(['together', 'sevenapi', 'deepseek']);
  });

  it('routes vigas/auto by quality, price or latency across auto-eligible models', () => {
    const ratings = Object.fromEntries(seedLeaderboard('overall').map((e) => [e.modelId, e.rating]));
    const byQuality = planRoute({ model: AUTO_MODEL_ID, catalog: seedModels, endpoints: seedEndpoints, ratings });
    expect(byQuality[0]!.model.id).toBe('anthropic/claude-fable-5.2');
    expect(byQuality).toHaveLength(3);

    const byPrice = planRoute({ model: AUTO_MODEL_ID, catalog: seedModels, endpoints: seedEndpoints, options: { sort: 'price' } });
    expect(byPrice[0]!.model.id).toBe('deepseek/v4.1-flash');
    expect(byPrice.every((c) => c.model.auto)).toBe(true);
  });

  it('honours an explicit fallback model list and fallbacks:false', () => {
    const plan = planRoute({
      model: 'openai/gpt-6-astra',
      models: ['google/gemini-4-carbon'],
      catalog: seedModels,
      endpoints: seedEndpoints,
    });
    expect(plan[0]!.model.id).toBe('openai/gpt-6-astra');
    expect(plan.some((c) => c.model.id === 'google/gemini-4-carbon')).toBe(true);
    const single = planRoute({ model: 'deepseek/v4.1-flash', catalog: seedModels, endpoints: seedEndpoints, options: { fallbacks: false } });
    expect(single).toHaveLength(1);
  });

  it('rejects unknown models', () => {
    expect(() => planRoute({ model: 'nope/model', catalog: seedModels, endpoints: seedEndpoints })).toThrow(RouteError);
  });

  it('reserves an upper bound that covers the real cost', () => {
    const price = { inputPerMillionMicros: usdToMicros(3), outputPerMillionMicros: usdToMicros(15) };
    const reserve = estimateMaxCostMicros(price, 1000, 1024);
    expect(reserve).toBeGreaterThanOrEqual(costMicros({ promptTokens: 1000, completionTokens: 1024 }, price));
  });

  it('bills cached input tokens at cachedInputPerMillionMicros when present', () => {
    const price = {
      inputPerMillionMicros: usdToMicros(0.5),
      outputPerMillionMicros: usdToMicros(0.5),
      cachedInputPerMillionMicros: usdToMicros(0.05),
    };
    const total = costMicros({ promptTokens: 1_000_000, cachedPromptTokens: 800_000, completionTokens: 200_000 }, price);
    // 0.2M * $0.50 ($0.10) + 0.8M * $0.05 ($0.04) + 0.2M * $0.50 ($0.10) = $0.24
    expect(total).toBe(usdToMicros(0.24));
  });

  it('registers all 41 SevenAPI models, disables down models, and resolves upstream aliases', async () => {
    const { resolveModelId } = await import('../src');
    const { SEVENAPI_CATALOG, sevenApiEndpoints } = await import('../src/seed');
    expect(SEVENAPI_CATALOG).toHaveLength(41);
    expect(sevenApiEndpoints).toHaveLength(41);
    const disabled = sevenApiEndpoints.filter((e) => !e.enabled).map((e) => e.upstreamModel).sort();
    expect(disabled).toEqual(['claude-fable-5-2', 'glm-5.3-flash', 'glm-5.3-flash-uncensored', 'gpt-5.6-terra']);
    expect(resolveModelId('claude-opus-5-5-max', seedModels, seedEndpoints)).toBe('anthropic/claude-opus-5.5-max');
    expect(resolveModelId('deepseek-v4-pro-0813', seedModels, seedEndpoints)).toBe('deepseek/v4-pro');
    expect(resolveModelId('kimi-k3', seedModels, seedEndpoints)).toBe('moonshotai/kimi-k3');
  });

  it('registers You.com paid & free models and routes them to provider "you"', async () => {
    const { YOUCOM_CATALOG, youComEndpoints } = await import('../src/seed');
    expect(YOUCOM_CATALOG.map((m) => m.id)).toEqual(['you/express', 'you/express:free', 'you/advanced', 'you/research']);
    expect(youComEndpoints).toHaveLength(4);
    const plan = planRoute({ model: 'you/express', catalog: seedModels, endpoints: seedEndpoints });
    expect(plan[0]?.endpoint.provider).toBe('you');
    expect(plan[0]?.endpoint.upstreamModel).toBe('express');
    const freePlan = planRoute({ model: 'you/express:free', catalog: seedModels, endpoints: seedEndpoints });
    expect(freePlan[0]?.model.inputPerMillionMicros).toBe(0);
    expect(freePlan[0]?.endpoint.upstreamModel).toBe('express');
  });

  it('scopes Google free-tier catalog to Gemini 4 Hydrogen (paid + :free) without duplicate model IDs', async () => {
    const { GOOGLE_FREE_TIER_MODELS } = await import('../src/seed');
    const ids = seedModels.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(GOOGLE_FREE_TIER_MODELS).toEqual(['google/gemini-4-hydrogen', 'google/gemini-4-hydrogen:free']);

    const paidPlan = planRoute({ model: 'google/gemini-4-hydrogen', catalog: seedModels, endpoints: seedEndpoints });
    expect(paidPlan[0]?.endpoint.provider).toBe('google');
    expect(paidPlan[0]?.endpoint.upstreamModel).toBe('gemini-4-hydrogen');
    expect(paidPlan[0]?.model.inputPerMillionMicros).toBe(usdToMicros(1.5));

    const freePlan = planRoute({ model: 'google/gemini-4-hydrogen:free', catalog: seedModels, endpoints: seedEndpoints });
    expect(freePlan[0]?.endpoint.provider).toBe('google');
    expect(freePlan[0]?.model.inputPerMillionMicros).toBe(0);
  });
});

describe('ranking', () => {
  it('ranks a model that wins more often higher', () => {
    const battles: Battle[] = [];
    for (let i = 0; i < 70; i++) battles.push({ a: 'strong', b: 'weak', outcome: 'a' });
    for (let i = 0; i < 30; i++) battles.push({ a: 'strong', b: 'weak', outcome: 'b' });
    // mid beats weak 55% of the time (25 wins, 10 ties, 15 losses).
    for (let i = 0; i < 50; i++) battles.push({ a: 'mid', b: 'weak', outcome: i < 25 ? 'a' : i < 35 ? 'tie' : 'b' });
    const r = bradleyTerry(battles);
    expect(r.map((x) => x.model)).toEqual(['strong', 'mid', 'weak']);
    expect(r[0]!.winRate).toBeCloseTo(70, 5);
    // 70:30 odds ≈ 147 Elo points; the prior shrinks it a little.
    const gap = r[0]!.rating - r[2]!.rating;
    expect(gap).toBeGreaterThan(100);
    expect(gap).toBeLessThan(160);
  });

  it('keeps unbeaten models finite and returns confidence intervals', () => {
    const battles: Battle[] = Array.from({ length: 20 }, () => ({ a: 'x', b: 'y', outcome: 'a' as const }));
    const r = bradleyTerryWithIntervals(battles, { rounds: 30 });
    expect(Number.isFinite(r[0]!.rating)).toBe(true);
    expect(r[0]!.ci).toBeGreaterThanOrEqual(0);
    expect(bradleyTerry([])).toEqual([]);
  });

  it('finds the Pareto frontier', () => {
    const pts = seedLeaderboard('overall').map((e) => ({ id: e.modelId, cost: e.costPerTaskMicros, score: e.rating }));
    const front = paretoFrontier(pts).map((p) => p.id);
    expect(front[0]).toBe('deepseek/v4.1-flash');
    expect(front.at(-1)).toBe('anthropic/claude-fable-5.2');
    expect(front).not.toContain('openai/gpt-6-astra');
  });
});

describe('openai schema', () => {
  it('accepts a standard request with Vigas extensions and rejects bad ones', () => {
    const ok = chatCompletionRequestSchema.safeParse({
      model: 'vigas/auto',
      messages: [{ role: 'user', content: 'Hello' }],
      route: { sort: 'price' },
      some_future_param: true,
    });
    expect(ok.success).toBe(true);
    expect(chatCompletionRequestSchema.safeParse({ model: 'x', messages: [] }).success).toBe(false);
  });
});

describe('server helpers', () => {
  it('generates API keys that are only stored as hashes', () => {
    const k = generateApiKey();
    expect(looksLikeApiKey(k.key)).toBe(true);
    expect(k.hash).toHaveLength(64);
    expect(k.display).toMatch(/^sk-vg-v1-.{4}••••.{4}$/);
    expect(generateApiKey().key).not.toBe(k.key);
  });

  it('hashes and verifies passwords', async () => {
    const h = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', h)).toBe(true);
    expect(await verifyPassword('wrong', h)).toBe(false);
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
  });
});

describe('seed data', () => {
  it('is internally consistent', () => {
    const ids = new Set(seedModels.map((m) => m.id));
    expect(seedEndpoints.every((e) => ids.has(e.modelId))).toBe(true);
    for (const e of seedLeaderboard('coding')) expect(ids.has(e.modelId)).toBe(true);
    const articles = seedArticles(new Date('2026-11-05T09:00:00Z'));
    expect(new Set(articles.map((a) => a.slug)).size).toBe(articles.length);
    expect(articles[0]!.slug).toBe(slugify(articles[0]!.title));
    for (const a of articles) for (const m of a.mentionedModelIds) expect(ids.has(m)).toBe(true);
    expect(new Set(seedTools.map((t) => t.slug)).size).toBe(seedTools.length);
    expect(formatCompact(373_440_550)).toBe('373M');
    expect(formatCompact(4821)).toBe('4.8k');
  });
});

describe('avexpay', () => {
  it('verifies t=<unix>,v1=<hex> HMAC-SHA256 signatures and rejects stale or tampered payloads', async () => {
    const secret = 'whsec_test_secret_123';
    const ts = 1_760_000_000;
    const body = JSON.stringify({
      id: 'evt_1',
      event: 'invoice.paid',
      mode: 'live',
      invoiceId: 'inv_999',
      reference: 'top_abc123',
      amountFiatMicros: '25000000',
    });
    const sig = await signAvexPayPayload(ts, body, secret);
    const header = `t=${ts},v1=${sig}`;

    expect(parseAvexSignatureHeader(header)).toEqual({ timestamp: ts, signatures: [sig] });
    expect(
      await verifyAvexPaySignature({
        rawBody: body,
        signatureHeader: header,
        webhookSecret: secret,
        nowSeconds: ts + 45,
      }),
    ).toEqual({ ok: true, timestamp: ts });

    // Tampered body must fail.
    expect(
      await verifyAvexPaySignature({
        rawBody: body.replace('25000000', '999000000'),
        signatureHeader: header,
        webhookSecret: secret,
        nowSeconds: ts + 45,
      }),
    ).toMatchObject({ ok: false, reason: 'signature_mismatch' });

    // Timestamp outside 300s tolerance must fail.
    expect(
      await verifyAvexPaySignature({
        rawBody: body,
        signatureHeader: header,
        webhookSecret: secret,
        nowSeconds: ts + 305,
      }),
    ).toMatchObject({ ok: false, reason: 'timestamp_out_of_range' });

    // Missing secret must fail closed.
    expect(
      await verifyAvexPaySignature({
        rawBody: body,
        signatureHeader: header,
        webhookSecret: '',
        nowSeconds: ts,
      }),
    ).toMatchObject({ ok: false, reason: 'missing_webhook_secret' });
  });

  it('normalizes webhook events and infers mode from key prefixes', () => {
    const body = JSON.stringify({
      id: 'evt_2',
      event: 'invoice.paid',
      mode: 'test',
      invoiceId: 'inv_123',
      reference: 'top_xyz',
      amountFiatMicros: '10000000',
    });
    const parsed = parseAvexPayWebhookPayload(body);
    expect(parsed).toMatchObject({
      eventId: 'evt_2',
      event: 'invoice.paid',
      mode: 'test',
      invoiceId: 'inv_123',
      reference: 'top_xyz',
      requestedMicros: 10_000_000,
      settledMicros: 10_000_000,
      status: 'paid',
    });
    expect(inferAvexPayMode('ak_test_abc')).toBe('test');
    expect(inferAvexPayMode('ak_live_abc')).toBe('live');
  });

  it('handles AvexPay envelope payloads and reversed/expired/underpaid/confirming events', () => {
    const expired = parseAvexPayWebhookPayload(
      JSON.stringify({
        event: 'invoice.expired',
        data: { id: 'inv_exp', reference: 'top_1', amountFiatMicros: 5_000_000 },
      }),
    );
    expect(expired).toMatchObject({ status: 'expired', invoiceId: 'inv_exp', reference: 'top_1', settledMicros: 0 });

    const reversed = parseAvexPayWebhookPayload(
      JSON.stringify({
        event: 'payment.reversed',
        data: { invoiceId: 'inv_rev', reference: 'top_2', amountFiatMicros: 25_000_000 },
      }),
    );
    expect(reversed).toMatchObject({ status: 'reversed', invoiceId: 'inv_rev', reference: 'top_2' });

    const underpaid = parseAvexPayWebhookPayload(
      JSON.stringify({
        event: 'invoice.underpaid',
        data: { invoiceId: 'inv_low', reference: 'top_3', amountFiatMicros: 10_000_000, paidFiatMicros: 5_000_000 },
      }),
    );
    expect(underpaid).toMatchObject({ status: 'failed', settledMicros: 5_000_000 });

    const confirming = parseAvexPayWebhookPayload(
      JSON.stringify({
        event: 'invoice.confirming',
        data: { invoiceId: 'inv_wait', reference: 'top_4', amountFiatMicros: 10_000_000 },
      }),
    );
    expect(confirming.status).toBe('pending');
  });
});

