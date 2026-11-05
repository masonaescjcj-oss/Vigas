import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import {
  AdminInputError,
  adminDeleteArticle,
  adminDeleteTool,
  adminGetArticle,
  adminListArticles,
  adminListAuthors,
  adminSaveArticle,
  adminSaveAuthor,
  adminSaveTool,
  createDb,
  getArticle,
  listArticles,
  listTools,
  migrateDatabase,
  seedDatabase,
  type DbHandle,
} from '../src';

// Own database so this file can run in parallel with db.test.ts.
const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL ?? 'postgres://vigas:vigas@localhost:5433/postgres';
const DB_NAME = 'vigas_admin_test';
const url = ADMIN_URL.replace(/\/[^/]*$/, `/${DB_NAME}`);
let h: DbHandle;

beforeAll(async () => {
  const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
  if ((await admin`select 1 from pg_database where datname = ${DB_NAME}`).length === 0) await admin.unsafe(`create database ${DB_NAME}`);
  await admin.end();
  h = createDb(url, { max: 3 });
  await h.db.execute(sql`drop schema if exists public cascade`);
  await h.db.execute(sql`drop schema if exists drizzle cascade`);
  await h.db.execute(sql`create schema public`);
  await migrateDatabase(h.db);
  await seedDatabase(h.db);
}, 60_000);

afterAll(async () => {
  await h?.close();
});

const draft = {
  title: 'Vigas launches per-key spending limits for every API key',
  dek: 'Teams can now cap what each key spends in a month.',
  category: 'Tools',
  authorSlug: 'nima-farahani',
  body: 'Every API key can now carry a monthly limit. Requests that would pass it get a clear 402 error.',
  cover: { big: '$', caption: 'LIMITS', color: '#FF6A1A' },
};

describe('content admin', () => {
  it('creates drafts that stay hidden until published', async () => {
    const { slug } = await adminSaveArticle(h.db, draft);
    expect(slug).toBe('vigas-launches-per-key-spending-limits-for-every-api-key');
    expect(await getArticle(h.db, slug)).toBeNull();
    expect((await adminListArticles(h.db, { status: 'draft' })).map((a) => a.slug)).toContain(slug);

    await adminSaveArticle(h.db, { ...draft, status: 'published', faq: [{ q: 'Is it free?', a: 'Yes.' }] }, slug);
    const live = await getArticle(h.db, slug);
    expect(live?.faq).toEqual([{ q: 'Is it free?', a: 'Yes.' }]);
    expect((await listArticles(h.db, { limit: 1 }))[0]!.slug).toBe(slug);
    expect((await adminGetArticle(h.db, slug))?.status).toBe('published');
  });

  it('renames slugs safely and rejects bad input', async () => {
    const { slug } = await adminSaveArticle(h.db, { ...draft, title: 'A second story about spending limits', slug: 'second-story' });
    await expect(adminSaveArticle(h.db, { ...draft, slug: 'second-story' })).rejects.toThrow(/already used/);
    const renamed = await adminSaveArticle(h.db, { ...draft, title: 'A second story about spending limits', slug: 'limits-two' }, slug);
    expect(renamed.slug).toBe('limits-two');
    expect(await adminGetArticle(h.db, 'second-story')).toBeNull();

    await expect(adminSaveArticle(h.db, { ...draft, category: 'Gossip' })).rejects.toBeInstanceOf(AdminInputError);
    await expect(adminSaveArticle(h.db, { ...draft, authorSlug: 'nobody' })).rejects.toThrow(/unknown author/);
    await expect(adminSaveArticle(h.db, { ...draft, slug: 'Bad Slug' })).rejects.toThrow(/slug/);
    expect(await adminDeleteArticle(h.db, 'limits-two')).toBe(true);
    expect(await adminDeleteArticle(h.db, 'limits-two')).toBe(false);
  });

  it('saves tools and authors', async () => {
    await adminSaveTool(h.db, {
      slug: 'claude-code',
      name: 'Claude Code',
      tagline: 'Agentic coding in your terminal.',
      description: 'An AI coding agent that works in your terminal and editor.',
      category: 'Coding',
      pricing: 'Paid',
      rating: 4.8,
      color: '#E3B65C',
      letter: 'C',
      url: 'https://claude.com/claude-code',
      isNew: true,
    });
    expect((await listTools(h.db, { category: 'Coding' })).map((t) => t.slug)).toContain('claude-code');
    await adminSaveTool(h.db, { slug: 'claude-code', name: 'Claude Code', tagline: 'Agentic coding, anywhere.', description: 'Updated description text.', category: 'Coding', pricing: 'Paid', color: '#E3B65C', letter: 'C', url: 'https://claude.com/claude-code' });
    expect((await listTools(h.db, { q: 'anywhere' }))[0]!.slug).toBe('claude-code');
    await expect(adminSaveTool(h.db, { slug: 'x-tool', name: 'X', tagline: 'Too short?', description: 'Some description', category: 'Coding', pricing: 'Free', color: 'orange', letter: 'X', url: 'https://x.dev' })).rejects.toThrow(/color/);
    expect(await adminDeleteTool(h.db, 'claude-code')).toBe(true);

    await adminSaveAuthor(h.db, { slug: 'guest-writer', name: 'Guest Writer', role: 'Contributor', color: '#5DB7B0' });
    const list = await adminListAuthors(h.db);
    expect(list.find((a) => a.slug === 'guest-writer')).toMatchObject({ articles: 0 });
    expect(list.find((a) => a.slug === 'sara-moradi')!.articles).toBeGreaterThan(0);
  });
});
