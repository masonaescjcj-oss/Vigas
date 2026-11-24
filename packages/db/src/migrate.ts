import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { Db } from './client';

/** Applies SQL migrations from packages/db/drizzle strictly inside the isolated `vigas` schema. */
export async function migrateDatabase(db: Db, migrationsFolder?: string): Promise<void> {
  const folder = migrationsFolder ?? resolve(dirname(fileURLToPath(import.meta.url)), '../drizzle');
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS "vigas"`);
  await migrate(db, {
    migrationsFolder: folder,
    migrationsSchema: 'vigas',
    migrationsTable: '__drizzle_migrations',
  });
}
