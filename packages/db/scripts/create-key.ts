/**
 * Creates an API key for an existing user and prints it once.
 * Usage: pnpm --filter @vigas/db create-key <email> [name]
 */
import { eq } from 'drizzle-orm';
import { createDb } from '../src/client';
import { findUserByEmail } from '../src/auth';
import { createApiKey } from '../src/billing';
import { accounts } from '../src/schema';

const [email, name = 'CLI key'] = process.argv.slice(2);
if (!email) {
  console.error('Usage: create-key <email> [name]');
  process.exit(1);
}
const { db, close } = createDb(process.env.DATABASE_URL ?? 'postgres://vigas:vigas@localhost:5433/vigas', { max: 1 });
const user = await findUserByEmail(db, email);
const [account] = user ? await db.select().from(accounts).where(eq(accounts.userId, user.id)) : [];
if (!account) {
  console.error(`No user with email ${email}`);
  await close();
  process.exit(1);
}
const key = await createApiKey(db, account.id, name);
console.log(key.key);
await close();
