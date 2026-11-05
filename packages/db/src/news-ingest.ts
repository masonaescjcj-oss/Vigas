import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { NEWS_CATEGORIES, type NewsCategory } from '@vigas/core';
import { adminSaveArticle } from './admin';
import type { Db } from './client';
import { newsItems, newsSources } from './schema';

/**
 * News pipeline: watch RSS/Atom feeds, store new items, and turn each into an original draft
 * article written by a model through the Vigas gateway. Drafts are never published automatically;
 * an editor reviews them in the admin.
 */

export interface FeedItem {
  guid: string;
  title: string;
  url: string;
  summary: string;
  publishedAt: Date | null;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m);
}

// Feed fields often hold escaped HTML: decode the XML, drop tags, then decode the HTML entities.
const stripTags = (s: string) =>
  decode(decode(s).replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

function tag(block: string, name: string): string | null {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block);
  return m ? m[1]! : null;
}

function date(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(decode(s).trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parses RSS 2.0 and Atom feeds. Items without a title or link are skipped. */
export function parseFeed(xml: string): FeedItem[] {
  const out: FeedItem[] = [];
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const blocks = xml.match(isAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  for (const b of blocks) {
    const title = stripTags(tag(b, 'title') ?? '');
    let url = '';
    if (isAtom) {
      const links = [...b.matchAll(/<link\b([^>]*)\/?>/gi)].map((m) => m[1]!);
      const alt = links.find((l) => !/rel="(?!alternate)/i.test(l)) ?? links[0] ?? '';
      url = decode(/href="([^"]+)"/i.exec(alt)?.[1] ?? '');
    } else {
      url = stripTags(tag(b, 'link') ?? '');
    }
    if (!title || !/^https?:\/\//.test(url)) continue;
    const guid = stripTags(tag(b, isAtom ? 'id' : 'guid') ?? '') || url;
    const summary = stripTags(tag(b, isAtom ? 'summary' : 'description') ?? tag(b, 'content') ?? '').slice(0, 2000);
    const publishedAt = date(isAtom ? (tag(b, 'published') ?? tag(b, 'updated')) : (tag(b, 'pubDate') ?? tag(b, 'dc:date')));
    out.push({ guid: guid.slice(0, 500), title: title.slice(0, 300), url, summary, publishedAt });
  }
  return out;
}

export async function addNewsSource(db: Db, name: string, feedUrl: string): Promise<number> {
  const [row] = await db
    .insert(newsSources)
    .values({ name, feedUrl })
    .onConflictDoUpdate({ target: newsSources.feedUrl, set: { name, enabled: true } })
    .returning({ id: newsSources.id });
  return row!.id;
}

export async function listNewsSources(db: Db) {
  return db.select().from(newsSources).where(eq(newsSources.enabled, true)).orderBy(asc(newsSources.id));
}

/** Stores items not seen before for this source; returns how many were new. */
export async function storeFeedItems(db: Db, sourceId: number, items: FeedItem[]): Promise<number> {
  if (items.length === 0) return 0;
  const inserted = await db
    .insert(newsItems)
    .values(items.map((i) => ({ sourceId, ...i })))
    .onConflictDoNothing({ target: [newsItems.sourceId, newsItems.guid] })
    .returning({ id: newsItems.id });
  await db.update(newsSources).set({ lastFetchedAt: new Date() }).where(eq(newsSources.id, sourceId));
  return inserted.length;
}

export async function listNewItems(db: Db, limit = 10) {
  return db
    .select({ item: newsItems, sourceName: newsSources.name })
    .from(newsItems)
    .innerJoin(newsSources, eq(newsSources.id, newsItems.sourceId))
    .where(eq(newsItems.status, 'new'))
    .orderBy(asc(newsItems.createdAt))
    .limit(limit);
}

/** Inbox for the admin: items in the given states, newest first, with their source name. */
export async function adminListNewsItems(
  db: Db,
  opts: { statuses?: Array<'new' | 'drafted' | 'ignored' | 'error'>; limit?: number } = {},
) {
  const statuses = opts.statuses ?? ['new', 'error'];
  const rows = await db
    .select({ item: newsItems, sourceName: newsSources.name })
    .from(newsItems)
    .innerJoin(newsSources, eq(newsSources.id, newsItems.sourceId))
    .where(inArray(newsItems.status, statuses))
    .orderBy(desc(newsItems.createdAt))
    .limit(Math.min(opts.limit ?? 50, 200));
  return rows.map(({ item, sourceName }) => ({
    id: item.id,
    title: item.title,
    url: item.url,
    summary: item.summary,
    sourceName,
    status: item.status,
    error: item.error,
    articleSlug: item.articleSlug,
    publishedAt: item.publishedAt?.toISOString() ?? null,
  }));
}

export async function setNewsItemStatus(db: Db, id: number, status: 'ignored' | 'new') {
  await db.update(newsItems).set({ status }).where(eq(newsItems.id, id));
}

/** Calls a chat model and returns its text reply. */
export type DraftModel = (system: string, user: string) => Promise<string>;

const SYSTEM_PROMPT = `You are a news editor at Vigas, a site about AI models, agents and tools.
Write an ORIGINAL short news brief about the source item: explain what happened and why it matters
to developers. Do not copy sentences from the source. Do not invent facts, numbers or quotes that
are not in the source; if something is unclear, say so. Reply with JSON only:
{"title": string (max 110 chars), "dek": string (one sentence), "category": one of ${NEWS_CATEGORIES.join(', ')},
"body": markdown, 2-4 short paragraphs, may use "## " subheadings,
"cover": {"big": short figure or word (max 6 chars), "caption": max 12 uppercase chars}}`;

const COVER_COLORS = ['#FF6A1A', '#E3B65C', '#9A9DFA', '#5DB7B0', '#6FCF73', '#5B8FD6'];

function extractJson(text: string): Record<string, unknown> {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Model reply had no JSON object');
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

/**
 * Writes a draft article for one new item. On success the item is marked "drafted" with the
 * article slug; on failure it's marked "error" with the reason.
 */
export async function draftArticleFromItem(
  db: Db,
  itemId: number,
  model: DraftModel,
  opts: { authorSlug: string },
): Promise<{ slug: string } | { error: string }> {
  const [row] = await db
    .select({ item: newsItems, sourceName: newsSources.name })
    .from(newsItems)
    .innerJoin(newsSources, eq(newsSources.id, newsItems.sourceId))
    .where(and(eq(newsItems.id, itemId), eq(newsItems.status, 'new')))
    .limit(1);
  if (!row) return { error: 'Item not found or already handled' };
  const { item, sourceName } = row;
  try {
    const reply = await model(
      SYSTEM_PROMPT,
      `Source: ${sourceName}\nTitle: ${item.title}\nURL: ${item.url}\nPublished: ${item.publishedAt?.toISOString() ?? 'unknown'}\nSummary: ${item.summary || '(none)'}`,
    );
    const j = extractJson(reply);
    const category = (NEWS_CATEGORIES as readonly string[]).includes(String(j.category)) ? (j.category as NewsCategory) : 'Models';
    const cover = (j.cover ?? {}) as { big?: unknown; caption?: unknown };
    const { slug } = await adminSaveArticle(db, {
      title: String(j.title ?? item.title).slice(0, 200),
      dek: String(j.dek ?? item.summary ?? item.title).slice(0, 400),
      category,
      authorSlug: opts.authorSlug,
      status: 'draft',
      body: `${String(j.body ?? '').trim()}\n\nSource: [${sourceName}](${item.url})`,
      cover: {
        big: String(cover.big ?? 'AI').slice(0, 8) || 'AI',
        caption: String(cover.caption ?? category.toUpperCase()).slice(0, 24) || 'NEWS',
        color: COVER_COLORS[item.id % COVER_COLORS.length]!,
      },
    });
    await db.update(newsItems).set({ status: 'drafted', articleSlug: slug, error: null }).where(eq(newsItems.id, item.id));
    return { slug };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(newsItems).set({ status: 'error', error: message.slice(0, 500) }).where(eq(newsItems.id, item.id));
    return { error: message };
  }
}
