import fs from 'node:fs';
import path from 'node:path';
import type { Article } from '@vigas/core';
import { parseArticleMarkdown, parsedToArticle } from './article-markdown';

function resolveArticlesDir(): string | null {
  const cwd = process.cwd();
  const candidates = [
    path.join(/*turbopackIgnore: true*/ cwd, 'content', 'articles'),
    path.resolve(/*turbopackIgnore: true*/ cwd, '..', 'content', 'articles'),
    path.resolve(/*turbopackIgnore: true*/ cwd, '..', '..', 'content', 'articles'),
  ];
  for (const dir of candidates) {
    try {
      if (fs.existsSync(/*turbopackIgnore: true*/ dir) && fs.statSync(/*turbopackIgnore: true*/ dir).isDirectory()) {
        return dir;
      }
    } catch {
      // Try next candidate
    }
  }
  return null;
}

/**
 * Loads all published Markdown articles from `content/articles/*.md` at the repository root.
 * Files prefixed with `_` (such as `_template.md`) and `README.md` are skipped, as are `status: draft` files.
 */
export function loadLocalArticles(): Article[] {
  const dir = resolveArticlesDir();
  if (!dir) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(/*turbopackIgnore: true*/ dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const out: Article[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (!name.endsWith('.md') || name.startsWith('_') || name.toUpperCase() === 'README.MD') continue;

    const fullPath = path.join(/*turbopackIgnore: true*/ dir, name);
    let raw: string;
    let stat: fs.Stats;
    try {
      stat = fs.statSync(/*turbopackIgnore: true*/ fullPath);
      raw = fs.readFileSync(/*turbopackIgnore: true*/ fullPath, 'utf8');
    } catch {
      continue;
    }

    const fallbackSlug = name.replace(/\.md$/i, '');
    const parsed = parseArticleMarkdown(raw, {
      fallbackSlug,
      fallbackIso: stat.mtime.toISOString(),
    });
    if (!parsed || parsed.status === 'draft') continue;
    out.push(parsedToArticle(parsed));
  }

  return out.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
