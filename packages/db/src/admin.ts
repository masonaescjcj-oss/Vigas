import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import {
  articleInputSchema,
  authorInputSchema,
  readingMinutes,
  slugify,
  toolInputSchema,
  type ArticleInput,
  type AuthorInput,
  type ToolInput,
} from '@vigas/core';
import type { Db } from './client';
import { articles, authors, tools } from './schema';

/**
 * Content admin queries. Callers must check that the user is an admin first.
 * Inputs are validated here as well, so a route handler can pass request bodies straight in.
 */

export class AdminInputError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

function parse<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: Array<{ path: PropertyKey[]; message: string }> } } }, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) {
    const issue = r.error.issues[0];
    const field = issue?.path.map(String).join('.') || undefined;
    throw new AdminInputError(`${field ? `${field}: ` : ''}${issue?.message ?? 'Invalid input'}`, field);
  }
  return r.data;
}

export interface AdminArticleRow {
  slug: string;
  title: string;
  category: string;
  status: 'draft' | 'published';
  authorName: string;
  publishedAt: string;
  updatedAt: string;
}

export async function adminListArticles(
  db: Db,
  opts: { status?: 'draft' | 'published' | null; limit?: number; offset?: number } = {},
): Promise<AdminArticleRow[]> {
  const where: SQL[] = [];
  if (opts.status) where.push(eq(articles.status, opts.status));
  const rows = await db
    .select({
      slug: articles.slug,
      title: articles.title,
      category: articles.category,
      status: articles.status,
      authorName: authors.name,
      publishedAt: articles.publishedAt,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .innerJoin(authors, eq(authors.slug, articles.authorSlug))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(articles.updatedAt))
    .limit(Math.min(opts.limit ?? 50, 200))
    .offset(opts.offset ?? 0);
  return rows.map((r) => ({ ...r, publishedAt: r.publishedAt.toISOString(), updatedAt: r.updatedAt.toISOString() }));
}

/** Any article regardless of status, in the shape the editor form uses. */
export async function adminGetArticle(db: Db, slug: string) {
  const [row] = await db.select().from(articles).where(eq(articles.slug, slug)).limit(1);
  if (!row) return null;
  return {
    slug: row.slug,
    title: row.title,
    dek: row.dek,
    category: row.category,
    flag: row.flag as 'Breaking' | 'Analysis' | 'Exclusive' | null,
    authorSlug: row.authorSlug,
    status: row.status,
    body: row.body,
    cover: row.cover,
    faq: row.faq,
    mentionedModelIds: row.mentionedModelIds,
    pullQuote: row.pullQuote ?? null,
    publishedAt: row.publishedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Creates or updates an article. With `existingSlug` it updates that article (and may rename it);
 * without, it creates one, deriving the slug from the title when none is given.
 * `publishedAt` is set the first time an article is published.
 */
export async function adminSaveArticle(db: Db, input: ArticleInput, existingSlug?: string): Promise<{ slug: string }> {
  const a = parse(articleInputSchema, input);
  const [author] = await db.select({ slug: authors.slug }).from(authors).where(eq(authors.slug, a.authorSlug)).limit(1);
  if (!author) throw new AdminInputError('authorSlug: unknown author', 'authorSlug');

  const now = new Date();
  const values = {
    title: a.title,
    dek: a.dek,
    category: a.category,
    flag: a.flag,
    authorSlug: a.authorSlug,
    status: a.status,
    body: a.body,
    readingMinutes: readingMinutes(`${a.dek} ${a.body}`),
    cover: a.cover,
    faq: a.faq,
    mentionedModelIds: a.mentionedModelIds,
    pullQuote: a.pullQuote,
    updatedAt: now,
  };

  return db.transaction(async (tx) => {
    if (existingSlug) {
      const [current] = await tx.select().from(articles).where(eq(articles.slug, existingSlug)).limit(1);
      if (!current) throw new AdminInputError('Article not found');
      const slug = a.slug ?? existingSlug;
      if (slug !== existingSlug) {
        const [taken] = await tx.select({ s: articles.slug }).from(articles).where(eq(articles.slug, slug)).limit(1);
        if (taken) throw new AdminInputError('slug: already used by another article', 'slug');
      }
      const firstPublish = current.status === 'draft' && a.status === 'published';
      await tx
        .update(articles)
        .set({ ...values, slug, publishedAt: firstPublish ? now : current.publishedAt })
        .where(eq(articles.slug, existingSlug));
      return { slug };
    }
    const slug = a.slug ?? slugify(a.title);
    if (!slug) throw new AdminInputError('slug: could not derive one from the title', 'slug');
    const [taken] = await tx.select({ s: articles.slug }).from(articles).where(eq(articles.slug, slug)).limit(1);
    if (taken) throw new AdminInputError('slug: already used by another article', 'slug');
    await tx.insert(articles).values({ ...values, slug, publishedAt: now });
    return { slug };
  });
}

export async function adminDeleteArticle(db: Db, slug: string): Promise<boolean> {
  const res = await db.delete(articles).where(eq(articles.slug, slug)).returning({ slug: articles.slug });
  return res.length > 0;
}

/** Creates or updates a tool by slug. User votes are kept. */
export async function adminSaveTool(db: Db, input: ToolInput): Promise<{ slug: string }> {
  const t = parse(toolInputSchema, input);
  await db
    .insert(tools)
    .values({ ...t, baseVotes: 0 })
    .onConflictDoUpdate({ target: tools.slug, set: { ...t } });
  return { slug: t.slug };
}

export async function adminDeleteTool(db: Db, slug: string): Promise<boolean> {
  const res = await db.delete(tools).where(eq(tools.slug, slug)).returning({ slug: tools.slug });
  return res.length > 0;
}

export async function adminListAuthors(db: Db) {
  return db
    .select({
      slug: authors.slug,
      name: authors.name,
      role: authors.role,
      color: authors.color,
      articles: sql<number>`(select count(*)::int from articles a where a.author_slug = "authors"."slug")`,
    })
    .from(authors)
    .orderBy(authors.name);
}

export async function adminSaveAuthor(db: Db, input: AuthorInput): Promise<{ slug: string }> {
  const a = parse(authorInputSchema, input);
  await db.insert(authors).values(a).onConflictDoUpdate({ target: authors.slug, set: { name: a.name, role: a.role, color: a.color } });
  return { slug: a.slug };
}
