import { serve } from '@hono/node-server';
import { createDb, releaseStaleHolds } from '@vigas/db';
import { createApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const { db, close } = createDb(config.databaseUrl, { max: 20 });
const { app } = createApp({ db, config });

const configured = Object.values(config.providers).filter((p) => p.apiKey).map((p) => p.slug);
console.log(`[gateway] providers with keys: ${configured.join(', ') || 'none'}${config.mockProviders ? ' (others use the mock provider)' : ''}`);
if (!config.internalServiceToken) console.warn('[gateway] INTERNAL_SERVICE_TOKEN is not set (or shorter than 16 chars): website chat and Arena are disabled');

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[gateway] listening on http://localhost:${info.port}`);
});

// Refund credit holds left behind by crashed or abandoned requests.
const sweeper = setInterval(() => {
  releaseStaleHolds(db).catch((err) => console.error('[gateway] stale hold sweep failed', err));
}, 5 * 60_000);

const shutdown = () => {
  clearInterval(sweeper);
  server.close(() => {
    void close().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 10_000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
