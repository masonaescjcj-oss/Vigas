import { and, eq, gt, lt } from 'drizzle-orm';
import type { PublicUser } from '@vigas/core';
import { generateSessionToken, randomBase62, randomId, sha256Hex } from '@vigas/core/server';
import type { Db } from './client';
import { accounts, ledgerEntries, sessions, users } from './schema';

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

/**
 * Creates a user with a billing account and optional one-time welcome promo credit
 * (e.g. $5.00 You.com starter balance). Throws on duplicate email (unique violation).
 */
export async function createUser(
  db: Db,
  input: {
    email: string;
    name?: string | null;
    passwordHash: string;
    role?: 'user' | 'admin';
    welcomeBonusMicros?: number;
    welcomeReference?: string;
  },
): Promise<SessionUser> {
  const bonus =
    typeof input.welcomeBonusMicros === 'number' && Number.isFinite(input.welcomeBonusMicros) && input.welcomeBonusMicros > 0
      ? Math.round(input.welcomeBonusMicros)
      : 0;
  return db.transaction(async (tx) => {
    const id = randomId('usr');
    const accountId = randomId('acc');
    const email = normalizeEmail(input.email);
    await tx.insert(users).values({ id, email, name: input.name?.trim() || null, passwordHash: input.passwordHash, role: input.role ?? 'user' });
    await tx.insert(accounts).values({ id: accountId, userId: id, balanceMicros: bonus });
    if (bonus > 0) {
      await tx.insert(ledgerEntries).values({
        accountId,
        kind: 'promo',
        amountMicros: bonus,
        reference: input.welcomeReference ?? 'welcome:youcom',
      });
    }
    return { id, email, name: input.name?.trim() || null, role: input.role ?? 'user', accountId };
  });
}

/**
 * Finds an existing Vigas user + billing account by normalized email, or creates one for an
 * externally authenticated identity (e.g. Supabase Auth SSO across vigas.app and /chat).
 * Welcome promo credit is only granted on first-ever account creation.
 */
export async function findOrCreateExternalUser(
  db: Db,
  input: { email: string; name?: string | null; welcomeBonusMicros?: number; welcomeReference?: string },
): Promise<SessionUser> {
  const email = normalizeEmail(input.email);
  const existing = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, accountId: accounts.id })
    .from(users)
    .leftJoin(accounts, eq(accounts.userId, users.id))
    .where(eq(users.email, email))
    .limit(1);

  if (existing[0]) {
    const row = existing[0];
    let accountId = row.accountId;
    if (!accountId) {
      accountId = randomId('acc');
      await db.insert(accounts).values({ id: accountId, userId: row.id }).onConflictDoNothing();
      const [acc] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, row.id)).limit(1);
      accountId = acc!.id;
    }
    const cleanName = input.name?.trim() || null;
    if (!row.name && cleanName) {
      await db.update(users).set({ name: cleanName }).where(eq(users.id, row.id));
      return { id: row.id, email: row.email, name: cleanName, role: row.role, accountId };
    }
    return { id: row.id, email: row.email, name: row.name, role: row.role, accountId };
  }

  try {
    return await createUser(db, {
      email,
      name: input.name?.trim() || null,
      // Non-scrypt sentinel hash cannot match verifyPassword() until the user explicitly sets a password.
      passwordHash: `sso:${randomBase62(48)}`,
      welcomeBonusMicros: input.welcomeBonusMicros,
      welcomeReference: input.welcomeReference,
    });
  } catch {
    const [race] = await db
      .select({ id: users.id, email: users.email, name: users.name, role: users.role, accountId: accounts.id })
      .from(users)
      .innerJoin(accounts, eq(accounts.userId, users.id))
      .where(eq(users.email, email))
      .limit(1);
    if (!race) throw new Error('Could not resolve user after concurrent creation');
    return race;
  }
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
