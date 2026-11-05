import { eq, sql } from 'drizzle-orm';
import { LEADERBOARD_CATEGORIES, usdToMicros } from '@vigas/core';
import { SEED_TOTAL_SESSIONS, seedArticles, seedAuthors, seedEndpoints, seedLeaderboard, seedModels, seedTools } from '@vigas/core/seed';
import { hashPassword } from '@vigas/core/server';
import { createUser, findUserByEmail } from './auth';
import { completeTopup, createApiKey } from './billing';
import type { Db } from './client';
import { replaceLeaderboard } from './leaderboard';
import { articles, authors, modelEndpoints, models, tools, users } from './schema';

export interface SeedOptions {
  /** Create demo@vigas.ai with $48.20 of credits and two keys (local development only). */
  demoUser?: { email: string; password: string } | null;
  now?: Date;
}

export interface SeedResult {
  demo?: { email: string; password: string; keys: string[] };
}

/** Idempotent: re-running updates catalogue and content and leaves user data alone. */
export async function seedDatabase(db: Db, opts: SeedOptions = {}): Promise<SeedResult> {
  for (const m of seedModels) {
    const values = { ...m, description: m.description ?? null, enabled: true, updatedAt: new Date() };
    await db.insert(models).values(values).onConflictDoUpdate({ target: models.id, set: values });
  }
  for (const e of seedEndpoints) {
    await db
      .insert(modelEndpoints)
      .values(e)
      .onConflictDoUpdate({ target: [modelEndpoints.modelId, modelEndpoints.provider], set: e });
  }
  for (const a of seedAuthors) {
    await db.insert(authors).values(a).onConflictDoUpdate({ target: authors.slug, set: a });
  }
  for (const a of seedArticles(opts.now)) {
    const values = {
      slug: a.slug,
      title: a.title,
      dek: a.dek,
      category: a.category,
      flag: a.flag,
      authorSlug: a.author.slug,
      status: 'published' as const,
      publishedAt: new Date(a.publishedAt),
      updatedAt: new Date(a.updatedAt),
      body: a.body,
      readingMinutes: a.readingMinutes,
      cover: a.cover,
      faq: a.faq,
      mentionedModelIds: a.mentionedModelIds,
      pullQuote: a.pullQuote,
    };
    await db.insert(articles).values(values).onConflictDoNothing({ target: articles.slug });
  }
  for (const t of seedTools) {
    const { votes, voted: _voted, ...rest } = t;
    await db
      .insert(tools)
      .values({ ...rest, baseVotes: votes })
      .onConflictDoUpdate({ target: tools.slug, set: { ...rest, baseVotes: votes } });
  }
  for (const c of LEADERBOARD_CATEGORIES) {
    const [existing] = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from leaderboard_entries where category = ${c.id}`,
    );
    if (!existing || Number(existing.n) === 0) await replaceLeaderboard(db, c.id, seedLeaderboard(c.id), SEED_TOTAL_SESSIONS);
  }

  const result: SeedResult = {};
  if (opts.demoUser) {
    const existing = await findUserByEmail(db, opts.demoUser.email);
    if (!existing) {
      const user = await createUser(db, {
        email: opts.demoUser.email,
        name: 'Demo user',
        passwordHash: await hashPassword(opts.demoUser.password),
        role: 'admin',
      });
      await completeTopup(db, { accountId: user.accountId, amountMicros: usdToMicros(48.2), feeBps: 0, provider: 'seed' });
      const k1 = await createApiKey(db, user.accountId, 'Production gateway');
      const k2 = await createApiKey(db, user.accountId, 'RetroBuild mobile agent');
      result.demo = { ...opts.demoUser, keys: [k1.key, k2.key] };
    } else {
      await db.update(users).set({ role: 'admin' }).where(eq(users.id, existing.id));
      result.demo = { ...opts.demoUser, keys: [] };
    }
  }
  return result;
}
