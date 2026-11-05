import { createDb } from '../src/client';
import { migrateDatabase } from '../src/migrate';

const { db, close } = createDb(process.env.DATABASE_URL ?? 'postgres://vigas:vigas@localhost:5433/vigas', { max: 1 });
await migrateDatabase(db);
console.log('Migrations applied.');
await close();
