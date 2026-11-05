import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';

import { apiConfigured, errorMessage, withTimeout } from './api';

/**
 * Tiny keyed data store: stale-while-revalidate, request de-duplication and a seed-data fallback,
 * so every screen renders from the API when it's up and from `@vigas/core/seed` when it isn't —
 * never an endless spinner.
 */

export interface RemoteEntry<T> {
  data: T | null;
  /** True when `data` came from the bundled fallback instead of the server. */
  offline: boolean;
  error: string | null;
  /** The raw error from the last failed request. */
  cause: unknown;
  loading: boolean;
  refreshing: boolean;
  updatedAt: number;
}

const EMPTY: RemoteEntry<never> = {
  data: null,
  offline: false,
  error: null,
  cause: null,
  loading: false,
  refreshing: false,
  updatedAt: 0,
};

const entries = new Map<string, RemoteEntry<unknown>>();
const listeners = new Map<string, Set<() => void>>();
const inflight = new Map<string, Promise<void>>();

/** Data younger than this isn't refetched when a screen mounts. */
const FRESH_MS = 60_000;

function read<T>(key: string): RemoteEntry<T> {
  return (entries.get(key) as RemoteEntry<T> | undefined) ?? EMPTY;
}

function write<T>(key: string, patch: Partial<RemoteEntry<T>>) {
  entries.set(key, { ...read<T>(key), ...patch });
  listeners.get(key)?.forEach((l) => l());
}

function subscribe(key: string, listener: () => void) {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

export interface LoadOptions<T> {
  fallback?: () => T;
  refresh?: boolean;
}

export function load<T>(key: string, fetcher: () => Promise<T>, opts: LoadOptions<T> = {}): Promise<void> {
  const running = inflight.get(key);
  if (running) return running;

  const current = read<T>(key);
  if (!apiConfigured && opts.fallback) {
    write<T>(key, { data: opts.fallback(), offline: true, error: null, loading: false, refreshing: false, updatedAt: Date.now() });
    return Promise.resolve();
  }

  write<T>(key, { loading: current.data === null, refreshing: !!opts.refresh, error: null });
  const p = withTimeout(fetcher())
    .then((data) => {
      write<T>(key, { data, offline: false, error: null, cause: null, loading: false, refreshing: false, updatedAt: Date.now() });
    })
    .catch((e: unknown) => {
      const prev = read<T>(key);
      const fallback = prev.data === null || prev.offline ? opts.fallback?.() : undefined;
      write<T>(key, {
        data: fallback ?? prev.data,
        offline: fallback !== undefined ? true : prev.offline,
        error: errorMessage(e),
        cause: e,
        loading: false,
        refreshing: false,
        updatedAt: Date.now(),
      });
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}

/** Updates cached data in place (optimistic updates, top-ups) and notifies every screen using it. */
export function mutate<T>(key: string, updater: (prev: T | null) => T | null) {
  write<T>(key, { data: updater(read<T>(key).data) });
}

/** Drops cached entries whose key starts with `prefix` (e.g. on sign-out). */
export function invalidate(prefix: string) {
  for (const key of [...entries.keys()]) {
    if (key.startsWith(prefix)) {
      entries.delete(key);
      listeners.get(key)?.forEach((l) => l());
    }
  }
}

export interface UseRemoteOptions<T> {
  fallback?: () => T;
  /** When false nothing is fetched (e.g. signed-out wallet). */
  enabled?: boolean;
}

export interface Remote<T> extends RemoteEntry<T> {
  refresh: () => Promise<void>;
  /** Initial load hasn't produced anything yet. */
  pending: boolean;
}

/**
 * Subscribes to `key` and loads it on mount (or when stale). Pass `null` as the key to disable.
 */
export function useRemote<T>(key: string | null, fetcher: () => Promise<T>, opts: UseRemoteOptions<T> = {}): Remote<T> {
  const enabled = key !== null && opts.enabled !== false;
  const fetcherRef = useRef(fetcher);
  const fallbackRef = useRef(opts.fallback);
  useLayoutEffect(() => {
    fetcherRef.current = fetcher;
    fallbackRef.current = opts.fallback;
  });

  const sub = useCallback((l: () => void) => (key ? subscribe(key, l) : () => undefined), [key]);
  const snap = useCallback(() => (key ? read<T>(key) : (EMPTY as RemoteEntry<T>)), [key]);
  const entry = useSyncExternalStore(sub, snap, snap);

  useEffect(() => {
    if (!enabled || key === null) return;
    const e = read<T>(key);
    if (e.data !== null && Date.now() - e.updatedAt < FRESH_MS) return;
    void load(key, () => fetcherRef.current(), { fallback: fallbackRef.current });
  }, [key, enabled]);

  const refresh = useCallback(async () => {
    if (!key || !enabled) return;
    await load(key, () => fetcherRef.current(), { fallback: fallbackRef.current, refresh: true });
  }, [key, enabled]);

  // With no server configured, render the seed data on the very first frame (no skeleton flash).
  if (enabled && entry.data === null && !apiConfigured && opts.fallback) {
    return { ...entry, data: opts.fallback(), offline: true, refresh, pending: false };
  }

  return {
    ...entry,
    refresh,
    pending: enabled && entry.data === null && entry.error === null,
  };
}
