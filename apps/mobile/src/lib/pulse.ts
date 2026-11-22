import {
  applyPulseReaction,
  sortPulse,
  type PulseDraft,
  type PulseFeedResponse,
  type PulsePost,
  type PulseReaction,
  type PulseSide,
  type PulseSort,
} from '@vigas/core';
import { seedModels, seedPulse } from '@vigas/core/seed';
import { useSyncExternalStore } from 'react';

import { api, apiConfigured } from './api';
import { useRemote } from './remote';

/**
 * Pulse feed state: server posts (or the bundled preview set) plus a local overlay of the viewer's
 * own posts, reactions and bookmarks. Reactions are optimistic and reconciled with the server.
 */

interface Overlay {
  mine: PulsePost[];
  patched: ReadonlyMap<string, PulsePost>;
  bookmarks: ReadonlySet<string>;
}

let overlay: Overlay = { mine: [], patched: new Map(), bookmarks: new Set() };
const listeners = new Set<() => void>();

function set(next: Partial<Overlay>) {
  overlay = { ...overlay, ...next };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const getOverlay = () => overlay;

const PULSE_KEY = 'pulse';
const fallback = (): PulseFeedResponse => ({ items: seedPulse(), preview: true });

export function usePulseFeed(sort: PulseSort) {
  const remote = useRemote<PulseFeedResponse>(PULSE_KEY, () => api.pulse({ sort: 'hot' }), { fallback });
  const o = useSyncExternalStore(subscribe, getOverlay, getOverlay);
  const server = remote.data?.items ?? [];
  const seen = new Set(o.mine.map((p) => p.id));
  const merged = [...o.mine, ...server.filter((p) => !seen.has(p.id))].map((p) => {
    const patched = o.patched.get(p.id) ?? p;
    return { ...patched, bookmarked: o.bookmarks.has(p.id) };
  });
  return { ...remote, items: sortPulse(merged, sort), mineCount: o.mine.length };
}

/** Optimistically applies a like/vote and syncs it to the API when one is configured. */
export function reactToPost(post: PulsePost, reaction: PulseReaction) {
  const next = applyPulseReaction(post, reaction);
  if (next === post) return;
  const patched = new Map(overlay.patched);
  patched.set(post.id, next);
  set({ patched });
  if (!apiConfigured || post.id.startsWith('local_')) return;
  api
    .reactPulse(post.id, reaction)
    .then((res) => {
      const cur = overlay.patched.get(post.id) ?? next;
      const sides =
        cur.sides && res.votes
          ? ([
              { ...cur.sides[0], votes: res.votes[0] },
              { ...cur.sides[1], votes: res.votes[1] },
            ] as [PulseSide, PulseSide])
          : cur.sides;
      const synced = new Map(overlay.patched);
      synced.set(post.id, { ...cur, likes: res.likes, liked: res.liked, voted: res.voted ?? cur.voted, sides });
      set({ patched: synced });
    })
    .catch(() => undefined);
}

export function toggleBookmark(id: string): boolean {
  const bookmarks = new Set(overlay.bookmarks);
  const on = !bookmarks.has(id);
  if (on) bookmarks.add(id);
  else bookmarks.delete(id);
  set({ bookmarks });
  return on;
}

const modelById = new Map(seedModels.map((m) => [m.id, m]));

export function modelLabel(id: string): string {
  if (id === 'vigas/auto') return 'Vigas Auto';
  return modelById.get(id)?.name ?? id;
}

/** Rough cost of one run (≈600 in / 900 out tokens) on a model, in micro-dollars. */
export function runCostMicros(modelId: string): number | null {
  const m = modelById.get(modelId);
  if (!m) return null;
  return Math.round((m.inputPerMillionMicros * 600 + m.outputPerMillionMicros * 900) / 1_000_000);
}

export interface Author {
  id: string;
  name: string;
  handle: string;
}

function localPost(draft: PulseDraft, author: Author): PulsePost {
  const sides = draft.sides?.map((s) => {
    const m = modelById.get(s.modelId);
    return { modelId: s.modelId, modelName: m?.name ?? s.modelId, org: m?.org ?? 'Vigas', excerpt: s.excerpt ?? '', votes: 0 };
  }) as [PulseSide, PulseSide] | undefined;
  return {
    id: `local_${Date.now().toString(36)}`,
    kind: draft.kind,
    author: { ...author, color: '#E3B65C' },
    createdAt: new Date().toISOString(),
    body: draft.body ?? '',
    prompt: draft.prompt,
    modelId: draft.modelId ?? 'vigas/auto',
    tags: draft.tags ?? [],
    likes: 0,
    remixes: 0,
    comments: 0,
    sides,
    liked: false,
    voted: null,
  };
}

/**
 * Publishes a post. With a reachable API it's stored server-side; otherwise it's kept on this device
 * so the feed never loses a draft. Resolves to where it ended up.
 */
export async function publishPost(draft: PulseDraft, author: Author): Promise<'server' | 'device'> {
  if (apiConfigured) {
    try {
      const post = await api.createPulse(draft);
      set({ mine: [post, ...overlay.mine] });
      return 'server';
    } catch {
      // Fall through to a device-only post.
    }
  }
  set({ mine: [localPost(draft, author), ...overlay.mine] });
  return 'device';
}
