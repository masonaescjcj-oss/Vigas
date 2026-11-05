import { and, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import type { ApiKeySummary, CreatedApiKey, TopupResponse, WalletResponse } from '@vigas/core';
import { quoteTopup } from '@vigas/core';
import { generateApiKey, randomId, sha256Hex } from '@vigas/core/server';
import type { Db } from './client';
import { accounts, apiKeys, creditHolds, ledgerEntries, topups, usageEvents } from './schema';

export type UsageSource = 'api' | 'chat' | 'arena' | 'retrobuild';

export interface KeyAuth {
  accountId: string;
  apiKeyId: string;
  name: string;
  balanceMicros: number;
  monthlyLimitMicros: number | null;
}

/** Looks up a live API key by its plain value. Returns null for unknown or revoked keys. */
export async function authenticateApiKey(db: Db, key: string): Promise<KeyAuth | null> {
  const [row] = await db
    .select({
      apiKeyId: apiKeys.id,
      accountId: apiKeys.accountId,
      name: apiKeys.name,
      balanceMicros: accounts.balanceMicros,
      monthlyLimitMicros: apiKeys.monthlyLimitMicros,
    })
    .from(apiKeys)
    .innerJoin(accounts, eq(accounts.id, apiKeys.accountId))
    .where(and(eq(apiKeys.keyHash, sha256Hex(key)), isNull(apiKeys.revokedAt)))
    .limit(1);
  return row ?? null;
}

export async function getAccount(db: Db, accountId: string) {
  const [row] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  return row ?? null;
}

/**
 * Atomically moves `amountMicros` from the spendable balance into a hold.
 * Returns the hold id, or null when the balance is too low.
 */
export async function reserveCredits(db: Db, accountId: string, amountMicros: number): Promise<string | null> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(accounts)
      .set({ balanceMicros: sql`${accounts.balanceMicros} - ${amountMicros}` })
      .where(and(eq(accounts.id, accountId), gte(accounts.balanceMicros, amountMicros)))
      .returning({ id: accounts.id });
    if (updated.length === 0) return null;
    const id = randomId('hold');
    await tx.insert(creditHolds).values({ id, accountId, amountMicros });
    return id;
  });
}

export interface SettleInput {
  holdId: string;
  accountId: string;
  apiKeyId: string | null;
  source: UsageSource;
  modelId: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  costMicros: number;
  latencyMs: number;
  status: 'ok' | 'error';
  errorCode?: string | null;
}

/**
 * Releases a hold, charges the real cost and records the usage event — all in one transaction.
 * If the cleanup job already released the hold, only the real cost is charged.
 */
export async function settleUsage(db: Db, input: SettleInput): Promise<void> {
  await db.transaction(async (tx) => {
    const [hold] = await tx
      .update(creditHolds)
      .set({ releasedAt: new Date() })
      .where(and(eq(creditHolds.id, input.holdId), isNull(creditHolds.releasedAt)))
      .returning({ amount: creditHolds.amountMicros });
    const refund = hold?.amount ?? 0;
    await tx
      .update(accounts)
      .set({ balanceMicros: sql`${accounts.balanceMicros} + ${refund - input.costMicros}` })
      .where(eq(accounts.id, input.accountId));
    if (input.costMicros > 0) {
      await tx.insert(ledgerEntries).values({
        accountId: input.accountId,
        amountMicros: -input.costMicros,
        kind: 'usage',
        reference: `${input.source}:${input.modelId}`,
      });
    }
    await tx.insert(usageEvents).values({
      accountId: input.accountId,
      apiKeyId: input.apiKeyId,
      source: input.source,
      modelId: input.modelId,
      provider: input.provider,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      costMicros: input.costMicros,
      latencyMs: input.latencyMs,
      status: input.status,
      errorCode: input.errorCode ?? null,
    });
    if (input.apiKeyId) await tx.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, input.apiKeyId));
  });
}

/** Refunds holds left open by crashed requests. Run every few minutes. */
export async function releaseStaleHolds(db: Db, olderThanMs = 10 * 60_000): Promise<number> {
  return db.transaction(async (tx) => {
    const stale = await tx
      .update(creditHolds)
      .set({ releasedAt: new Date() })
      .where(and(isNull(creditHolds.releasedAt), lt(creditHolds.createdAt, new Date(Date.now() - olderThanMs))))
      .returning({ accountId: creditHolds.accountId, amount: creditHolds.amountMicros });
    for (const h of stale) {
      await tx
        .update(accounts)
        .set({ balanceMicros: sql`${accounts.balanceMicros} + ${h.amount}` })
        .where(eq(accounts.id, h.accountId));
    }
    return stale.length;
  });
}

// ── Keys ────────────────────────────────────────────────────────────────────

const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

export async function listApiKeys(db: Db, accountId: string): Promise<ApiKeySummary[]> {
  // Column names are written out in full: drizzle leaves them unqualified in single-table selects.
  const spent = sql<number>`coalesce((select sum(ue.cost_micros) from usage_events ue
    where ue.api_key_id = "api_keys"."id" and ue.created_at >= ${monthStart().toISOString()}), 0)::bigint`;
  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      display: apiKeys.display,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      monthlyLimitMicros: apiKeys.monthlyLimitMicros,
      spent,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.accountId, accountId), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    display: r.display,
    createdAt: r.createdAt.toISOString(),
    lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
    spentThisMonthMicros: Number(r.spent),
    monthlyLimitMicros: r.monthlyLimitMicros,
  }));
}

export async function createApiKey(
  db: Db,
  accountId: string,
  name: string,
  opts: { monthlyLimitMicros?: number | null } = {},
): Promise<CreatedApiKey> {
  const k = generateApiKey();
  const id = randomId('key');
  const limit = opts.monthlyLimitMicros && opts.monthlyLimitMicros > 0 ? Math.round(opts.monthlyLimitMicros) : null;
  const [row] = await db
    .insert(apiKeys)
    .values({ id, accountId, name: name.trim().slice(0, 80) || 'Untitled key', keyHash: k.hash, display: k.display, monthlyLimitMicros: limit })
    .returning();
  return {
    id,
    name: row!.name,
    display: k.display,
    key: k.key,
    createdAt: row!.createdAt.toISOString(),
    lastUsedAt: null,
    spentThisMonthMicros: 0,
    monthlyLimitMicros: limit,
  };
}

/** Sets or clears (null) a key's monthly spending cap. */
export async function setApiKeyLimit(db: Db, accountId: string, keyId: string, monthlyLimitMicros: number | null): Promise<boolean> {
  const res = await db
    .update(apiKeys)
    .set({ monthlyLimitMicros: monthlyLimitMicros && monthlyLimitMicros > 0 ? Math.round(monthlyLimitMicros) : null })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.accountId, accountId), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id });
  return res.length > 0;
}

/** What a key has spent since the start of the current UTC month. */
export async function keySpendThisMonth(db: Db, apiKeyId: string): Promise<number> {
  const [row] = await db
    .select({ spent: sql<number>`coalesce(sum(${usageEvents.costMicros}), 0)::bigint` })
    .from(usageEvents)
    .where(and(eq(usageEvents.apiKeyId, apiKeyId), gte(usageEvents.createdAt, monthStart())));
  return Number(row?.spent ?? 0);
}

export async function revokeApiKey(db: Db, accountId: string, keyId: string): Promise<boolean> {
  const res = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.accountId, accountId), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id });
  return res.length > 0;
}

// ── Wallet ──────────────────────────────────────────────────────────────────

export async function getWallet(db: Db, accountId: string, feeBps: number): Promise<WalletResponse | null> {
  const account = await getAccount(db, accountId);
  if (!account) return null;
  const since = new Date(Date.now() - 6 * 86_400_000);
  since.setUTCHours(0, 0, 0, 0);
  const daily = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${usageEvents.createdAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
      cost: sql<number>`sum(${usageEvents.costMicros})::bigint`,
    })
    .from(usageEvents)
    .where(and(eq(usageEvents.accountId, accountId), gte(usageEvents.createdAt, since)))
    .groupBy(sql`1`);
  const byDay = new Map(daily.map((d) => [d.day, Number(d.cost)]));
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    return { date: d, costMicros: byDay.get(d) ?? 0 };
  });
  const sources = await db
    .select({ source: usageEvents.source, cost: sql<number>`sum(${usageEvents.costMicros})::bigint` })
    .from(usageEvents)
    .where(and(eq(usageEvents.accountId, accountId), gte(usageEvents.createdAt, new Date(Date.now() - 30 * 86_400_000))))
    .groupBy(usageEvents.source);
  return {
    balanceMicros: account.balanceMicros,
    lifetimeTopupMicros: account.lifetimeTopupMicros,
    feeBps,
    week,
    bySource: sources.map((s) => ({ source: s.source, costMicros: Number(s.cost) })).sort((a, b) => b.costMicros - a.costMicros),
    keys: await listApiKeys(db, accountId),
  };
}

/**
 * Adds credits after a payment succeeds. With the "test" provider the payment step is skipped,
 * so this must only be reachable when PAYMENT_PROVIDER=test.
 */
export async function completeTopup(
  db: Db,
  input: { accountId: string; amountMicros: number; feeBps: number; provider: string; providerRef?: string },
): Promise<TopupResponse> {
  return db.transaction(async (tx) => {
    const [acc] = await tx
      .select({ lifetime: accounts.lifetimeTopupMicros })
      .from(accounts)
      .where(eq(accounts.id, input.accountId))
      .for('update');
    if (!acc) throw new Error('Account not found');
    const quote = quoteTopup(input.amountMicros, acc.lifetime, input.feeBps);
    const id = randomId('top');
    await tx.insert(topups).values({
      id,
      accountId: input.accountId,
      amountMicros: quote.amountMicros,
      feeMicros: quote.feeMicros,
      provider: input.provider,
      providerRef: input.providerRef ?? null,
      status: 'succeeded',
      completedAt: new Date(),
    });
    await tx.insert(ledgerEntries).values({ accountId: input.accountId, amountMicros: quote.amountMicros, kind: 'topup', reference: id });
    const [updated] = await tx
      .update(accounts)
      .set({
        balanceMicros: sql`${accounts.balanceMicros} + ${quote.amountMicros}`,
        lifetimeTopupMicros: sql`${accounts.lifetimeTopupMicros} + ${quote.amountMicros}`,
      })
      .where(eq(accounts.id, input.accountId))
      .returning({ balance: accounts.balanceMicros });
    return { balanceMicros: updated!.balance, chargedMicros: quote.totalMicros, feeMicros: quote.feeMicros };
  });
}
