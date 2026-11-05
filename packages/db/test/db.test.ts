import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { usdToMicros } from '@vigas/core';
import { hashPassword } from '@vigas/core/server';
import {
  authenticateApiKey,
  completeTopup,
  countArticles,
  createApiKey,
  createBattle,
  createDb,
  createSession,
  createUser,
  deleteSession,
  getAccount,
  getArticle,
  getLeaderboard,
  getSessionUser,
  getWallet,
  keySpendThisMonth,
  listApiKeys,
  listArticles,
  setApiKeyLimit,
  listBattleOutcomes,
  listEndpoints,
  listModels,
  listTools,
  migrateDatabase,
  releaseStaleHolds,
  reserveCredits,
  revokeApiKey,
  seedDatabase,
  settleUsage,
  toggleToolVote,
  voteBattle,
  type DbHandle,
} from '../src';

const url = process.env.TEST_DATABASE_URL ?? 'postgres://vigas:vigas@localhost:5433/vigas_test';
let h: DbHandle;

beforeAll(async () => {
  h = createDb(url, { max: 5 });
  await h.db.execute(sql`drop schema if exists public cascade`);
  await h.db.execute(sql`drop schema if exists drizzle cascade`);
  await h.db.execute(sql`create schema public`);
  await migrateDatabase(h.db);
  await seedDatabase(h.db, { demoUser: { email: 'demo@vigas.ai', password: 'demo-password-1' } });
  // Seeding twice must be safe.
  await seedDatabase(h.db, { demoUser: { email: 'demo@vigas.ai', password: 'demo-password-1' } });
}, 60_000);

afterAll(async () => {
  await h?.close();
});

async function newUser(email: string) {
  return createUser(h.db, { email, passwordHash: await hashPassword('pw-123456') });
}

describe('catalogue and content', () => {
  it('serves seeded models, endpoints, news, tools and leaderboards', async () => {
    expect((await listModels(h.db)).length).toBe(13);
    expect((await listEndpoints(h.db)).filter((e) => e.modelId === 'deepseek/v4.1-flash')).toHaveLength(2);
    const news = await listArticles(h.db, { limit: 5 });
    expect(news).toHaveLength(5);
    expect(news[0]!.publishedAt >= news[1]!.publishedAt).toBe(true);
    expect(await countArticles(h.db, 'Analysis')).toBe(2);
    const article = await getArticle(h.db, news[0]!.slug);
    expect(article?.body.length).toBeGreaterThan(20);
    expect(await getArticle(h.db, 'does-not-exist')).toBeNull();
    const coding = await listTools(h.db, { category: 'Coding' });
    expect(coding.map((t) => t.slug)).toEqual(['cursor', 'v0']);
    expect((await listTools(h.db, { q: 'video' })).map((t) => t.slug)).toContain('runway');
    const lb = await getLeaderboard(h.db, 'overall');
    expect(lb.entries[0]!.modelId).toBe('anthropic/claude-opus-5.5');
    expect(lb.totalSessions).toBeGreaterThan(0);
  });
});

describe('auth', () => {
  it('creates users with accounts and sessions that can be revoked', async () => {
    const u = await newUser('Someone@Example.com');
    expect(u.email).toBe('someone@example.com');
    await expect(newUser('someone@example.com')).rejects.toThrow();
    const token = await createSession(h.db, u.id, 'vitest');
    const s = await getSessionUser(h.db, token);
    expect(s).toMatchObject({ id: u.id, accountId: u.accountId, role: 'user' });
    expect(await getSessionUser(h.db, 'bogus')).toBeNull();
    await deleteSession(h.db, token);
    expect(await getSessionUser(h.db, token)).toBeNull();
  });
});

describe('billing', () => {
  it('reserves, settles and refuses to overspend', async () => {
    const u = await newUser('billing@example.com');
    await completeTopup(h.db, { accountId: u.accountId, amountMicros: usdToMicros(1), feeBps: 500, provider: 'test' });
    const key = await createApiKey(h.db, u.accountId, 'test');
    const auth = await authenticateApiKey(h.db, key.key);
    expect(auth).toMatchObject({ accountId: u.accountId, apiKeyId: key.id, balanceMicros: 1_000_000 });

    const hold = await reserveCredits(h.db, u.accountId, 600_000);
    expect(hold).not.toBeNull();
    expect(await reserveCredits(h.db, u.accountId, 600_000)).toBeNull(); // only 400k left
    await settleUsage(h.db, {
      holdId: hold!,
      accountId: u.accountId,
      apiKeyId: key.id,
      source: 'api',
      modelId: 'deepseek/v4.1-flash',
      provider: 'deepseek',
      promptTokens: 1000,
      completionTokens: 200,
      costMicros: 126,
      latencyMs: 300,
      status: 'ok',
    });
    expect((await getAccount(h.db, u.accountId))!.balanceMicros).toBe(1_000_000 - 126);

    const wallet = await getWallet(h.db, u.accountId, 500);
    expect(wallet!.week).toHaveLength(7);
    expect(wallet!.week.at(-1)!.costMicros).toBe(126);
    expect(wallet!.bySource).toEqual([{ source: 'api', costMicros: 126 }]);
    expect(wallet!.keys[0]!.spentThisMonthMicros).toBe(126);

    expect(await keySpendThisMonth(h.db, key.id)).toBe(126);
    expect(await setApiKeyLimit(h.db, u.accountId, key.id, 5_000_000)).toBe(true);
    expect((await authenticateApiKey(h.db, key.key))?.monthlyLimitMicros).toBe(5_000_000);
    expect((await listApiKeys(h.db, u.accountId))[0]!.monthlyLimitMicros).toBe(5_000_000);
    expect(await setApiKeyLimit(h.db, 'acc_other', key.id, 1)).toBe(false);

    expect(await revokeApiKey(h.db, u.accountId, key.id)).toBe(true);
    expect(await authenticateApiKey(h.db, key.key)).toBeNull();
  });

  it('never overspends under concurrent reservations', async () => {
    const u = await newUser('race@example.com');
    await completeTopup(h.db, { accountId: u.accountId, amountMicros: 1_000_000, feeBps: 0, provider: 'test' });
    const results = await Promise.all(Array.from({ length: 10 }, () => reserveCredits(h.db, u.accountId, 300_000)));
    expect(results.filter(Boolean)).toHaveLength(3);
    expect((await getAccount(h.db, u.accountId))!.balanceMicros).toBe(100_000);
  });

  it('refunds stale holds and charges top-up fees after the free allowance', async () => {
    const u = await newUser('stale@example.com');
    const first = await completeTopup(h.db, { accountId: u.accountId, amountMicros: usdToMicros(10), feeBps: 500, provider: 'test' });
    expect(first.feeMicros).toBe(250_000); // $5 free, 5% of the other $5
    await reserveCredits(h.db, u.accountId, 2_000_000);
    expect(await releaseStaleHolds(h.db, -1)).toBeGreaterThanOrEqual(1);
    expect((await getAccount(h.db, u.accountId))!.balanceMicros).toBe(usdToMicros(10));
  });
});

describe('tools and arena', () => {
  it('toggles tool votes per user', async () => {
    const u = await newUser('voter@example.com');
    const before = (await listTools(h.db, { userId: u.id })).find((t) => t.slug === 'suno')!;
    const on = await toggleToolVote(h.db, 'suno', u.id);
    expect(on).toEqual({ voted: true, votes: before.votes + 1 });
    expect((await listTools(h.db, { userId: u.id })).find((t) => t.slug === 'suno')!.voted).toBe(true);
    expect(await toggleToolVote(h.db, 'suno', u.id)).toEqual({ voted: false, votes: before.votes });
    expect(await toggleToolVote(h.db, 'nope', u.id)).toBeNull();
  });

  it('records battles and only lets their owner vote', async () => {
    const u = await newUser('arena@example.com');
    const other = await newUser('arena2@example.com');
    const id = await createBattle(h.db, {
      userId: u.id,
      prompt: 'Hi',
      modelA: 'anthropic/claude-sonnet-5.5',
      modelB: 'openai/gpt-6.1-terra',
      responseA: 'A',
      responseB: 'B',
    });
    expect(await voteBattle(h.db, id, other.id, 'a')).toBeNull();
    expect((await voteBattle(h.db, id, u.id, 'a'))?.vote).toBe('a');
    expect(await listBattleOutcomes(h.db, 'overall')).toContainEqual({
      a: 'anthropic/claude-sonnet-5.5',
      b: 'openai/gpt-6.1-terra',
      outcome: 'a',
    });
  });
});
