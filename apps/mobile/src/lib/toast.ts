import { useSyncExternalStore } from 'react';

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'neutral' | 'success' | 'error';
}

let current: ToastMessage | null = null;
let seq = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

/** Shows a short message above the bottom navigation. */
export function toast(text: string, tone: ToastMessage['tone'] = 'neutral') {
  current = { id: ++seq, text, tone };
  emit();
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    current = null;
    emit();
  }, 2600);
}

export function useToast(): ToastMessage | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => current,
    () => current,
  );
}
