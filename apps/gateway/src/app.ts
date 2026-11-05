import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AUTO_MODEL_ID } from '@vigas/core';
import { getAccount, type Db } from '@vigas/db';
import { authenticate } from './auth';
import { handleChatCompletion, type GatewayDeps } from './chat';
import type { GatewayConfig } from './config';
import { errorResponse } from './errors';
import { createAdapterResolver, type AdapterResolver } from './providers';
import { CatalogCache, EndpointHealth, RateLimiter } from './state';

export interface CreateAppOptions {
  db: Db;
  config: GatewayConfig;
  adapters?: AdapterResolver;
  catalogTtlMs?: number;
}

/** USD per token as a plain decimal string (OpenRouter-style pricing fields). */
const perToken = (microsPerMillion: number) => {
  if (microsPerMillion === 0) return '0';
  return (microsPerMillion / 1e12).toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
};

export function createApp(opts: CreateAppOptions) {
  const deps: GatewayDeps = {
    db: opts.db,
    config: opts.config,
    adapters: opts.adapters ?? createAdapterResolver(opts.config),
    catalog: new CatalogCache(opts.db, opts.catalogTtlMs ?? 60_000),
    health: new EndpointHealth(),
    limiter: new RateLimiter(opts.config.rateLimitRpm),
  };

  const app = new Hono();
  app.use(
    '/v1/*',
    cors({
      origin: '*',
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      exposeHeaders: ['X-Vigas-Provider', 'X-Vigas-Model'],
    }),
  );

  app.get('/', (c) => c.json({ name: 'Vigas API', docs: 'https://vigas.ai/models', openai_compatible_base_url: '/v1' }));
  app.get('/health', (c) => c.json({ ok: true }));

  app.get('/v1/models', async () => {
    const snap = await deps.catalog.get();
    const data = snap.models.map((m) => ({
      id: m.id,
      object: 'model',
      created: 1_762_300_000,
      owned_by: m.org.toLowerCase(),
      name: m.name,
      context_length: m.contextLength,
      tags: m.tags,
      pricing: { prompt: perToken(m.inputPerMillionMicros), completion: perToken(m.outputPerMillionMicros) },
    }));
    data.unshift({
      id: AUTO_MODEL_ID,
      object: 'model',
      created: 1_762_300_000,
      owned_by: 'vigas',
      name: 'Vigas Auto Router',
      context_length: Math.max(...snap.models.filter((m) => m.auto).map((m) => m.contextLength), 0),
      tags: [],
      pricing: { prompt: 'variable', completion: 'variable' },
    });
    return Response.json({ object: 'list', data });
  });

  app.get('/v1/credits', async (c) => {
    const auth = await authenticate(deps.db, deps.config, c.req.raw.headers);
    if (!auth.ok) return errorResponse(auth.status, auth.message, 'authentication_error', 'invalid_api_key');
    const account = await getAccount(deps.db, auth.caller.accountId);
    return c.json({
      balance_usd: (account?.balanceMicros ?? 0) / 1e6,
      lifetime_topup_usd: (account?.lifetimeTopupMicros ?? 0) / 1e6,
    });
  });

  app.post('/v1/chat/completions', (c) => handleChatCompletion(deps, c.req.raw));

  app.notFound(() => errorResponse(404, 'Not found', 'not_found_error', 'not_found'));
  app.onError((err) => {
    console.error('[gateway] unhandled error', err);
    return errorResponse(500, 'Internal error', 'api_error', 'internal_error');
  });

  return { app, deps };
}
