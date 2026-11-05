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
  paretoFrontier,
  planRoute,
  quoteTopup,
  RouteError,
  slugify,
  usdToMicros,
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
    expect(plan.map((c) => c.endpoint.provider)).toEqual(['deepseek', 'together']);
  });

  it('moves unhealthy endpoints to the back instead of dropping them', () => {
    const plan = planRoute({
      model: 'deepseek/v4.1-flash',
      catalog: seedModels,
      endpoints: seedEndpoints,
      stats: { 'deepseek:deepseek/v4.1-flash': { healthy: false } },
    });
    expect(plan.map((c) => c.endpoint.provider)).toEqual(['together', 'deepseek']);
  });

  it('routes vigas/auto by quality, price or latency across auto-eligible models', () => {
    const ratings = Object.fromEntries(seedLeaderboard('overall').map((e) => [e.modelId, e.rating]));
    const byQuality = planRoute({ model: AUTO_MODEL_ID, catalog: seedModels, endpoints: seedEndpoints, ratings });
    expect(byQuality[0]!.model.id).toBe('anthropic/claude-opus-5.5');
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
    expect(plan.map((c) => c.model.id)).toEqual(['openai/gpt-6-astra', 'google/gemini-4-carbon']);
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
    expect(front.at(-1)).toBe('anthropic/claude-opus-5.5');
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
