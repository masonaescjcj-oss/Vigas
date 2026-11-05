import { and, eq, gt, lt } from 'drizzle-orm';
import type { PublicUser } from '@vigas/core';
import { generateSessionToken, randomId, sha256Hex } from '@vigas/core/server';
import type { Db } from './client';
import { accounts, sessions, users } from './schema';

export const SESSION_TTL_MS = 30 * 86_400_000;

export interface SessionUser extends PublicUser {
  role: 'user' | 'admin';
  accountId: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(db: Db, email: string) {
  const [row] = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
  return row ?? null;
}

/** Creates a user with an empty billing account. Throws on duplicate email (unique violation). */
export async function createUser(
  db: Db,
  input: { email: string; name?: string | null; passwordHash: string; role?: 'user' | 'admin' },
): Promise<SessionUser> {
  return db.transaction(async (tx) => {
    const id = randomId('usr');
    const accountId = randomId('acc');
    const email = normalizeEmail(input.email);
    await tx.insert(users).values({ id, email, name: input.name?.trim() || null, passwordHash: input.passwordHash, role: input.role ?? 'user' });
    await tx.insert(accounts).values({ id: accountId, userId: id });
    return { id, email, name: input.name?.trim() || null, role: input.role ?? 'user', accountId };
  });
}

/** Starts a session and returns the plain token (cookie value or bearer token). */
export async function createSession(db: Db, userId: string, userAgent?: string | null): Promise<string> {
  const t = generateSessionToken();
  await db.insert(sessions).values({
    id: randomId('ses'),
    userId,
    tokenHash: t.hash,
    userAgent: userAgent?.slice(0, 300) ?? null,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return t.token;
}

export async function getSessionUser(db: Db, token: string | null | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, accountId: accounts.id })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(accounts, eq(accounts.userId, users.id))
    .where(and(eq(sessions.tokenHash, sha256Hex(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, sha256Hex(token)));
}

export async function deleteExpiredSessions(db: Db): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
