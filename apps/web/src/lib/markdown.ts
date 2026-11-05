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
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[’'"]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'section'
  );
}

function createMarked(opts: { headingIds: boolean }): Marked {
  const m = new Marked({ gfm: true, breaks: false });
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
        const id = opts.headingIds ? ` id="${headingId(text)}"` : '';
        return `<h${level}${id}>${inner}</h${level}>\n`;
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
  const m = createMarked({ headingIds: true });
  const tokens = m.lexer(src);
  const groups: Array<{ heading: Tokens.Heading | null; tokens: Token[] }> = [{ heading: null, tokens: [] }];
  for (const t of tokens) {
    if (t.type === 'heading' && (t as Tokens.Heading).depth === 2) groups.push({ heading: t as Tokens.Heading, tokens: [t] });
    else groups[groups.length - 1]!.tokens.push(t);
  }
  return groups
    .filter((g) => g.tokens.length > 0)
    .map((g) => {
      const list = Object.assign(g.tokens, { links: tokens.links }) as TokensList;
      return {
        heading: g.heading ? { id: headingId(g.heading.text), text: g.heading.text } : null,
        html: m.parser(list),
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
