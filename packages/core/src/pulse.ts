import { z } from 'zod';

/**
 * Pulse — the Vigas community feed. Builders share prompt recipes, blind model battles and
 * side-by-side design comparisons. Every post links back to a model on the Vigas API so the feed
 * doubles as a live catalogue of "what to run, on which model, for how much".
 */

export type PulsePostKind = 'prompt' | 'battle' | 'design';
export const PULSE_KINDS: readonly PulsePostKind[] = ['prompt', 'battle', 'design'];

export type PulseSort = 'hot' | 'new';

export interface PulseAuthor {
  id: string;
  name: string;
  handle: string;
  /** Monogram accent (`#RRGGBB`). */
  color: string;
  /** Vigas staff / verified builder. */
  verified?: boolean;
}

/** One side of a battle or design comparison. */
export interface PulseSide {
  modelId: string;
  modelName: string;
  org: string;
  /** Short excerpt of the answer (battles) or a one-line description of the design. */
  excerpt: string;
  votes: number;
  /** Measured latency to first token, ms. */
  latencyMs?: number;
  /** What this run cost through the Vigas API, in micro-dollars. */
  costMicros?: number;
  /** Design comparisons: palette swatches that render the typographic thumbnail. */
  palette?: string[];
}

export interface PulsePost {
  id: string;
  kind: PulsePostKind;
  author: PulseAuthor;
  /** ISO timestamp. */
  createdAt: string;
  /** Caption above the payload. */
  body: string;
  /** The prompt (all kinds have one: it's what "Run in Chat" and "API code" use). */
  prompt: string;
  /** Model the prompt is tuned for (prompt posts) — `vigas/auto` when unspecified. */
  modelId: string;
  tags: string[];
  likes: number;
  remixes: number;
  comments: number;
  /** Battles and designs: exactly two sides, A then B. */
  sides?: [PulseSide, PulseSide];
  /** Per-viewer state. */
  liked?: boolean;
  bookmarked?: boolean;
  voted?: 'a' | 'b' | null;
}

export interface PulseFeedResponse {
  items: PulsePost[];
  /** True when posts are served from the bundled preview set (no community database yet). */
  preview: boolean;
}

export type PulseReaction = { action: 'like' | 'unlike' } | { action: 'vote'; side: 'a' | 'b' };

export interface PulseReactionResponse {
  id: string;
  likes: number;
  liked: boolean;
  voted: 'a' | 'b' | null;
  votes: [number, number] | null;
}

const text = (max: number, msg: string) => z.string().trim().min(1, msg).max(max, `At most ${max.toLocaleString('en-US')} characters.`);
const modelId = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9-]+\/[a-z0-9._-]+$/, 'Pick a model from the Vigas catalogue.');

/** What a client may submit when creating a post. Sides only carry the model; votes start at zero. */
export const pulseDraftSchema = z
  .object({
    kind: z.enum(['prompt', 'battle', 'design']),
    body: z.string().trim().max(280, 'Captions are at most 280 characters.').default(''),
    prompt: text(4000, 'Write the prompt first.'),
    modelId: modelId.default('vigas/auto'),
    tags: z.array(z.string().trim().min(1).max(24)).max(4).default([]),
    sides: z
      .array(z.object({ modelId, excerpt: z.string().trim().max(600).default('') }))
      .length(2)
      .optional(),
  })
  .superRefine((d, ctx) => {
    if (d.kind !== 'prompt' && !d.sides) {
      ctx.addIssue({ code: 'custom', path: ['sides'], message: 'Battles and designs compare exactly two models.' });
    }
    if (d.sides && d.sides[0]?.modelId === d.sides[1]?.modelId) {
      ctx.addIssue({ code: 'custom', path: ['sides'], message: 'Pick two different models.' });
    }
  });

export type PulseDraft = z.input<typeof pulseDraftSchema>;

export const pulseReactionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['like', 'unlike']) }),
  z.object({ action: z.literal('vote'), side: z.enum(['a', 'b']) }),
]);

/** Vote share of each side, in whole percent that always sum to 100 (or `[50, 50]` with no votes). */
export function voteShare(sides: readonly [Pick<PulseSide, 'votes'>, Pick<PulseSide, 'votes'>]): [number, number] {
  const a = Math.max(0, sides[0].votes);
  const b = Math.max(0, sides[1].votes);
  if (a + b === 0) return [50, 50];
  const pa = Math.round((a / (a + b)) * 100);
  return [pa, 100 - pa];
}

/** Applies a viewer reaction to a post (pure — used by the API store and by optimistic UI). */
export function applyPulseReaction(post: PulsePost, r: PulseReaction): PulsePost {
  if (r.action !== 'vote') {
    const want = r.action === 'like';
    if (!!post.liked === want) return post;
    return { ...post, liked: want, likes: Math.max(0, post.likes + (want ? 1 : -1)) };
  }
  if (!post.sides || post.voted) return post;
  const i = r.side === 'a' ? 0 : 1;
  const sides = post.sides.map((s, j) => (j === i ? { ...s, votes: s.votes + 1 } : s)) as [PulseSide, PulseSide];
  return { ...post, sides, voted: r.side };
}

/**
 * "Hot" ranking: engagement with a gravity decay, so a strong post from this morning beats a
 * stronger one from last week.
 */
export function pulseScore(post: PulsePost, now = Date.now()): number {
  const votes = post.sides ? post.sides[0].votes + post.sides[1].votes : 0;
  const engagement = post.likes + post.remixes * 3 + post.comments * 2 + votes * 0.5;
  const hours = Math.max(0, (now - Date.parse(post.createdAt)) / 3_600_000);
  return (engagement + 1) / Math.pow(hours + 2, 1.5);
}

export function sortPulse(posts: readonly PulsePost[], sort: PulseSort, now = Date.now()): PulsePost[] {
  const copy = [...posts];
  if (sort === 'new') return copy.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return copy.sort((a, b) => pulseScore(b, now) - pulseScore(a, now));
}

/** OpenAI-compatible snippet for running a Pulse prompt through the Vigas API. */
export function pulseApiSnippet(post: Pick<PulsePost, 'prompt' | 'modelId'>, lang: 'curl' | 'python' | 'node' = 'curl'): string {
  const prompt = JSON.stringify(post.prompt);
  const model = post.modelId || 'vigas/auto';
  if (lang === 'python') {
    return [
      'from openai import OpenAI',
      '',
      'client = OpenAI(base_url="https://api.vigas.ai/v1", api_key="VIGAS_API_KEY")',
      'res = client.chat.completions.create(',
      `    model="${model}",`,
      `    messages=[{"role": "user", "content": ${prompt}}],`,
      ')',
      'print(res.choices[0].message.content)',
    ].join('\n');
  }
  if (lang === 'node') {
    return [
      "import OpenAI from 'openai';",
      '',
      "const client = new OpenAI({ baseURL: 'https://api.vigas.ai/v1', apiKey: process.env.VIGAS_API_KEY });",
      'const res = await client.chat.completions.create({',
      `  model: '${model}',`,
      `  messages: [{ role: 'user', content: ${prompt} }],`,
      '});',
      'console.log(res.choices[0].message.content);',
    ].join('\n');
  }
  const payload = JSON.stringify({ model, messages: [{ role: 'user', content: post.prompt }] }).replace(/'/g, "'\\''");
  return [
    'curl https://api.vigas.ai/v1/chat/completions \\',
    '  -H "Authorization: Bearer $VIGAS_API_KEY" \\',
    '  -H "Content-Type: application/json" \\',
    `  -d '${payload}'`,
  ].join('\n');
}
