import { useSyncExternalStore } from 'react';

/** Saved stories for this app session. (Not persisted yet — see the mobile README.) */
let saved = new Set<string>();
const listeners = new Set<() => void>();

export function toggleSaved(slug: string): boolean {
  const next = new Set(saved);
  const on = !next.has(slug);
  if (on) next.add(slug);
  else next.delete(slug);
  saved = next;
  listeners.forEach((l) => l());
  return on;
}

export function useIsSaved(slug: string): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => saved.has(slug),
    () => saved.has(slug),
  );
}
