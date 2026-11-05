import { and, asc, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { Article, Author, NewsCategory, NewsListItem, ToolCategory, ToolItem } from '@vigas/core';
import type { Db } from './client';
import { articles, authors, tools, toolVotes } from './schema';

type ArticleRow = typeof articles.$inferSelect;
type AuthorRow = typeof authors.$inferSelect;

const toListItem = (a: ArticleRow, au: AuthorRow): NewsListItem => ({
  slug: a.slug,
  title: a.title,
  dek: a.dek,
  category: a.category as NewsCategory,
  flag: (a.flag as NewsListItem['flag']) ?? null,
  author: { slug: au.slug, name: au.name, role: au.role, color: au.color } satisfies Author,
  publishedAt: a.publishedAt.toISOString(),
  readingMinutes: a.readingMinutes,
  cover: a.cover,
});

export async function listArticles(
  db: Db,
  opts: { category?: NewsCategory | null; limit?: number; offset?: number } = {},
): Promise<NewsListItem[]> {
  const where: SQL[] = [eq(articles.status, 'published')];
  if (opts.category) where.push(eq(articles.category, opts.category));
  const rows = await db
    .select()
    .from(articles)
    .innerJoin(authors, eq(authors.slug, articles.authorSlug))
    .where(and(...where))
    .orderBy(desc(articles.publishedAt))
    .limit(Math.min(opts.limit ?? 20, 100))
    .offset(opts.offset ?? 0);
  return rows.map((r) => toListItem(r.articles, r.authors));
}

export async function countArticles(db: Db, category?: NewsCategory | null): Promise<number> {
  const where: SQL[] = [eq(articles.status, 'published')];
  if (category) where.push(eq(articles.category, category));
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(articles).where(and(...where));
  return row?.n ?? 0;
}

export async function getArticle(db: Db, slug: string): Promise<Article | null> {
  const [r] = await db
    .select()
    .from(articles)
    .innerJoin(authors, eq(authors.slug, articles.authorSlug))
    .where(and(eq(articles.slug, slug), eq(articles.status, 'published')))
    .limit(1);
  if (!r) return null;
  const a = r.articles;
  return {
    ...toListItem(a, r.authors),
    updatedAt: a.updatedAt.toISOString(),
    body: a.body,
    faq: a.faq,
    mentionedModelIds: a.mentionedModelIds,
    pullQuote: a.pullQuote ?? null,
  };
}

/** Slugs and dates for the sitemap. */
export async function listArticleSitemap(db: Db): Promise<Array<{ slug: string; updatedAt: Date }>> {
  return db
    .select({ slug: articles.slug, updatedAt: articles.updatedAt })
    .from(articles)
    .where(eq(articles.status, 'published'))
    .orderBy(desc(articles.publishedAt));
}

// ── Tools ───────────────────────────────────────────────────────────────────

// Qualified by hand: drizzle leaves column names unqualified in single-table selects.
const voteCount = sql<number>`(select count(*)::int from tool_votes tv where tv.tool_slug = "tools"."slug")`;

export type ToolSort = 'votes' | 'rating' | 'new';

export async function listTools(
  db: Db,
  opts: { category?: ToolCategory | null; q?: string | null; sort?: ToolSort; userId?: string | null; limit?: number } = {},
): Promise<ToolItem[]> {
  const where: SQL[] = [];
  if (opts.category) where.push(eq(tools.category, opts.category));
  const q = opts.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    where.push(or(ilike(tools.name, like), ilike(tools.tagline, like), ilike(tools.category, like))!);
  }
  const voted = opts.userId
    ? sql<boolean>`exists(select 1 from tool_votes tv where tv.tool_slug = "tools"."slug" and tv.user_id = ${opts.userId})`
    : sql<boolean>`false`;
  const order =
    opts.sort === 'rating'
      ? [desc(tools.rating), asc(tools.name)]
      : opts.sort === 'new'
        ? [desc(tools.isNew), desc(tools.createdAt)]
        : [desc(sql`${tools.baseVotes} + ${voteCount}`)];
  const rows = await db
    .select({ t: tools, userVotes: voteCount, voted })
    .from(tools)
    .where(where.length ? and(...where) : undefined)
    .orderBy(...order)
    .limit(Math.min(opts.limit ?? 100, 200));
  return rows.map(({ t, userVotes, voted: v }) => ({
    slug: t.slug,
    name: t.name,
    tagline: t.tagline,
    description: t.description,
    category: t.category as ToolCategory,
    pricing: t.pricing,
    rating: t.rating,
    votes: t.baseVotes + Number(userVotes),
    color: t.color,
    letter: t.letter,
    url: t.url,
    runsOnVigas: t.runsOnVigas,
    isNew: t.isNew,
    voted: Boolean(v),
  }));
}

export async function getTool(db: Db, slug: string, userId?: string | null): Promise<ToolItem | null> {
  const all = await listTools(db, { userId, limit: 200 });
  return all.find((t) => t.slug === slug) ?? null;
}

/** Toggles the user's upvote. Returns the new state and count. */
export async function toggleToolVote(db: Db, slug: string, userId: string): Promise<{ voted: boolean; votes: number } | null> {
  return db.transaction(async (tx) => {
    const [tool] = await tx.select({ base: tools.baseVotes }).from(tools).where(eq(tools.slug, slug)).limit(1);
    if (!tool) return null;
    const removed = await tx
      .delete(toolVotes)
      .where(and(eq(toolVotes.toolSlug, slug), eq(toolVotes.userId, userId)))
      .returning({ s: toolVotes.toolSlug });
    if (removed.length === 0) await tx.insert(toolVotes).values({ toolSlug: slug, userId });
    const [c] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(toolVotes)
      .where(eq(toolVotes.toolSlug, slug));
    return { voted: removed.length === 0, votes: tool.base + (c?.n ?? 0) };
  });
}

export async function listToolSitemap(db: Db): Promise<Array<{ slug: string }>> {
  return db.select({ slug: tools.slug }).from(tools);
}
