import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import { usdToMicros } from '@vigas/core';
import { hashPassword } from '@vigas/core/server';
import {
  completeTopup,
  createApiKey,
  createDb,
  createUser,
  getAccount,
  migrateDatabase,
  seedDatabase,
  type DbHandle,
} from '@vigas/db';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { createAdapterResolver } from '../src/providers';

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL ?? 'postgres://vigas:vigas@localhost:5433/postgres';
const DB_NAME = 'vigas_gateway_test';
const DB_URL = ADMIN_URL.replace(/\/[^/]*$/, `/${DB_NAME}`);
const INTERNAL = 'internal-test-token-0123456789';

let h: DbHandle;
let app: ReturnType<typeof createApp>['app'];
let key: string;
let accountId: string;
let poorKey: string;

const env = (extra: Record<string, string> = {}) =>
  loadConfig({ NODE_ENV: 'test', MOCK_PROVIDERS: 'true', INTERNAL_SERVICE_TOKEN: INTERNAL, RATE_LIMIT_RPM: '1000', DATABASE_URL: DB_URL, ...extra });

beforeAll(async () => {
  const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
  const exists = await admin`select 1 from pg_database where datname = ${DB_NAME}`;
  if (exists.length === 0) await admin.unsafe(`create database ${DB_NAME}`);
  await admin.end();

  h = createDb(DB_URL, { max: 5 });
  await h.db.execute(sql`drop schema if exists public cascade`);
  await h.db.execute(sql`drop schema if exists drizzle cascade`);
  await h.db.execute(sql`create schema public`);
  await migrateDatabase(h.db);
  await seedDatabase(h.db);

  const user = await createUser(h.db, { email: 'gw@example.com', passwordHash: await hashPassword('password-1') });
  accountId = user.accountId;
  await completeTopup(h.db, { accountId, amountMicros: usdToMicros(5), feeBps: 0, provider: 'test' });
  key = (await createApiKey(h.db, accountId, 'test')).key;
  const poor = await createUser(h.db, { email: 'poor@example.com', passwordHash: await hashPassword('password-1') });
  poorKey = (await createApiKey(h.db, poor.accountId, 'poor')).key;

  const config = env();
  app = createApp({ db: h.db, config, adapters: createAdapterResolver(config, { failing: new Set(['deepseek']) }) }).app;
}, 60_000);

afterAll(async () => {
  await h?.close();
});

const post = (body: unknown, auth: string | null = key, headers: Record<string, string> = {}) =>
  app.request('/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const usageRows = (acc: string) =>
  h.db.execute<{ source: string; provider: string; model_id: string; cost_micros: number; status: string }>(
    sql`select source, provider, model_id, cost_micros, status from usage_events where account_id = ${acc} order by id`,
  );

describe('public endpoints', () => {
  it('lists models in OpenAI format with per-token prices', async () => {
    const res = await app.request('/v1/models');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { object: string; data: Array<{ id: string; pricing: { prompt: string } }> };
    expect(body.object).toBe('list');
    expect(body.data[0]!.id).toBe('vigas/auto');
    expect(body.data.find((m) => m.id === 'anthropic/claude-sonnet-5.5')!.pricing.prompt).toBe('0.000003');
  });

  it('answers health checks and 404s in OpenAI error format', async () => {
    expect((await app.request('/health')).status).toBe(200);
    const res = await app.request('/v1/nope');
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { type: string } }).error.type).toBe('not_found_error');
  });
});

describe('chat completions', () => {
  const messages = [{ role: 'user', content: 'Summarize this contract' }];

  it('rejects missing, malformed and unknown keys', async () => {
    expect((await post({ model: 'x', messages }, null)).status).toBe(401);
    expect((await post({ model: 'x', messages }, 'sk-wrong')).status).toBe(401);
    expect((await post({ model: 'x', messages }, `sk-vg-v1-${'a'.repeat(40)}`)).status).toBe(401);
  });

  it('validates the request and the model', async () => {
    expect((await post('{bad json')).status).toBe(400);
    expect((await post({ model: 'anthropic/claude-sonnet-5.5', messages: [] })).status).toBe(400);
    const res = await post({ model: 'nope/model', messages });
    expect(res.status).toBe(404);
  });

  it('completes a request, charges the real cost and records usage', async () => {
    const before = (await getAccount(h.db, accountId))!.balanceMicros;
    const res = await post({ model: 'anthropic/claude-sonnet-5.5', messages, temperature: 0.2 });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-vigas-provider')).toBe('anthropic');
    const body = (await res.json()) as {
      object: string;
      model: string;
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number; cost: number };
    };
    expect(body.object).toBe('chat.completion');
    expect(body.model).toBe('anthropic/claude-sonnet-5.5');
    expect(body.choices[0]!.message.content).toContain('Summarize this contract');
    const expected = Math.ceil((body.usage.prompt_tokens * 3_000_000 + body.usage.completion_tokens * 15_000_000) / 1e6);
    expect(Math.round(body.usage.cost * 1e6)).toBe(expected);
    const after = (await getAccount(h.db, accountId))!.balanceMicros;
    expect(before - after).toBe(expected);
    const rows = await usageRows(accountId);
    expect(rows.at(-1)).toMatchObject({ source: 'api', provider: 'anthropic', status: 'ok' });
  });

  it('streams server-sent events with usage and [DONE]', async () => {
    const res = await post({ model: 'openai/gpt-6.1-terra', messages, stream: true, stream_options: { include_usage: true } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const text = await res.text();
    const events = text.split('\n\n').filter(Boolean).map((e) => e.replace(/^data: /, ''));
    expect(events.at(-1)).toBe('[DONE]');
    const chunks = events.slice(0, -1).map((e) => JSON.parse(e) as { choices: Array<{ delta: { content?: string }; finish_reason: string | null }>; usage?: { cost: number } });
    const content = chunks.map((c) => c.choices[0]?.delta.content ?? '').join('');
    expect(content).toContain('[mock openai · gpt-6.1-terra]');
    expect(chunks.some((c) => c.choices[0]?.finish_reason === 'stop')).toBe(true);
    expect(chunks.at(-1)!.usage!.cost).toBeGreaterThan(0);
    // settlement happens before [DONE]
    expect((await usageRows(accountId)).at(-1)).toMatchObject({ provider: 'openai', status: 'ok' });
  });

  it('falls back to the next provider when one is down', async () => {
    const res = await post({ model: 'deepseek/v4.1-flash', messages });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-vigas-provider')).toBe('together');
    const stream = await post({ model: 'deepseek/v4.1-flash', messages, stream: true });
    expect(stream.headers.get('x-vigas-provider')).toBe('together');
    await stream.text();
  });

  it('routes vigas/auto and reports the chosen model', async () => {
    const res = await post({ model: 'vigas/auto', messages, route: { sort: 'price' } });
    expect(res.status).toBe(200);
    // DeepSeek Flash is cheapest but its first host is down; the fallback host serves it.
    expect(res.headers.get('x-vigas-model')).toBe('deepseek/v4.1-flash');
  });

  it('refuses paid models without credits but serves free ones', async () => {
    const paid = await post({ model: 'anthropic/claude-opus-5.5', messages }, poorKey);
    expect(paid.status).toBe(402);
    expect(((await paid.json()) as { error: { code: string } }).error.code).toBe('insufficient_credits');
    const free = await post({ model: 'nvidia/nemotron-3.5-super', messages }, poorKey);
    expect(free.status).toBe(200);
  });

  it('accepts internal calls from Vigas apps on behalf of an account', async () => {
    const res = await post({ model: 'google/gemini-4-argon', messages }, INTERNAL, { 'X-Vigas-Account': accountId, 'X-Vigas-Source': 'chat' });
    expect(res.status).toBe(200);
    expect((await usageRows(accountId)).at(-1)).toMatchObject({ source: 'chat', provider: 'google' });
    const bad = await post({ model: 'google/gemini-4-argon', messages }, INTERNAL, { 'X-Vigas-Account': 'acc_nope', 'X-Vigas-Source': 'chat' });
    expect(bad.status).toBe(401);
  });

  it('rate limits per key', async () => {
    const limited = createApp({ db: h.db, config: env({ RATE_LIMIT_RPM: '2' }) }).app;
    const call = () =>
      limited.request('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: 'nvidia/nemotron-3.5-super', messages }),
      });
    expect((await call()).status).toBe(200);
    expect((await call()).status).toBe(200);
    const third = await call();
    expect(third.status).toBe(429);
    expect(third.headers.get('retry-after')).toBeTruthy();
  });

  it('enforces a key’s monthly limit and reports it on /v1/key', async () => {
    const capped = (await createApiKey(h.db, accountId, 'capped', { monthlyLimitMicros: 1_000 })).key; // $0.001
    const info = await app.request('/v1/key', { headers: { Authorization: `Bearer ${capped}` } });
    expect(await info.json()).toEqual({ data: { label: 'capped', usage: 0, limit: 0.001, limit_remaining: 0.001, limit_reset: 'monthly' } });
    // Opus with the default 4,096 max tokens could cost far more than $0.001.
    const res = await post({ model: 'anthropic/claude-opus-5.5', messages }, capped);
    expect(res.status).toBe(402);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('key_limit_reached');
    // Free models are never blocked by the cap.
    expect((await post({ model: 'nvidia/nemotron-3.5-super', messages }, capped)).status).toBe(200);
    const internal = await app.request('/v1/key', { headers: { Authorization: `Bearer ${INTERNAL}`, 'X-Vigas-Account': accountId } });
    expect(internal.status).toBe(400);
  });

  it('reports credits for a key', async () => {
    const res = await app.request('/v1/credits', { headers: { Authorization: `Bearer ${key}` } });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { balance_usd: number }).balance_usd).toBeLessThan(5);
  });
});
