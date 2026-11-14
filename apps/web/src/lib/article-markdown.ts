import { NEWS_CATEGORIES, readingMinutes, slugify, type Article, type Author, type Cover, type FaqItem, type NewsCategory } from '@vigas/core';
import { seedAuthors } from '@vigas/core/seed';

export interface ParsedArticleMarkdown {
  slug: string;
  title: string;
  dek: string;
  category: NewsCategory;
  flag: Article['flag'];
  authorSlug: string;
  author: Author;
  status: 'draft' | 'published';
  publishedAt: string;
  updatedAt: string;
  cover: Cover;
  faq: FaqItem[];
  mentionedModelIds: string[];
  pullQuote: { text: string; cite: string } | null;
  body: string;
}

const DEFAULT_COVER_COLOR: Record<NewsCategory, string> = {
  Models: '#FF6A1A',
  Agents: '#6FCF73',
  Analysis: '#E3B65C',
  Policy: '#9A9DFA',
  Hardware: '#5DB7B0',
  Funding: '#E3B65C',
  Tools: '#5DB7B0',
};

const DEFAULT_AUTHOR: Author = seedAuthors[0] ?? {
  slug: 'vigas-editorial',
  name: 'Vigas Editorial',
  role: 'Editorial desk',
  color: '#E3B65C',
};

function stripQuotes(v: string): string {
  const s = v.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n');
  }
  return s;
}

function tryJson(v: string): unknown {
  const s = v.trim();
  if (!(s.startsWith('[') || s.startsWith('{'))) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

function parseFrontmatterBlock(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim() || line.trim().startsWith('#')) {
      i += 1;
      continue;
    }
    const m = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (!m) {
      i += 1;
      continue;
    }
    const key = m[1]!;
    const rest = m[2] ?? '';

    if (rest.trim() === '|' || rest.trim() === '>') {
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && (/^\s+/.test(lines[i]!) || lines[i] === '')) {
        buf.push(lines[i]!.replace(/^ {2}/, ''));
        i += 1;
      }
      result[key] = buf.join(rest.trim() === '|' ? '\n' : ' ').trim();
      continue;
    }

    if (rest.trim() === '') {
      // Collect nested map or YAML list
      const childLines: string[] = [];
      i += 1;
      while (i < lines.length && (/^\s+/.test(lines[i]!) || lines[i]!.trim() === '')) {
        if (lines[i]!.trim()) childLines.push(lines[i]!);
        i += 1;
      }
      if (childLines.some((l) => /^\s*-\s+/.test(l))) {
        const items: unknown[] = [];
        let curObj: Record<string, string> | null = null;
        for (const cl of childLines) {
          const itemMatch = /^\s*-\s+(.*)$/.exec(cl);
          if (itemMatch) {
            const payload = itemMatch[1]!.trim();
            const kv = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(payload);
            if (kv) {
              if (curObj) items.push(curObj);
              curObj = { [kv[1]!]: stripQuotes(kv[2] ?? '') };
            } else {
              if (curObj) {
                items.push(curObj);
                curObj = null;
              }
              items.push(stripQuotes(payload));
            }
          } else if (curObj) {
            const kv = /^\s*([A-Za-z0-9_]+):\s*(.*)$/.exec(cl);
            if (kv) curObj[kv[1]!] = stripQuotes(kv[2] ?? '');
          }
        }
        if (curObj) items.push(curObj);
        result[key] = items;
      } else {
        const obj: Record<string, string> = {};
        for (const cl of childLines) {
          const kv = /^\s*([A-Za-z0-9_]+):\s*(.*)$/.exec(cl);
          if (kv) obj[kv[1]!] = stripQuotes(kv[2] ?? '');
        }
        result[key] = obj;
      }
      continue;
    }

    const jsonVal = tryJson(rest);
    if (jsonVal !== undefined) {
      result[key] = jsonVal;
    } else {
      const cleaned = stripQuotes(rest);
      result[key] = cleaned === 'null' ? null : cleaned;
    }
    i += 1;
  }

  return result;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function normalizeCategory(raw: string): NewsCategory {
  const found = NEWS_CATEGORIES.find((c) => c.toLowerCase() === raw.trim().toLowerCase());
  return found ?? 'Models';
}

function normalizeFlag(raw: unknown): Article['flag'] {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase();
  if (s === 'breaking') return 'Breaking';
  if (s === 'analysis') return 'Analysis';
  if (s === 'exclusive') return 'Exclusive';
  return null;
}

function normalizeIso(raw: unknown, fallbackIso: string): string {
  if (typeof raw !== 'string' || !raw.trim()) return fallbackIso;
  const parsed = new Date(raw.trim());
  return Number.isNaN(parsed.getTime()) ? fallbackIso : parsed.toISOString();
}

function isHexColor(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

/**
 * Parses a Markdown article with optional YAML-style frontmatter into a full Vigas article record.
 * Works in both Node.js (`content/articles/*.md`) and the browser (`/admin` editor `.md` import).
 */
export function parseArticleMarkdown(rawSource: string, opts: { fallbackSlug?: string; fallbackIso?: string } = {}): ParsedArticleMarkdown | null {
  const fallbackIso = opts.fallbackIso ?? new Date().toISOString();
  const normalized = rawSource.replace(/\r\n/g, '\n');
  const fmMatch = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(normalized);

  const meta = fmMatch ? parseFrontmatterBlock(fmMatch[1] ?? '') : {};
  let body = (fmMatch ? fmMatch[2] ?? '' : normalized).trim();

  let title = str(meta.title);
  if (!title) {
    const h1 = /^#\s+(.+)$/m.exec(body);
    if (h1) {
      title = h1[1]!.trim();
      body = body.replace(/^#\s+.+\n?/, '').trim();
    }
  }
  if (!title) return null;

  const category = normalizeCategory(str(meta.category) || 'Models');
  const slug = slugify(str(meta.slug) || opts.fallbackSlug || title) || 'article';
  const rawDek = str(meta.dek) || str(meta.description) || body.split(/\n{2,}/)[0]?.replace(/[#>*_`]/g, '').trim().slice(0, 200) || title;
  const dek = rawDek.slice(0, 400);

  const authorSlugInput = str(meta.authorSlug) || str(meta.author);
  const knownAuthor = seedAuthors.find(
    (a) => a.slug === authorSlugInput || a.name.toLowerCase() === authorSlugInput.toLowerCase(),
  );
  const author: Author = knownAuthor
    ? knownAuthor
    : authorSlugInput || str(meta.authorName)
      ? {
          slug: slugify(authorSlugInput || str(meta.authorName)) || DEFAULT_AUTHOR.slug,
          name: str(meta.authorName) || authorSlugInput || DEFAULT_AUTHOR.name,
          role: str(meta.authorRole) || 'Contributor, Vigas',
          color: isHexColor(str(meta.authorColor)) ? str(meta.authorColor) : DEFAULT_AUTHOR.color,
        }
      : DEFAULT_AUTHOR;

  const coverObj = typeof meta.cover === 'object' && meta.cover !== null ? (meta.cover as Record<string, unknown>) : {};
  const coverBig = (str(meta.coverBig) || str(coverObj.big) || category.slice(0, 4).toUpperCase()).slice(0, 8);
  const coverCaption = (str(meta.coverCaption) || str(coverObj.caption) || category.toUpperCase()).toUpperCase().slice(0, 24);
  const rawCoverColor = str(meta.coverColor) || str(coverObj.color);
  const cover: Cover = {
    big: coverBig,
    caption: coverCaption,
    color: isHexColor(rawCoverColor) ? rawCoverColor : DEFAULT_COVER_COLOR[category],
  };

  const faq: FaqItem[] = Array.isArray(meta.faq)
    ? meta.faq
        .map((item) => {
          if (typeof item !== 'object' || item === null) return null;
          const r = item as Record<string, unknown>;
          const q = str(r.q);
          const a = str(r.a);
          return q && a ? { q, a } : null;
        })
        .filter((x): x is FaqItem => Boolean(x))
        .slice(0, 12)
    : [];

  const mentionedModelIds = Array.isArray(meta.mentionedModelIds)
    ? meta.mentionedModelIds.map((x) => str(x)).filter(Boolean).slice(0, 12)
    : Array.isArray(meta.models)
      ? meta.models.map((x) => str(x)).filter(Boolean).slice(0, 12)
      : [];

  const pqObj = typeof meta.pullQuote === 'object' && meta.pullQuote !== null ? (meta.pullQuote as Record<string, unknown>) : {};
  const pqText = str(meta.pullQuoteText) || str(pqObj.text);
  const pqCite = str(meta.pullQuoteCite) || str(pqObj.cite) || 'Vigas note';
  const pullQuote = pqText ? { text: pqText, cite: pqCite } : null;

  const status = str(meta.status).toLowerCase() === 'draft' ? 'draft' : 'published';
  const publishedAt = normalizeIso(meta.publishedAt, fallbackIso);
  const updatedAt = normalizeIso(meta.updatedAt, publishedAt);

  return {
    slug,
    title,
    dek,
    category,
    flag: normalizeFlag(meta.flag),
    authorSlug: author.slug,
    author,
    status,
    publishedAt,
    updatedAt,
    cover,
    faq,
    mentionedModelIds,
    pullQuote,
    body,
  };
}

export function parsedToArticle(parsed: ParsedArticleMarkdown): Article {
  return {
    slug: parsed.slug,
    title: parsed.title,
    dek: parsed.dek,
    category: parsed.category,
    flag: parsed.flag,
    author: parsed.author,
    publishedAt: parsed.publishedAt,
    updatedAt: parsed.updatedAt,
    readingMinutes: readingMinutes(`${parsed.dek} ${parsed.body}`),
    cover: parsed.cover,
    body: parsed.body,
    faq: parsed.faq,
    mentionedModelIds: parsed.mentionedModelIds,
    pullQuote: parsed.pullQuote,
  };
}

function yamlQuote(v: string): string {
  return JSON.stringify(v);
}

/** Exports an article into the same Markdown + YAML frontmatter format used by `content/articles/*.md`. */
export function serializeArticleMarkdown(a: {
  slug?: string;
  title: string;
  dek: string;
  category: string;
  flag: string | null;
  authorSlug: string;
  status: string;
  publishedAt?: string;
  updatedAt?: string;
  cover: Cover;
  faq: FaqItem[];
  mentionedModelIds: string[];
  pullQuote: { text: string; cite: string } | null;
  body: string;
}): string {
  const lines = [
    '---',
    `title: ${yamlQuote(a.title)}`,
    ...(a.slug ? [`slug: ${yamlQuote(a.slug)}`] : []),
    `dek: ${yamlQuote(a.dek)}`,
    `category: ${yamlQuote(a.category)}`,
    `flag: ${a.flag ? yamlQuote(a.flag) : 'null'}`,
    `authorSlug: ${yamlQuote(a.authorSlug)}`,
    `status: ${yamlQuote(a.status)}`,
    ...(a.publishedAt ? [`publishedAt: ${yamlQuote(a.publishedAt)}`] : []),
    ...(a.updatedAt ? [`updatedAt: ${yamlQuote(a.updatedAt)}`] : []),
    `cover: ${JSON.stringify(a.cover)}`,
    ...(a.mentionedModelIds.length ? [`mentionedModelIds: ${JSON.stringify(a.mentionedModelIds)}`] : []),
    ...(a.pullQuote?.text ? [`pullQuote: ${JSON.stringify(a.pullQuote)}`] : []),
    ...(a.faq.length ? [`faq: ${JSON.stringify(a.faq)}`] : []),
    '---',
    '',
    a.body.trim(),
    '',
  ];
  return lines.join('\n');
}
