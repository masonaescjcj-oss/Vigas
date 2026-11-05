import type { Article, Author, NewsCategory } from '../app-api';
import { readingMinutes, slugify } from '../text';

/**
 * DEMO CONTENT. These stories come from the v2 design prototype and are not real reporting.
 * Replace them with original Vigas journalism before launch.
 */

export const seedAuthors: Author[] = [
  { slug: 'sara-moradi', name: 'Sara Moradi', role: 'Senior editor, models & leaderboards', color: '#E3B65C' },
  { slug: 'kian-rahimi', name: 'Kian Rahimi', role: 'Reporter, models', color: '#5DB7B0' },
  { slug: 'nima-farahani', name: 'Nima Farahani', role: 'Reporter, agents & developer tools', color: '#9A9DFA' },
  { slug: 'leila-karimi', name: 'Leila Karimi', role: 'Data editor', color: '#FF8A4C' },
  { slug: 'arman-tehrani', name: 'Arman Tehrani', role: 'Reporter, hardware & policy', color: '#6FCF73' },
];

const author = (slug: string) => seedAuthors.find((a) => a.slug === slug)!;

interface SeedStory {
  title: string;
  dek: string;
  category: NewsCategory;
  flag?: Article['flag'];
  author: string;
  minutesAgo: number;
  cover: [big: string, caption: string, color: string];
  body: string;
  faq?: Article['faq'];
  models?: string[];
  quote?: Article['pullQuote'];
}

const STORIES: SeedStory[] = [
  {
    title: 'Claude Opus 5.5 takes the top spot on agent leaderboards — by the widest margin yet',
    dek: 'Anthropic’s new flagship wins one in five real-world agent sessions on Vigas, opening a 3.5-point lead over Gemini 4 Carbon. But the price per task tells a different story.',
    category: 'Models',
    flag: 'Breaking',
    author: 'sara-moradi',
    minutesAgo: 12,
    cover: ['20%', 'WIN SHARE', '#FF6A1A'],
    models: ['anthropic/claude-opus-5.5', 'google/gemini-4-carbon', 'anthropic/claude-fable-5.1'],
    quote: { text: 'Price is the last benchmark. Once a capability is cheap enough, it stops being a feature and becomes a default.', cite: 'Vigas research note, 2026' },
    body: `Anthropic’s new flagship now wins **20.04%** of real-world agent sessions on Vigas — one in five. Across 373 million sessions, the ordering at the top of the board changed three times in a single week before settling.

The gap matters more than the rank. A 3.5-point lead over Gemini 4 Carbon is the widest the overall board has recorded, and it held across coding, research and web tasks.

## What changed

Three things moved at once: longer agent horizons, cheaper serving and a wave of open-weight releases. Each alone would have reshuffled the rankings; together they compressed a year of progress into a quarter.

## Best isn’t cheapest

At $6.82 per completed task, Opus 5.5 costs eleven times as much as Claude Fable 5.1, which wins 13.15% of sessions at $0.61. For many teams, the second number is the one that matters.

## What it means for builders

Keep your provider a configuration, not an architecture. Route by task, measure cost per completed task rather than per token, and revisit the board monthly — the frontier now moves faster than most release cycles.`,
    faq: [
      { q: 'Which AI model is best for agents right now?', a: 'On the Vigas overall agent board, Claude Opus 5.5 leads with a 20.04% win share, followed by Gemini 4 Carbon at 16.56%.' },
      { q: 'How much does Claude Opus 5.5 cost through Vigas?', a: '$15 per million input tokens and $75 per million output tokens — about $6.82 per completed agent task on average.' },
      { q: 'How are these rankings measured?', a: 'From real sessions and blind pairwise votes on Vigas, scored with 95% confidence intervals. See the methodology on the leaderboard page.' },
    ],
  },
  {
    title: 'Gemini 4 Carbon ships with native computer use across Android',
    dek: 'Google’s agent can now operate any app on 3 billion devices.',
    category: 'Models',
    author: 'kian-rahimi',
    minutesAgo: 48,
    cover: ['3B', 'DEVICES', '#5B8FD6'],
    models: ['google/gemini-4-carbon'],
    body: `Gemini 4 Carbon can now tap, type and scroll inside any Android app on a user’s behalf, without app-specific integrations.

On Vigas, Carbon is the second-ranked agent overall at 16.56% win share, and the cheapest model in the top three at $1.73 per task.`,
  },
  {
    title: 'OpenAI splits GPT-6.1 into Sol and Terra. What the two tiers mean for developers',
    dek: 'A premium reasoning tier and a cheap workhorse, priced 6× apart.',
    category: 'Agents',
    author: 'nima-farahani',
    minutesAgo: 60,
    cover: ['6×', 'PRICE GAP', '#6FCF73'],
    models: ['openai/gpt-6.1-sol', 'openai/gpt-6.1-terra'],
    body: `Sol targets long reasoning chains; Terra is built for volume. The price gap between them is roughly six to one.

For most production traffic, the practical move is routing: send routine requests to Terra and escalate only the hard ones to Sol.`,
  },
  {
    title: 'Inference prices fell 38% this quarter. Here’s who is cutting deepest',
    dek: 'Our router data shows open-weight hosts driving the steepest declines.',
    category: 'Analysis',
    flag: 'Analysis',
    author: 'leila-karimi',
    minutesAgo: 120,
    cover: ['−38%', 'QOQ', '#FF6A1A'],
    models: ['deepseek/v4.1-flash', 'google/gemini-4-argon'],
    body: `Blended prices across the Vigas router fell 38% quarter on quarter. The steepest cuts came from hosts serving open-weight models, which now set the floor for the whole market.

Closed frontier models held their list prices, but their cheaper tiers fell fastest.`,
  },
  {
    title: 'NVIDIA’s Nemotron 3.5 Super brings open weights within striking distance of the frontier',
    dek: 'Free to use, 128K context and a top-15 agent score.',
    category: 'Models',
    author: 'kian-rahimi',
    minutesAgo: 180,
    cover: ['$0', 'PER TOKEN', '#76B900'],
    models: ['nvidia/nemotron-3.5-super'],
    body: `Nemotron 3.5 Super is free on Vigas and sits inside the top 15 of the agent board. For prototypes and internal tools, that makes it the default starting point.`,
  },
  {
    title: 'EU AI Act enforcement begins: the first notices, and what they target',
    dek: 'Regulators start with transparency duties for general-purpose models.',
    category: 'Policy',
    author: 'sara-moradi',
    minutesAgo: 240,
    cover: ['EU', 'AI ACT', '#9A9DFA'],
    body: `The first enforcement notices focus on documentation and transparency duties for providers of general-purpose models, rather than on banned uses.`,
  },
  {
    title: 'Kimi K3.1 Pro debuts at #9 in WebDev — the strongest showing yet from Moonshot',
    dek: 'Inside the lab’s bet on long-horizon coding agents.',
    category: 'Models',
    flag: 'Exclusive',
    author: 'nima-farahani',
    minutesAgo: 300,
    cover: ['#9', 'WEBDEV', '#5DB7B0'],
    models: ['moonshotai/kimi-k3.1-pro'],
    body: `Kimi K3.1 Pro entered the WebDev board at ninth place, at $0.31 per task — a fraction of the models around it.`,
  },
  {
    title: 'The 2nm ramp, explained: why AI chips will stay scarce through 2027',
    dek: 'Packaging, not lithography, is the real bottleneck.',
    category: 'Hardware',
    author: 'arman-tehrani',
    minutesAgo: 360,
    cover: ['2nm', 'NODE', '#5DB7B0'],
    body: `Wafer output is rising, but advanced packaging capacity is not keeping pace — and that is what limits how many accelerators ship.`,
  },
  {
    title: 'Agent startups raised $41B in Q3 — more than all of 2024',
    dek: 'Coding and customer-ops agents took 60% of the money.',
    category: 'Funding',
    author: 'leila-karimi',
    minutesAgo: 480,
    cover: ['$41B', 'Q3 RAISED', '#E3B65C'],
    body: `Funding for agent companies passed the full-year 2024 total in a single quarter, concentrated in coding and customer operations.`,
  },
  {
    title: 'The 12 AI tools builders upvoted most in October',
    dek: 'Coding agents and voice tools dominate the month — here is what each one is actually good at.',
    category: 'Tools',
    author: 'nima-farahani',
    minutesAgo: 840,
    cover: ['12', 'TOOLS', '#5DB7B0'],
    body: `Coding agents and voice tools took most of October’s upvotes in the Vigas directory. See the full list on the Tools page.`,
  },
  {
    title: 'Inside the race to build a 10-gigawatt data center',
    dek: 'Power, not GPUs, now decides who trains the next frontier model.',
    category: 'Analysis',
    flag: 'Analysis',
    author: 'sara-moradi',
    minutesAgo: 720,
    cover: ['10GW', 'POWER', '#F07A72'],
    body: `The binding constraint for the next generation of training runs is grid capacity. Sites are now chosen for power first and fibre second.`,
  },
  {
    title: 'DeepSeek V4.1 Flash: cheap, fast — and suddenly everywhere',
    dek: 'At $0.07 per million input tokens, it now handles 9% of all Vigas traffic.',
    category: 'Models',
    author: 'kian-rahimi',
    minutesAgo: 1440,
    cover: ['9%', 'OF TRAFFIC', '#9A9DFA'],
    models: ['deepseek/v4.1-flash'],
    body: `DeepSeek V4.1 Flash now serves 9% of all requests on the Vigas router, driven by its price: $0.07 per million input tokens.`,
  },
];

/** Articles with timestamps relative to `now` (newest first). */
export function seedArticles(now: Date = new Date()): Article[] {
  return STORIES.map((s) => {
    const published = new Date(now.getTime() - s.minutesAgo * 60_000);
    return {
      slug: slugify(s.title),
      title: s.title,
      dek: s.dek,
      category: s.category,
      flag: s.flag ?? null,
      author: author(s.author),
      publishedAt: published.toISOString(),
      updatedAt: published.toISOString(),
      readingMinutes: readingMinutes(`${s.dek} ${s.body}`),
      cover: { big: s.cover[0], caption: s.cover[1], color: s.cover[2] },
      body: s.body,
      faq: s.faq ?? [],
      mentionedModelIds: s.models ?? [],
      pullQuote: s.quote ?? null,
    };
  }).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
