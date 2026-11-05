import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AUTO_MODEL_ID } from '@vigas/core';
import { exchangeAuthCode, getAccount, keySpendThisMonth, OAuthError, type Db } from '@vigas/db';
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

  // OpenRouter-style key info: label, this month's usage and the remaining limit (USD).
  app.get('/v1/key', async (c) => {
    const auth = await authenticate(deps.db, deps.config, c.req.raw.headers);
    if (!auth.ok) return errorResponse(auth.status, auth.message, 'authentication_error', 'invalid_api_key');
    const { apiKeyId, keyName, monthlyLimitMicros } = auth.caller;
    if (!apiKeyId) return errorResponse(400, 'This endpoint needs an API key', 'invalid_request_error', 'api_key_required');
    const spent = await keySpendThisMonth(deps.db, apiKeyId);
    return c.json({
      data: {
        label: keyName,
        usage: spent / 1e6,
        limit: monthlyLimitMicros === null ? null : monthlyLimitMicros / 1e6,
        limit_remaining: monthlyLimitMicros === null ? null : Math.max(0, monthlyLimitMicros - spent) / 1e6,
        limit_reset: 'monthly',
      },
    });
  });

  // "Sign in with Vigas" (PKCE): an app exchanges the one-time code from its callback, plus its
  // code_verifier, for an API key on the user's account. Same shape as OpenRouter's /auth/keys.
  app.post('/v1/auth/keys', async (c) => {
    let body: { code?: unknown; code_verifier?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return errorResponse(400, 'Request body must be valid JSON', 'invalid_request_error', 'invalid_json');
    }
    if (typeof body.code !== 'string' || typeof body.code_verifier !== 'string') {
      return errorResponse(400, '"code" and "code_verifier" are required', 'invalid_request_error', 'invalid_request');
    }
    const wait = deps.limiter.take(`oauth:${c.req.header('x-forwarded-for') ?? 'local'}`);
    if (wait > 0) return errorResponse(429, `Too many attempts. Retry in ${wait}s.`, 'rate_limit_error', 'rate_limited');
    try {
      const key = await exchangeAuthCode(deps.db, { code: body.code, codeVerifier: body.code_verifier });
      return c.json({ key: key.key, user_id: key.userId, name: key.name, limit: key.monthlyLimitMicros ? key.monthlyLimitMicros / 1e6 : null });
    } catch (err) {
      if (err instanceof OAuthError) return errorResponse(403, err.message, 'authentication_error', err.code);
      throw err;
    }
  });

  app.post('/v1/chat/completions', (c) => handleChatCompletion(deps, c.req.raw));

  app.notFound(() => errorResponse(404, 'Not found', 'not_found_error', 'not_found'));
  app.onError((err) => {
    console.error('[gateway] unhandled error', err);
    return errorResponse(500, 'Internal error', 'api_error', 'internal_error');
  });

  return { app, deps };
}
