import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

export interface DbHandle {
  db: Db;
  close: () => Promise<void>;
}

export type DbProbeResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

function connectionOptions(url: string, maxOverride?: number) {
  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    // Allow non-URL libpq strings.
  }
  const host = parsed?.hostname ?? '';
  const port = parsed?.port ?? '';
  const sslMode = parsed?.searchParams.get('sslmode');
  const isSupabase = host.endsWith('.supabase.co') || host.endsWith('.pooler.supabase.com');
  const isTxPooler = port === '6543' || parsed?.searchParams.get('pgbouncer') === 'true';

  return {
    max: maxOverride ?? (process.env.VERCEL ? 3 : 10),
    idle_timeout: 20,
    connect_timeout: 10,
    ...(isTxPooler ? { prepare: false } : {}),
    ...(isSupabase && sslMode !== 'disable' ? { ssl: 'require' as const } : {}),
    onnotice: () => {},
  };
}

export function createDb(url: string = process.env.DATABASE_URL ?? '', opts: { max?: number } = {}): DbHandle {
  if (!url) throw new Error('DATABASE_URL is not set');
  const client = postgres(url, connectionOptions(url, opts.max));
  return { db: drizzle(client, { schema }), close: () => client.end({ timeout: 5 }) };
}

let shared: DbHandle | undefined;

/** Process-wide connection pool built from DATABASE_URL. */
export function getDb(): Db {
  shared ??= createDb();
  return shared.db;
}

/** Lightweight, non-throwing Postgres connectivity check. */
export async function probeDb(db: Db): Promise<DbProbeResult> {
  try {
    await db.execute(sql`SELECT 1`);
    return { ok: true };
  } catch (err) {
    const e = err as { code?: string; message?: string; cause?: { code?: string; message?: string } };
    const code = String(e.code || e.cause?.code || 'db_error');
    const message = String(e.cause?.message || e.message || 'Database connection failed.');
    return { ok: false, code, message };
  }
}
