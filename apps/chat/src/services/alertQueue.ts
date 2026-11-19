/**
 * frontend/src/services/alertQueue.ts
 * ---------------------------------------------------------------------------
 * The bridge between code that needs to ask the user something and the
 * component that can actually draw the question.
 *
 * notify(), confirmAction() and chooseAction() are called from services and
 * hooks, not from inside a component, so they cannot render anything
 * themselves. This is the imperative side: a request goes on a queue, a mounted
 * host renders it, and the promise settles when the user answers.
 *
 * A request is a title, a message and a **list of buttons** — the same shape
 * Alert.alert takes, which is what lets one host serve a notification (one
 * button), a confirm (two) and an action sheet (more) without three components.
 * The answer is the index pressed, or DISMISSED.
 *
 * A queue rather than a single slot because requests genuinely overlap — a
 * failure raised mid-confirm would otherwise replace the question the user is
 * looking at, and whichever promise lost the race would never settle.
 *
 * Deliberately free of react-native imports so it can be unit-tested and so
 * the fallback path in notify.ts cannot circularly depend on it.
 * ---------------------------------------------------------------------------
 */

/** No button was pressed: Escape, Android back, or the host went away. */
export const DISMISSED = -1;

export interface AlertButton {
  label: string;
  /** Colours it as dangerous — delete, roll back, revoke. */
  destructive?: boolean;
}

export interface AlertRequest {
  /** Identity, so the host can key the list and settle the right one. */
  id: number;
  title: string;
  message?: string;
  /** In press order; the last is the primary action. */
  buttons: AlertButton[];
  /** Index of the button that means "no", reached by Escape or back. */
  cancelIndex?: number;
  resolve: (index: number) => void;
}

type Listener = (queue: AlertRequest[]) => void;

let queue: AlertRequest[] = [];
let listeners: Listener[] = [];
let nextId = 1;

function emit(): void {
  const snapshot = queue;
  for (const listener of listeners) listener(snapshot);
}

/** True when a host is mounted and can therefore draw a dialog. */
export function hasAlertHost(): boolean {
  return listeners.length > 0;
}

export function subscribeToAlerts(listener: Listener): () => void {
  listeners = [...listeners, listener];
  listener(queue);
  return () => {
    listeners = listeners.filter((entry) => entry !== listener);
  };
}

/** Enqueue a request; the promise settles with the index the user pressed. */
export function requestAlert(
  request: Omit<AlertRequest, "id" | "resolve">,
): Promise<number> {
  return new Promise<number>((resolve) => {
    queue = [...queue, { ...request, id: nextId++, resolve }];
    emit();
  });
}

/**
 * Answer a request and drop it.
 *
 * Removing before resolving matters: the host re-renders on the queue change,
 * and a caller that opens a second dialog from its own `.then` would otherwise
 * race against a queue that still contained the request it just answered.
 */
export function answerAlert(id: number, index: number): void {
  const target = queue.find((entry) => entry.id === id);
  if (!target) return;
  queue = queue.filter((entry) => entry.id !== id);
  target.resolve(index);
  emit();
}

/**
 * Refuse everything outstanding.
 *
 * Called when the host unmounts: a pending promise whose dialog has left the
 * screen would hang forever, and DISMISSED is the safe answer — the callers
 * that ask questions are guarding destructive actions.
 */
export function rejectAllAlerts(): void {
  const pending = queue;
  queue = [];
  for (const entry of pending) entry.resolve(DISMISSED);
  emit();
}

/** Test seam: drop state between cases without reloading the module. */
export function resetAlertQueueForTests(): void {
  queue = [];
  listeners = [];
  nextId = 1;
}
