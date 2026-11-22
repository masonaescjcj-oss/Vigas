import type { PulseAuthor, PulsePost } from '../pulse';

/**
 * Preview community posts for Pulse. Timestamps are relative to the first call so "2h ago" reads
 * naturally on every surface until the community database is connected.
 */

const A: Record<string, PulseAuthor> = {
  nima: { id: 'u_nima', name: 'Nima Rahbar', handle: 'nimabuilds', color: '#E3B65C', verified: true },
  sara: { id: 'u_sara', name: 'Sara Kim', handle: 'sara.ships', color: '#9A9DFA' },
  vigas: { id: 'u_vigas', name: 'Vigas Lab', handle: 'vigas', color: '#FF6A1A', verified: true },
  omid: { id: 'u_omid', name: 'Omid Tehrani', handle: 'omid.dev', color: '#6FCF73' },
  lena: { id: 'u_lena', name: 'Lena Fischer', handle: 'lenadesigns', color: '#5DB7B0' },
  arash: { id: 'u_arash', name: 'Arash M.', handle: 'arash_ai', color: '#F07A72' },
};

type Row = Omit<PulsePost, 'createdAt' | 'liked' | 'bookmarked' | 'voted'> & { minutesAgo: number };

const ROWS: Row[] = [
  {
    id: 'p_battle_refactor',
    kind: 'battle',
    author: A.nima!,
    minutesAgo: 38,
    body: 'Same refactor prompt, blind. Fable wrote tests first — Flash shipped in a third of the time for 1/25th the price.',
    prompt: 'Refactor this 400-line Express router into typed route modules with zod validation. Keep behaviour identical and add tests.',
    modelId: 'anthropic/claude-fable-5.2',
    tags: ['coding', 'refactor'],
    likes: 412,
    remixes: 57,
    comments: 63,
    sides: [
      {
        modelId: 'anthropic/claude-fable-5.2',
        modelName: 'Claude Fable 5.2',
        org: 'Anthropic',
        excerpt: 'Split into 6 modules, generated 23 Vitest cases first, then migrated handlers one by one with a compatibility shim.',
        votes: 1284,
        latencyMs: 175,
        costMicros: 41_800,
      },
      {
        modelId: 'deepseek/v4.1-flash',
        modelName: 'DeepSeek V4.1 Flash',
        org: 'DeepSeek',
        excerpt: 'Typed routers + zod schemas in one pass, 9 tests. Missed one middleware ordering edge case on /auth.',
        votes: 731,
        latencyMs: 98,
        costMicros: 1_600,
      },
    ],
  },
  {
    id: 'p_prompt_spec',
    kind: 'prompt',
    author: A.sara!,
    minutesAgo: 95,
    body: 'My "spec → PR" recipe. Works best on Fable; on Flash drop the review step and it costs almost nothing.',
    prompt:
      'You are a staff engineer. Turn the spec below into: 1) a numbered implementation plan, 2) the file tree you will touch, 3) the diff, 4) a self-review listing risks. Ask one clarifying question only if the spec is ambiguous.\n\nSPEC:\n{{paste spec}}',
    modelId: 'anthropic/claude-fable-5.2',
    tags: ['coding', 'agents'],
    likes: 968,
    remixes: 214,
    comments: 41,
  },
  {
    id: 'p_design_landing',
    kind: 'design',
    author: A.lena!,
    minutesAgo: 160,
    body: 'Asked both for a fintech landing hero. Carbon nailed hierarchy; GPT-6 Astra went editorial. Which would you ship?',
    prompt: 'Design a landing hero for a crypto-friendly payments API. Dark theme, one accent colour, editorial typography, one CTA.',
    modelId: 'google/gemini-4-carbon',
    tags: ['design', 'ui'],
    likes: 655,
    remixes: 88,
    comments: 97,
    sides: [
      {
        modelId: 'google/gemini-4-carbon',
        modelName: 'Gemini 4 Carbon',
        org: 'Google',
        excerpt: 'Bento grid, live rate ticker, single orange CTA',
        votes: 902,
        latencyMs: 132,
        costMicros: 9_400,
        palette: ['#12110F', '#FF6A1A', '#EFEAE1', '#3A3631'],
      },
      {
        modelId: 'openai/gpt-6-astra',
        modelName: 'GPT-6 Astra',
        org: 'OpenAI',
        excerpt: 'Serif masthead, full-bleed product shot, sand accent',
        votes: 1017,
        latencyMs: 160,
        costMicros: 12_100,
        palette: ['#171614', '#E3B65C', '#FBF8F3', '#9A9DFA'],
      },
    ],
  },
  {
    id: 'p_prompt_pdf',
    kind: 'prompt',
    author: A.vigas!,
    minutesAgo: 240,
    body: 'Cheapest reliable PDF → JSON extractor we have measured: $0.0004 per invoice on DeepSeek V4.1 Flash, 99.1% field accuracy.',
    prompt:
      'Extract the invoice below into JSON with keys: vendor, invoice_number, issue_date (ISO), currency, line_items[{description, qty, unit_price}], total. Return JSON only. If a field is missing use null.\n\n{{invoice text}}',
    modelId: 'deepseek/v4.1-flash',
    tags: ['extraction', 'cost'],
    likes: 1342,
    remixes: 390,
    comments: 52,
  },
  {
    id: 'p_battle_persian',
    kind: 'battle',
    author: A.omid!,
    minutesAgo: 410,
    body: 'Persian customer-support reply, formal tone. Opus is beautiful but 8× the price — Carbon is the sweet spot for us.',
    prompt: 'یک پاسخ رسمی و همدلانه به مشتری بنویس که سفارشش دو روز دیر رسیده و درخواست بازپرداخت هزینه ارسال دارد.',
    modelId: 'google/gemini-4-carbon',
    tags: ['persian', 'support'],
    likes: 287,
    remixes: 31,
    comments: 24,
    sides: [
      {
        modelId: 'anthropic/claude-opus-5.5',
        modelName: 'Claude Opus 5.5',
        org: 'Anthropic',
        excerpt: 'مشتری گرامی، از تأخیر پیش‌آمده صمیمانه پوزش می‌طلبیم… هزینه ارسال ظرف ۲۴ ساعت بازگردانده می‌شود.',
        votes: 448,
        latencyMs: 240,
        costMicros: 18_900,
      },
      {
        modelId: 'google/gemini-4-carbon',
        modelName: 'Gemini 4 Carbon',
        org: 'Google',
        excerpt: 'با سلام و احترام، بابت تأخیر در ارسال سفارش‌تان عذرخواهی می‌کنیم و هزینه ارسال را کامل بازپرداخت می‌کنیم…',
        votes: 512,
        latencyMs: 128,
        costMicros: 2_300,
      },
    ],
  },
  {
    id: 'p_design_dashboard',
    kind: 'design',
    author: A.arash!,
    minutesAgo: 720,
    body: 'Analytics dashboard, one prompt each. Kimi went dense & data-first, Sonnet went calm & spacious.',
    prompt: 'Design a mobile analytics dashboard for API usage: spend today, requests/min, top models, alerts. Native feel.',
    modelId: 'moonshotai/kimi-k3.1-pro',
    tags: ['design', 'mobile'],
    likes: 433,
    remixes: 46,
    comments: 38,
    sides: [
      {
        modelId: 'moonshotai/kimi-k3.1-pro',
        modelName: 'Kimi K3.1 Pro',
        org: 'Moonshot',
        excerpt: 'Dense telemetry grid, sparklines, LED alerts',
        votes: 377,
        latencyMs: 150,
        costMicros: 3_100,
        palette: ['#0D0C0B', '#6FCF73', '#EFEAE1', '#2A2724'],
      },
      {
        modelId: 'anthropic/claude-sonnet-5.5',
        modelName: 'Claude Sonnet 5.5',
        org: 'Anthropic',
        excerpt: 'Calm cards, one hero number, generous spacing',
        votes: 341,
        latencyMs: 142,
        costMicros: 6_800,
        palette: ['#1C1B18', '#9A9DFA', '#FBF8F3', '#302D29'],
      },
    ],
  },
  {
    id: 'p_prompt_launch',
    kind: 'prompt',
    author: A.nima!,
    minutesAgo: 1_100,
    body: 'Launch-tweet generator that does not sound like AI. The banned-words list is the whole trick.',
    prompt:
      'Write 5 launch tweets for the product below. Rules: under 240 characters, no emojis, no hashtags, never use the words "revolutionize", "game-changer", "unleash", "seamless". One must be a single sentence.\n\nPRODUCT: {{one-line description}}',
    modelId: 'openai/gpt-6-astra',
    tags: ['writing', 'marketing'],
    likes: 721,
    remixes: 160,
    comments: 29,
  },
];

let cache: { at: number; posts: PulsePost[] } | null = null;

export function seedPulse(now = Date.now()): PulsePost[] {
  if (cache && now - cache.at < 6 * 3_600_000) return cache.posts;
  const posts = ROWS.map(({ minutesAgo, ...p }) => ({
    ...p,
    createdAt: new Date(now - minutesAgo * 60_000).toISOString(),
    liked: false,
    bookmarked: false,
    voted: null,
  }));
  cache = { at: now, posts };
  return posts;
}
