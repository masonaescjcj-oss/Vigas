import { createDb } from '../src/client';
import { seedDatabase } from '../src/seed';

const url = process.env.DATABASE_URL ?? 'postgres://vigas:vigas@localhost:5433/vigas';
const withDemo = process.env.SEED_DEMO_USER !== 'false' && process.env.NODE_ENV !== 'production';
const { db, close } = createDb(url, { max: 1 });
const res = await seedDatabase(db, {
  demoUser: withDemo ? { email: 'demo@vigas.ai', password: process.env.SEED_DEMO_PASSWORD ?? 'vigas-demo-2026' } : null,
});
console.log('Seed complete.');
if (res.demo) {
  console.log(`Demo user: ${res.demo.email} / ${res.demo.password}`);
  for (const k of res.demo.keys) console.log(`Demo API key: ${k}`);
}
await close();
