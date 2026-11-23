import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { usdToMicros, type ModelTag } from '@vigas/core';
import { randomId, sha256Hex } from '@vigas/core/server';
import { AdminInputError } from './admin';
import type { Db } from './client';
import { accounts, ledgerEntries, modelEndpoints, models, upstreamKeys, upstreamProviders, usageEvents, users } from './schema';

export type UpstreamProviderKind = 'openai' | 'anthropic' | 'gemini' | 'youcom';
export type UpstreamKeyStrategy = 'sticky' | 'round_robin' | 'random' | 'sequential' | 'least_used';

const VALID_KINDS = new Set<UpstreamProviderKind>(['openai', 'anthropic', 'gemini', 'youcom']);
const VALID_STRATEGIES = new Set<UpstreamKeyStrategy>(['sticky', 'round_robin', 'random', 'sequential', 'least_used']);
const VALID_TAGS = new Set<ModelTag>(['free', 'coding', 'reasoning', 'vision', 'agents']);

function encryptionSecret(override?: string | null): string | null {
  const s = (override ?? process.env.UPSTREAM_KEYS_SECRET ?? process.env.INTERNAL_SERVICE_TOKEN ?? '').trim();
  return s.length >= 16 ? s : null;
}

function deriveAesKey(secret: string): Buffer {
  return createHash('sha256').update(`vigas:upstream-keys:v1:${secret}`).digest();
}

export function encryptUpstreamKey(plainKey: string, secretOverride?: string | null): string {
  const secret = encryptionSecret(secretOverride);
  if (!secret) return `plain:${plainKey}`;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveAesKey(secret), iv);
  const enc = Buffer.concat([cipher.update(plainKey, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`;
}

export function decryptUpstreamKey(stored: string, secretOverride?: string | null): string | null {
  if (stored.startsWith('plain:')) return stored.slice(6);
  if (!stored.startsWith('enc:v1:')) return stored;
  const secret = encryptionSecret(secretOverride);
  if (!secret) return null;
  const parts = stored.slice(7).split('.');
  if (parts.length !== 3) return null;
  try {
    const iv = Buffer.from(parts[0]!, 'base64url');
    const tag = Buffer.from(parts[1]!, 'base64url');
    const data = Buffer.from(parts[2]!, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', deriveAesKey(secret), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function maskKeyHint(rawKey: string): string {
  const k = rawKey.trim();
  if (k.length <= 10) return `${k.slice(0, 3)}…${k.slice(-2)}`;
  return `${k.slice(0, 6)}…${k.slice(-4)}`;
}

/**
 * Splits bulk-pasted API keys separated by newlines, commas, semicolons, slashes, or whitespace.
 * Deduplicates while preserving order.
 */
export function splitBulkKeys(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of raw.split(/[\n,;/\s]+/)) {
    const clean = token.trim();
    if (clean.length < 8 || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}

// ── Upstream Providers & Multi-Key Pools ────────────────────────────────────

export interface AdminUpstreamKeyRow {
  id: string;
  providerSlug: string;
  label: string;
  keyHint: string;
  budgetUsd: number | null;
  enabled: boolean;
  createdAt: string;
}

export interface AdminUpstreamProviderRow {
  slug: string;
  name: string;
  kind: UpstreamProviderKind;
  baseUrl: string;
  keyStrategy: UpstreamKeyStrategy;
  allowedModels: string[] | null;
  hidden: boolean;
  publicLabel: string;
  enabled: boolean;
  updatedAt: string;
  keys: AdminUpstreamKeyRow[];
}

export async function adminListUpstreamProviders(db: Db): Promise<AdminUpstreamProviderRow[]> {
  const [providers, keys] = await Promise.all([
    db.select().from(upstreamProviders).orderBy(upstreamProviders.slug),
    db.select().from(upstreamKeys).orderBy(upstreamKeys.createdAt),
  ]);
  const byProvider = new Map<string, AdminUpstreamKeyRow[]>();
  for (const k of keys) {
    const list = byProvider.get(k.providerSlug) ?? [];
    list.push({
      id: k.id,
      providerSlug: k.providerSlug,
      label: k.label,
      keyHint: k.keyHint,
      budgetUsd: k.budgetMicros === null ? null : Number((k.budgetMicros / 1_000_000).toFixed(2)),
      enabled: k.enabled,
      createdAt: k.createdAt.toISOString(),
    });
    byProvider.set(k.providerSlug, list);
  }
  return providers.map((p) => ({
    slug: p.slug,
    name: p.name,
    kind: p.kind,
    baseUrl: p.baseUrl,
    keyStrategy: p.keyStrategy,
    allowedModels: p.allowedModels ?? null,
    hidden: p.hidden,
    publicLabel: p.publicLabel,
    enabled: p.enabled,
    updatedAt: p.updatedAt.toISOString(),
    keys: byProvider.get(p.slug) ?? [],
  }));
}

export interface SaveUpstreamProviderInput {
  slug: string;
  name: string;
  kind: UpstreamProviderKind;
  baseUrl: string;
  keyStrategy?: UpstreamKeyStrategy;
  allowedModels?: string[] | null;
  hidden?: boolean;
  publicLabel?: string;
  enabled?: boolean;
}

export async function adminSaveUpstreamProvider(db: Db, raw: SaveUpstreamProviderInput): Promise<{ slug: string }> {
  const slug = String(raw.slug ?? '')
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9_-]{2,40}$/.test(slug)) {
    throw new AdminInputError('Provider slug must be 2–40 lowercase letters, digits, hyphens, or underscores.');
  }
  const name = String(raw.name ?? '').trim();
  if (!name) throw new AdminInputError('Provider name is required.');
  const kind = raw.kind;
  if (!VALID_KINDS.has(kind)) throw new AdminInputError('Invalid provider protocol kind.');
  const baseUrl = String(raw.baseUrl ?? '')
    .trim()
    .replace(/\/+$/, '');
  if (!/^https?:\/\/.+/i.test(baseUrl)) throw new AdminInputError('Base URL must start with http:// or https://.');
  const keyStrategy: UpstreamKeyStrategy = raw.keyStrategy && VALID_STRATEGIES.has(raw.keyStrategy) ? raw.keyStrategy : 'sticky';
  const allowedModels =
    Array.isArray(raw.allowedModels) && raw.allowedModels.length > 0
      ? raw.allowedModels.map((m) => m.trim().toLowerCase()).filter(Boolean)
      : null;
  const hidden = raw.hidden !== false;
  const publicLabel = String(raw.publicLabel ?? '').trim() || 'vigas-edge';
  const enabled = raw.enabled !== false;

  await db
    .insert(upstreamProviders)
    .values({
      slug,
      name,
      kind,
      baseUrl,
      keyStrategy,
      allowedModels,
      hidden,
      publicLabel,
      enabled,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: upstreamProviders.slug,
      set: { name, kind, baseUrl, keyStrategy, allowedModels, hidden, publicLabel, enabled, updatedAt: new Date() },
    });
  return { slug };
}

export async function adminDeleteUpstreamProvider(db: Db, slug: string): Promise<void> {
  await db.delete(upstreamProviders).where(eq(upstreamProviders.slug, slug.trim().toLowerCase()));
}

export async function adminAddUpstreamKeys(
  db: Db,
  input: { providerSlug: string; rawKeys: string; labelPrefix?: string; budgetUsd?: number | null },
  secretOverride?: string | null,
): Promise<{ added: number; skipped: number }> {
  const providerSlug = String(input.providerSlug ?? '')
    .trim()
    .toLowerCase();
  const [provider] = await db.select({ slug: upstreamProviders.slug }).from(upstreamProviders).where(eq(upstreamProviders.slug, providerSlug)).limit(1);
  if (!provider) throw new AdminInputError(`Provider "${providerSlug}" does not exist. Create it first.`);

  const parsed = splitBulkKeys(String(input.rawKeys ?? ''));
  if (parsed.length === 0) throw new AdminInputError('Paste at least one valid API key.');

  const budgetMicros =
    typeof input.budgetUsd === 'number' && Number.isFinite(input.budgetUsd) && input.budgetUsd > 0 ? usdToMicros(input.budgetUsd) : null;
  const existing = await db.select({ keyHash: upstreamKeys.keyHash }).from(upstreamKeys).where(eq(upstreamKeys.providerSlug, providerSlug));
  const existingHashes = new Set(existing.map((r) => r.keyHash));
  const prefix = (input.labelPrefix ?? providerSlug).trim() || providerSlug;

  let added = 0;
  let skipped = 0;
  let seq = existing.length;

  for (const key of parsed) {
    const keyHash = sha256Hex(key);
    if (existingHashes.has(keyHash)) {
      skipped += 1;
      continue;
    }
    seq += 1;
    existingHashes.add(keyHash);
    await db
      .insert(upstreamKeys)
      .values({
        id: randomId('ukey'),
        providerSlug,
        label: `${prefix}-${String(seq).padStart(2, '0')}`,
        keyCiphertext: encryptUpstreamKey(key, secretOverride),
        keyHint: maskKeyHint(key),
        keyHash,
        budgetMicros,
        enabled: true,
      })
      .onConflictDoNothing();
    added += 1;
  }
  return { added, skipped };
}

export async function adminUpdateUpstreamKey(
  db: Db,
  id: string,
  patch: { enabled?: boolean; label?: string; budgetUsd?: number | null },
): Promise<void> {
  const set: Partial<typeof upstreamKeys.$inferInsert> = {};
  if (typeof patch.enabled === 'boolean') set.enabled = patch.enabled;
  if (typeof patch.label === 'string' && patch.label.trim()) set.label = patch.label.trim().slice(0, 64);
  if (patch.budgetUsd !== undefined) {
    set.budgetMicros =
      typeof patch.budgetUsd === 'number' && Number.isFinite(patch.budgetUsd) && patch.budgetUsd > 0 ? usdToMicros(patch.budgetUsd) : null;
  }
  if (Object.keys(set).length === 0) return;
  await db.update(upstreamKeys).set(set).where(eq(upstreamKeys.id, id));
}

export async function adminDeleteUpstreamKey(db: Db, id: string): Promise<void> {
  await db.delete(upstreamKeys).where(eq(upstreamKeys.id, id));
}

export interface ActiveDbUpstreamProvider {
  slug: string;
  kind: UpstreamProviderKind;
  baseUrl: string;
  keyStrategy: UpstreamKeyStrategy;
  allowedModels: string[] | null;
  hidden: boolean;
  publicLabel: string;
  enabled: boolean;
  keys: Array<{ key: string; label: string; budgetMicros: number | null }>;
}

/**
 * Loaded by `apps/gateway` at startup and periodically / on-demand reload so keys and providers
 * managed in `/admin/providers` take effect live without redeploying.
 */
export async function loadActiveUpstreamProviders(db: Db, secretOverride?: string | null): Promise<ActiveDbUpstreamProvider[]> {
  const [providers, keys] = await Promise.all([
    db.select().from(upstreamProviders),
    db.select().from(upstreamKeys).where(eq(upstreamKeys.enabled, true)).orderBy(upstreamKeys.createdAt),
  ]);
  const keysBySlug = new Map<string, Array<{ key: string; label: string; budgetMicros: number | null }>>();
  for (const k of keys) {
    const plain = decryptUpstreamKey(k.keyCiphertext, secretOverride);
    if (!plain) continue;
    const list = keysBySlug.get(k.providerSlug) ?? [];
    list.push({ key: plain, label: k.label, budgetMicros: k.budgetMicros });
    keysBySlug.set(k.providerSlug, list);
  }
  return providers.map((p) => ({
    slug: p.slug,
    kind: p.kind,
    baseUrl: p.baseUrl,
    keyStrategy: p.keyStrategy,
    allowedModels: p.allowedModels ?? null,
    hidden: p.hidden,
    publicLabel: p.publicLabel,
    enabled: p.enabled,
    keys: keysBySlug.get(p.slug) ?? [],
  }));
}

// ── Admin Models & Endpoints ────────────────────────────────────────────────

export interface AdminEndpointRow {
  provider: string;
  modelId: string;
  upstreamModel: string;
  inputUsd: number;
  outputUsd: number;
  priority: number;
  enabled: boolean;
}

export interface AdminModelRow {
  id: string;
  name: string;
  org: string;
  contextLength: number;
  inputUsd: number;
  outputUsd: number;
  tags: string[];
  auto: boolean;
  endpoints: AdminEndpointRow[];
}

export async function adminListCatalog(db: Db): Promise<AdminModelRow[]> {
  const [mRows, eRows] = await Promise.all([
    db.select().from(models).orderBy(models.org, models.id),
    db.select().from(modelEndpoints).orderBy(modelEndpoints.priority, modelEndpoints.provider),
  ]);
  const byModel = new Map<string, AdminEndpointRow[]>();
  for (const e of eRows) {
    const list = byModel.get(e.modelId) ?? [];
    list.push({
      provider: e.provider,
      modelId: e.modelId,
      upstreamModel: e.upstreamModel,
      inputUsd: Number((e.inputPerMillionMicros / 1_000_000).toFixed(4)),
      outputUsd: Number((e.outputPerMillionMicros / 1_000_000).toFixed(4)),
      priority: e.priority,
      enabled: e.enabled,
    });
    byModel.set(e.modelId, list);
  }
  return mRows.map((m) => ({
    id: m.id,
    name: m.name,
    org: m.org,
    contextLength: m.contextLength,
    inputUsd: Number((m.inputPerMillionMicros / 1_000_000).toFixed(4)),
    outputUsd: Number((m.outputPerMillionMicros / 1_000_000).toFixed(4)),
    tags: m.tags,
    auto: m.auto,
    endpoints: byModel.get(m.id) ?? [],
  }));
}

export async function adminSaveModel(
  db: Db,
  input: {
    id: string;
    name: string;
    org: string;
    contextLength: number;
    inputUsd: number;
    outputUsd: number;
    tags?: string[];
    auto?: boolean;
  },
): Promise<{ id: string }> {
  const id = String(input.id ?? '')
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9._-]+\/[a-z0-9._:-]+$/i.test(id)) {
    throw new AdminInputError('Model ID must look like "org/model-name" (e.g. "you/express" or "google/gemini-4-hydrogen:free").');
  }
  const name = String(input.name ?? '').trim();
  const org = String(input.org ?? '').trim();
  if (!name || !org) throw new AdminInputError('Model name and organization are required.');
  const contextLength = Math.max(1024, Math.round(Number(input.contextLength) || 128_000));
  const inputUsd = Number(input.inputUsd);
  const outputUsd = Number(input.outputUsd);
  if (!Number.isFinite(inputUsd) || inputUsd < 0 || !Number.isFinite(outputUsd) || outputUsd < 0) {
    throw new AdminInputError('Input and output USD prices must be >= 0.');
  }
  const tags = (Array.isArray(input.tags) ? input.tags : []).filter((t): t is ModelTag => VALID_TAGS.has(t as ModelTag));

  await db
    .insert(models)
    .values({
      id,
      name,
      org,
      contextLength,
      inputPerMillionMicros: usdToMicros(inputUsd),
      outputPerMillionMicros: usdToMicros(outputUsd),
      tags,
      auto: Boolean(input.auto),
    })
    .onConflictDoUpdate({
      target: models.id,
      set: {
        name,
        org,
        contextLength,
        inputPerMillionMicros: usdToMicros(inputUsd),
        outputPerMillionMicros: usdToMicros(outputUsd),
        tags,
        auto: Boolean(input.auto),
      },
    });
  return { id };
}

export async function adminDeleteModel(db: Db, modelId: string): Promise<void> {
  await db.delete(models).where(eq(models.id, modelId.trim().toLowerCase()));
}

export async function adminSaveEndpoint(
  db: Db,
  input: {
    provider: string;
    modelId: string;
    upstreamModel: string;
    inputUsd: number;
    outputUsd: number;
    priority?: number;
    enabled?: boolean;
  },
): Promise<{ provider: string; modelId: string }> {
  const provider = String(input.provider ?? '')
    .trim()
    .toLowerCase();
  const modelId = String(input.modelId ?? '')
    .trim()
    .toLowerCase();
  const upstreamModel = String(input.upstreamModel ?? '').trim();
  if (!provider || !modelId || !upstreamModel) {
    throw new AdminInputError('provider, modelId, and upstreamModel are required.');
  }
  const inputUsd = Number(input.inputUsd);
  const outputUsd = Number(input.outputUsd);
  if (!Number.isFinite(inputUsd) || inputUsd < 0 || !Number.isFinite(outputUsd) || outputUsd < 0) {
    throw new AdminInputError('Wholesale input/output prices must be >= 0.');
  }
  const priority = Number.isFinite(Number(input.priority)) ? Math.round(Number(input.priority)) : 0;
  const enabled = input.enabled !== false;

  await db
    .insert(modelEndpoints)
    .values({
      provider,
      modelId,
      upstreamModel,
      inputPerMillionMicros: usdToMicros(inputUsd),
      outputPerMillionMicros: usdToMicros(outputUsd),
      priority,
      enabled,
    })
    .onConflictDoUpdate({
      target: [modelEndpoints.modelId, modelEndpoints.provider],
      set: {
        upstreamModel,
        inputPerMillionMicros: usdToMicros(inputUsd),
        outputPerMillionMicros: usdToMicros(outputUsd),
        priority,
        enabled,
      },
    });
  return { provider, modelId };
}

export async function adminDeleteEndpoint(db: Db, provider: string, modelId: string): Promise<void> {
  await db
    .delete(modelEndpoints)
    .where(and(eq(modelEndpoints.provider, provider.trim().toLowerCase()), eq(modelEndpoints.modelId, modelId.trim().toLowerCase())));
}

// ── Admin Users & Credits ───────────────────────────────────────────────────

export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  role: 'user' | 'admin';
  accountId: string;
  balanceUsd: number;
  lifetimeTopupUsd: number;
  requests: number;
  createdAt: string;
}

export async function adminListUsers(db: Db, search?: string, limit = 100): Promise<AdminUserRow[]> {
  const q = search?.trim();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
      accountId: accounts.id,
      balanceMicros: accounts.balanceMicros,
      lifetimeTopupMicros: accounts.lifetimeTopupMicros,
      requests: sql<number>`coalesce((select count(*)::int from ${usageEvents} where ${usageEvents.accountId} = ${accounts.id}), 0)`,
    })
    .from(users)
    .innerJoin(accounts, eq(accounts.userId, users.id))
    .where(q ? or(ilike(users.email, `%${q}%`), ilike(users.name, `%${q}%`)) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    accountId: r.accountId,
    balanceUsd: Number((r.balanceMicros / 1_000_000).toFixed(4)),
    lifetimeTopupUsd: Number((r.lifetimeTopupMicros / 1_000_000).toFixed(2)),
    requests: Number(r.requests ?? 0),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function adminGrantCredits(
  db: Db,
  input: { accountId: string; deltaUsd: number; kind?: 'promo' | 'adjustment' | 'refund'; reference?: string },
): Promise<{ balanceUsd: number }> {
  const deltaUsd = Number(input.deltaUsd);
  if (!Number.isFinite(deltaUsd) || deltaUsd === 0 || Math.abs(deltaUsd) > 100_000) {
    throw new AdminInputError('Credit amount must be a non-zero USD value up to $100,000.');
  }
  const deltaMicros = Math.round(deltaUsd * 1_000_000);
  const kind = input.kind ?? (deltaMicros > 0 ? 'promo' : 'adjustment');
  const reference = input.reference?.trim().slice(0, 120) || `admin:${kind}`;

  return db.transaction(async (tx) => {
    const [acc] = await tx.select().from(accounts).where(eq(accounts.id, input.accountId)).limit(1);
    if (!acc) throw new AdminInputError('Billing account not found.');
    const nextBalance = Math.max(0, acc.balanceMicros + deltaMicros);
    const actualDelta = nextBalance - acc.balanceMicros;
    await tx.update(accounts).set({ balanceMicros: nextBalance }).where(eq(accounts.id, acc.id));
    await tx.insert(ledgerEntries).values({
      accountId: acc.id,
      amountMicros: actualDelta,
      kind,
      reference,
    });
    return { balanceUsd: Number((nextBalance / 1_000_000).toFixed(4)) };
  });
}

export async function adminSetUserRole(db: Db, userId: string, role: 'user' | 'admin'): Promise<void> {
  if (role !== 'user' && role !== 'admin') throw new AdminInputError('Role must be "user" or "admin".');
  await db.update(users).set({ role }).where(eq(users.id, userId));
}
