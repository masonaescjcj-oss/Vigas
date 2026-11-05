import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { Db } from './client';

/** Applies SQL migrations from packages/db/drizzle. */
export async function migrateDatabase(db: Db, migrationsFolder?: string): Promise<void> {
  const folder = migrationsFolder ?? resolve(dirname(fileURLToPath(import.meta.url)), '../drizzle');
  await migrate(db, { migrationsFolder: folder });
}
