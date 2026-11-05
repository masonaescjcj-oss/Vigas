import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

export interface DbHandle {
  db: Db;
  close: () => Promise<void>;
}

export function createDb(url: string = process.env.DATABASE_URL ?? '', opts: { max?: number } = {}): DbHandle {
  if (!url) throw new Error('DATABASE_URL is not set');
  const client = postgres(url, { max: opts.max ?? 10, onnotice: () => {} });
  return { db: drizzle(client, { schema }), close: () => client.end({ timeout: 5 }) };
}

let shared: DbHandle | undefined;

/** Process-wide connection pool built from DATABASE_URL. */
export function getDb(): Db {
  shared ??= createDb();
  return shared.db;
}
