import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import {
  addNewsSource,
  adminGetArticle,
  adminSaveAuthor,
  createDb,
  draftArticleFromItem,
  getArticle,
  listNewItems,
  migrateDatabase,
  parseFeed,
  storeFeedItems,
  type DbHandle,
} from '../src';

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>AI Wire</title>
<item><title><![CDATA[Lab ships a 2M-token model]]></title><link>https://wire.example/a</link>
<guid isPermaLink="false">wire-1</guid><pubDate>Thu, 05 Nov 2026 08:00:00 GMT</pubDate>
<description>&lt;p&gt;The model reads &amp;amp; writes long docs.&lt;/p&gt;</description></item>
<item><title>No link here</title></item>
<item><title>Prices drop again</title><link>https://wire.example/b</link><description>Cheaper tokens.</description></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Lab blog</title>
<entry><title type="html">Agents &amp; tools</title><link rel="self" href="https://lab.example/self"/>
<link rel="alternate" href="https://lab.example/posts/agents"/><id>tag:lab.example,2026:1</id>
<updated>2026-11-04T10:00:00Z</updated><summary>How our agents use tools.</summary></entry></feed>`;

describe('feed parsing', () => {
  it('reads RSS with CDATA, entities and fallbacks', () => {
    const items = parseFeed(RSS);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ guid: 'wire-1', title: 'Lab ships a 2M-token model', url: 'https://wire.example/a', summary: 'The model reads & writes long docs.' });
    expect(items[0]!.publishedAt?.toISOString()).toBe('2026-11-05T08:00:00.000Z');
    expect(items[1]).toMatchObject({ guid: 'https://wire.example/b', publishedAt: null });
  });

  it('reads Atom and prefers the alternate link', () => {
    expect(parseFeed(ATOM)).toEqual([
      { guid: 'tag:lab.example,2026:1', title: 'Agents & tools', url: 'https://lab.example/posts/agents', summary: 'How our agents use tools.', publishedAt: new Date('2026-11-04T10:00:00Z') },
    ]);
  });
});

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL ?? 'postgres://vigas:vigas@localhost:5433/postgres';
const DB_NAME = 'vigas_news_test';
let h: DbHandle;

describe('pipeline', () => {
  beforeAll(async () => {
    const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
    if ((await admin`select 1 from pg_database where datname = ${DB_NAME}`).length === 0) await admin.unsafe(`create database ${DB_NAME}`);
    await admin.end();
    h = createDb(ADMIN_URL.replace(/\/[^/]*$/, `/${DB_NAME}`), { max: 3 });
    await h.db.execute(sql`drop schema if exists public cascade`);
    await h.db.execute(sql`drop schema if exists drizzle cascade`);
    await h.db.execute(sql`create schema public`);
    await migrateDatabase(h.db);
    await adminSaveAuthor(h.db, { slug: 'vigas-newsroom', name: 'Vigas Newsroom', role: 'Newsroom', color: '#FF6A1A' });
  }, 60_000);

  afterAll(async () => {
    await h?.close();
  });

  it('stores items once and turns them into unpublished drafts with a source link', async () => {
    const source = await addNewsSource(h.db, 'AI Wire', 'https://wire.example/feed.xml');
    expect(await storeFeedItems(h.db, source, parseFeed(RSS))).toBe(2);
    expect(await storeFeedItems(h.db, source, parseFeed(RSS))).toBe(0);

    const [first, second] = await listNewItems(h.db);
    const prompts: string[] = [];
    const model = async (_system: string, user: string) => {
      prompts.push(user);
      return 'Here you go:\n```json\n' + JSON.stringify({
        title: 'A 2M-token model arrives',
        dek: 'Long documents get easier.',
        category: 'Models',
        body: 'A lab released a model that reads two million tokens.\n\n## Why it matters\n\nFewer chunking tricks.',
        cover: { big: '2M', caption: 'TOKENS' },
      }) + '\n```';
    };
    const r = await draftArticleFromItem(h.db, first!.item.id, model, { authorSlug: 'vigas-newsroom' });
    expect(r).toEqual({ slug: 'a-2m-token-model-arrives' });
    expect(prompts[0]).toContain('URL: https://wire.example/a');
    const draft = await adminGetArticle(h.db, 'a-2m-token-model-arrives');
    expect(draft).toMatchObject({ status: 'draft', category: 'Models', cover: { big: '2M', caption: 'TOKENS' } });
    expect(draft!.body).toContain('Source: [AI Wire](https://wire.example/a)');
    expect(await getArticle(h.db, 'a-2m-token-model-arrives')).toBeNull(); // not public until an editor publishes it

    const bad = await draftArticleFromItem(h.db, second!.item.id, async () => 'Sorry, I cannot.', { authorSlug: 'vigas-newsroom' });
    expect(bad).toEqual({ error: 'Model reply had no JSON object' });
    expect(await listNewItems(h.db)).toHaveLength(0);
    expect(await draftArticleFromItem(h.db, first!.item.id, model, { authorSlug: 'vigas-newsroom' })).toEqual({ error: 'Item not found or already handled' });
  });
});
