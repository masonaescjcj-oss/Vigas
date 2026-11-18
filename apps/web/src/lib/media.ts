/**
 * Static media and bilingual alternate resolvers.
 * Ensures every article, tool, and model org renders verified local artwork even when
 * database rows omit optional image/icon columns.
 */

const ARTICLE_IMAGES: Record<string, string> = {
  'arena-ai-interaction-as-a-judge-claude-fable-5-2': '/news/arena-eval.webp',
  'fa-arena-ai-interaction-as-a-judge': '/news/arena-eval.webp',
  'anthropic-nasdaq-ipo-roadshow-64b': '/news/anthropic-ipo.webp',
  'fa-anthropic-nasdaq-ipo-roadshow': '/news/anthropic-ipo.webp',
  'google-gemini-4-carbon-hydrogen-gemini-2-5-shutdown': '/news/gemini-4.webp',
  'fa-google-gemini-4-carbon-hydrogen': '/news/gemini-4.webp',
  'sf-frontier-ai-safety-lawsuit-five-labs': '/news/ai-safety-court.webp',
  'fa-sf-frontier-ai-safety-lawsuit': '/news/ai-safety-court.webp',
  'open-coding-agents-deepseek-dsh-opencode-cncf': '/news/open-coding-agents.webp',
  'fa-open-coding-agents-dsh-opencode': '/news/open-coding-agents.webp',
  'router-unit-economics-task-cost-vs-arena': '/news/token-economics.webp',
  'fa-router-unit-economics-cost-vs-arena': '/news/token-economics.webp',
  'inference-chips-hbm-memory-bandwidth-token-drop': '/news/inference-silicon.webp',
  'fa-inference-chips-hbm-memory-drop': '/news/inference-silicon.webp',
  'coding-editors-byok-cursor-cline-opencode': '/news/ai-coding-tools-2026.webp',
  'fa-coding-editors-byok-cursor-cline-opencode': '/news/ai-coding-tools-2026.webp',
};

export function articleImageUrl(slug: string, explicitUrl?: string | null): string {
  const clean = explicitUrl?.trim();
  if (clean) return clean;
  if (ARTICLE_IMAGES[slug]) return ARTICLE_IMAGES[slug]!;
  if (/anthropic|ipo|funding/i.test(slug)) return '/news/anthropic-ipo.webp';
  if (/gemini|carbon|hydrogen/i.test(slug)) return '/news/gemini-4.webp';
  if (/lawsuit|policy|safety/i.test(slug)) return '/news/ai-safety-court.webp';
  if (/hardware|chip|silicon|hbm/i.test(slug)) return '/news/inference-silicon.webp';
  if (/economics|unit-cost|pareto|analysis/i.test(slug)) return '/news/token-economics.webp';
  if (/byok|editor|tools/i.test(slug)) return '/news/ai-coding-tools-2026.webp';
  if (/opencode|coding|deepseek|agent/i.test(slug)) return '/news/open-coding-agents.webp';
  return '/news/arena-eval.webp';
}

const KNOWN_TOOL_SLUGS = new Set([
  'bolt-new',
  'claude-code',
  'cline',
  'cursor',
  'elevenlabs',
  'gamma',
  'google-ai-studio',
  'goose',
  'granola',
  'heygen',
  'higgsfield',
  'kilo-code',
  'kling-ai',
  'lovable',
  'manus',
  'midjourney',
  'notebooklm',
  'openai-codex',
  'opencode',
  'perplexity',
  'runway',
  'suno',
  'v0',
  'windsurf',
]);

export function toolIconUrl(slug: string, explicitUrl?: string | null): string | null {
  const clean = explicitUrl?.trim();
  if (clean) return clean;
  return KNOWN_TOOL_SLUGS.has(slug) ? `/tools/icons/${slug}.png` : null;
}

export function toolImageUrl(slug: string, explicitUrl?: string | null): string | null {
  const clean = explicitUrl?.trim();
  if (clean && !clean.endsWith('.svg')) return clean;
  return KNOWN_TOOL_SLUGS.has(slug) ? `/tools/${slug}.webp` : null;
}

const ORG_ICONS: Record<string, string> = {
  anthropic: '/orgs/anthropic.png',
  openai: '/orgs/openai.png',
  google: '/orgs/google.png',
  deepseek: '/orgs/deepseek.png',
  alibaba: '/orgs/alibaba.png',
  qwen: '/orgs/alibaba.png',
  meta: '/orgs/meta.png',
  nvidia: '/orgs/nvidia.png',
  xai: '/orgs/xai.png',
  moonshot: '/orgs/moonshot.png',
  xiaomi: '/orgs/xiaomi.png',
  'z.ai': '/orgs/z-ai.png',
  zai: '/orgs/z-ai.png',
  mistral: '/orgs/mistral.png',
  microsoft: '/orgs/microsoft.png',
  minimax: '/orgs/minimax.png',
  spacexai: '/orgs/spacexai.png',
};

export function orgIconUrl(org: string): string | null {
  return ORG_ICONS[org.trim().toLowerCase()] ?? null;
}

const ARTICLE_PAIRS: Array<[en: string, fa: string]> = [
  ['arena-ai-interaction-as-a-judge-claude-fable-5-2', 'fa-arena-ai-interaction-as-a-judge'],
  ['anthropic-nasdaq-ipo-roadshow-64b', 'fa-anthropic-nasdaq-ipo-roadshow'],
  ['google-gemini-4-carbon-hydrogen-gemini-2-5-shutdown', 'fa-google-gemini-4-carbon-hydrogen'],
  ['sf-frontier-ai-safety-lawsuit-five-labs', 'fa-sf-frontier-ai-safety-lawsuit'],
  ['open-coding-agents-deepseek-dsh-opencode-cncf', 'fa-open-coding-agents-dsh-opencode'],
  ['router-unit-economics-task-cost-vs-arena', 'fa-router-unit-economics-cost-vs-arena'],
  ['inference-chips-hbm-memory-bandwidth-token-drop', 'fa-inference-chips-hbm-memory-drop'],
  ['coding-editors-byok-cursor-cline-opencode', 'fa-coding-editors-byok-cursor-cline-opencode'],
];

export const ARTICLE_ALTERNATES: Record<string, { en: string; fa: string }> = Object.fromEntries(
  ARTICLE_PAIRS.flatMap(([en, fa]) => [
    [en, { en, fa }],
    [fa, { en, fa }],
  ]),
);

export function getArticleAlternate(slug: string): { slug: string; lang: 'en' | 'fa'; label: string } | null {
  const pair = ARTICLE_ALTERNATES[slug];
  if (!pair) return null;
  if (pair.en === slug) return { slug: pair.fa, lang: 'fa', label: 'نسخه فارسی' };
  return { slug: pair.en, lang: 'en', label: 'English version' };
}
