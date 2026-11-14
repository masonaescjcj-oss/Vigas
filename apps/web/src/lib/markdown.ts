import { Marked, type Token, type Tokens, type TokensList } from 'marked';

/**
 * Markdown rendering shared by articles (server) and chat answers (browser). Raw HTML is escaped,
 * links are limited to http(s), mailto and relative URLs, and images render as links, so model
 * output and article bodies cannot inject markup or scripts.
 */

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]!);

function safeHref(href: string | null | undefined): string | null {
  if (!href) return null;
  const h = href.trim();
  if (/^(https?:|mailto:)/i.test(h)) return h;
  if (/^[/#?]/.test(h) && !h.startsWith('//')) return h;
  return null;
}

export function headingId(text: string): string {
  return (
    text
      .normalize('NFC')
      .replace(/[\u0300-\u036f\u064b-\u0652\u0670]/g, '')
      .toLowerCase()
      .replace(/[’'"«»]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'section'
  );
}

function makeIdAllocator() {
  const counts = new Map<string, number>();
  return (text: string): string => {
    const base = headingId(text);
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };
}

function createMarked(opts: { headingIds: boolean; allocId?: (text: string) => string; onH2?: (id: string) => void }): Marked {
  const m = new Marked({ gfm: true, breaks: false });
  const alloc = opts.allocId ?? headingId;
  m.use({
    renderer: {
      html({ text }: Tokens.HTML | Tokens.Tag) {
        return escapeHtml(text);
      },
      link({ href, title, tokens }: Tokens.Link) {
        const text = this.parser.parseInline(tokens);
        const safe = safeHref(href);
        if (!safe) return text;
        const external = /^https?:/i.test(safe);
        const t = title ? ` title="${escapeHtml(title)}"` : '';
        const rel = external ? ' rel="noopener noreferrer nofollow" target="_blank"' : '';
        return `<a href="${escapeHtml(safe)}"${t}${rel}>${text}</a>`;
      },
      image({ href, text }: Tokens.Image) {
        const safe = safeHref(href);
        const label = escapeHtml(text || 'image');
        return safe && /^https?:/i.test(safe)
          ? `<a href="${escapeHtml(safe)}" rel="noopener noreferrer nofollow" target="_blank">[${label}]</a>`
          : `[${label}]`;
      },
      heading({ tokens, depth, text }: Tokens.Heading) {
        const inner = this.parser.parseInline(tokens);
        const level = Math.min(6, Math.max(2, depth));
        if (!opts.headingIds) return `<h${level}>${inner}</h${level}>\n`;
        const id = alloc(text);
        if (depth === 2) opts.onH2?.(id);
        return `<h${level} id="${id}">${inner}</h${level}>\n`;
      },
    },
  });
  return m;
}

let chatMarked: Marked | undefined;

/** Chat answers: GitHub-flavoured markdown to safe HTML. */
export function renderChatMarkdown(src: string): string {
  chatMarked ??= createMarked({ headingIds: false });
  return chatMarked.parse(src, { async: false });
}

export interface ArticleSection {
  /** Present for sections that start with an `##` heading. */
  heading: { id: string; text: string } | null;
  html: string;
}

/** Splits an article body at its `##` headings so the page can place figures between sections. */
export function renderArticleSections(src: string): ArticleSection[] {
  const alloc = makeIdAllocator();
  let currentH2Id: string | null = null;
  const m = createMarked({
    headingIds: true,
    allocId: alloc,
    onH2: (id) => {
      if (!currentH2Id) currentH2Id = id;
    },
  });
  const tokens = m.lexer(src);
  const groups: Array<{ heading: Tokens.Heading | null; tokens: Token[] }> = [{ heading: null, tokens: [] }];
  for (const t of tokens) {
    if (t.type === 'heading' && (t as Tokens.Heading).depth === 2) groups.push({ heading: t as Tokens.Heading, tokens: [t] });
    else groups[groups.length - 1]!.tokens.push(t);
  }
  return groups
    .filter((g) => g.tokens.length > 0)
    .map((g) => {
      currentH2Id = null;
      const list = Object.assign(g.tokens, { links: tokens.links }) as TokensList;
      const html = m.parser(list);
      return {
        heading: g.heading ? { id: currentH2Id ?? alloc(g.heading.text), text: g.heading.text } : null,
        html,
      };
    });
}

/** Plain text of a markdown string (for descriptions and structured data). */
export function markdownToText(src: string): string {
  return src
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
