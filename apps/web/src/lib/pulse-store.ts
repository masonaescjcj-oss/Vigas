import {
  applyPulseReaction,
  type pulseDraftSchema,
  type PulseDraft,
  type PulsePost,
  type PulseReaction,
  type PulseSide,
} from '@vigas/core';
import { seedModels, seedPulse } from '@vigas/core/seed';
import type { z } from 'zod';

/**
 * Pulse community store.
 *
 * Until the community tables ship, posts live in a per-process store seeded with the preview set
 * (`@vigas/core/seed`). The API contract (`/api/app/pulse*`) is final, so swapping this module for a
 * database-backed implementation needs no client changes.
 */

interface Store {
  created: PulsePost[];
  /** Per-post reaction deltas applied on top of the seed. */
  patches: Map<string, PulsePost>;
  /** `${viewer}:${postId}` → reaction already counted. */
  viewers: Map<string, { liked: boolean; voted: 'a' | 'b' | null }>;
}

const store: Store = ((globalThis as { __vigasPulse?: Store }).__vigasPulse ??= {
  created: [],
  patches: new Map(),
  viewers: new Map(),
});

const MAX_CREATED = 500;

function withViewer(post: PulsePost, viewer: string | null): PulsePost {
  const v = viewer ? store.viewers.get(`${viewer}:${post.id}`) : undefined;
  return { ...post, liked: v?.liked ?? false, voted: v?.voted ?? null, bookmarked: false };
}

export function listPulse(viewer: string | null): PulsePost[] {
  const base = [...store.created, ...seedPulse()].map((p) => store.patches.get(p.id) ?? p);
  return base.map((p) => withViewer(p, viewer));
}

export function findPulse(id: string): PulsePost | undefined {
  const created = store.created.find((p) => p.id === id);
  if (created) return store.patches.get(id) ?? created;
  const seeded = seedPulse().find((p) => p.id === id);
  return seeded ? (store.patches.get(id) ?? seeded) : undefined;
}

const modelById = new Map(seedModels.map((m) => [m.id, m]));

export function createPulse(
  draft: z.output<typeof pulseDraftSchema>,
  author: { id: string; name: string; handle: string },
): PulsePost | { error: string } {
  const known = (id: string) => id === 'vigas/auto' || modelById.has(id);
  if (!known(draft.modelId)) return { error: 'Pick a model from the Vigas catalogue.' };
  let sides: [PulseSide, PulseSide] | undefined;
  if (draft.sides) {
    const built = draft.sides.map((s) => {
      const m = modelById.get(s.modelId);
      return m ? { modelId: m.id, modelName: m.name, org: m.org, excerpt: s.excerpt, votes: 0 } : null;
    });
    if (!built[0] || !built[1]) return { error: 'Pick two models from the Vigas catalogue.' };
    sides = [built[0], built[1]];
  }
  const post: PulsePost = {
    id: `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    kind: draft.kind,
    author: { ...author, color: '#E3B65C' },
    createdAt: new Date().toISOString(),
    body: draft.body,
    prompt: draft.prompt,
    modelId: draft.modelId,
    tags: draft.tags,
    likes: 0,
    remixes: 0,
    comments: 0,
    sides,
  };
  store.created.unshift(post);
  if (store.created.length > MAX_CREATED) store.created.length = MAX_CREATED;
  return post;
}

export function reactPulse(id: string, viewer: string, r: PulseReaction): PulsePost | null {
  const post = findPulse(id);
  if (!post) return null;
  const key = `${viewer}:${id}`;
  const prev = store.viewers.get(key) ?? { liked: false, voted: null };
  const next = applyPulseReaction({ ...post, liked: prev.liked, voted: prev.voted }, r);
  store.viewers.set(key, { liked: !!next.liked, voted: next.voted ?? null });
  store.patches.set(id, { ...next, liked: false, voted: null });
  return next;
}

export type { PulseDraft };
