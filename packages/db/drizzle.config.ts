import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  schemaFilter: ['vigas'],
  migrations: {
    schema: 'vigas',
    table: '__drizzle_migrations',
  },
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://vigas:vigas@localhost:5433/vigas' },
  strict: true,
});
