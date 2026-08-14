/**
 * session/forkResume.ts
 * ---------------------------------------------------------------------------
 * Fork and resume operations over the session store.
 *
 *   fork(sessionId, atMessageIndex): create a brand-new session whose transcript
 *     is a copy of the source up to (and including) `atMessageIndex`. The
 *     original is untouched, so you can explore an alternate path without losing
 *     the source history. The new session records `parentId` + `forkedFromIndex`.
 *
 *   resume(sessionId): load a paused/stopped session and mark it active so the
 *     runtime can continue from exactly where it left off.
 * ---------------------------------------------------------------------------
 */

import type { AgentSession, SessionPersistence } from "./sessionStore.ts";
import { emptyUsage } from "./sessionStore.ts";

export interface ForkResumeDeps {
  store: SessionPersistence;
  now: () => number;
  idFactory: () => string;
}

export async function forkSession(
  deps: ForkResumeDeps,
  sessionId: string,
  atMessageIndex: number,
): Promise<AgentSession> {
  const source = await deps.store.load(sessionId);
  if (!source) throw new Error(`forkSession: session not found: ${sessionId}`);
  if (atMessageIndex < 0 || atMessageIndex >= source.messages.length) {
    throw new Error(
      `forkSession: atMessageIndex ${atMessageIndex} out of range (0..${source.messages.length - 1}).`,
    );
  }

  const sliced = source.messages.slice(0, atMessageIndex + 1).map((m) => structuredClone(m));
  const now = deps.now();
  const forked: AgentSession = {
    id: deps.idFactory(),
    title: source.title ? `${source.title} (fork)` : "Forked session",
    parentId: source.id,
    forkedFromIndex: atMessageIndex,
    sandboxProfile: source.sandboxProfile,
    status: "active",
    createdAt: now,
    updatedAt: now,
    messages: sliced,
    // Usage starts fresh for the new branch; parent usage stays with the parent.
    usage: emptyUsage(),
  };
  await deps.store.save(forked);
  return forked;
}

export async function resumeSession(
  deps: Pick<ForkResumeDeps, "store" | "now">,
  sessionId: string,
): Promise<AgentSession> {
  const session = await deps.store.load(sessionId);
  if (!session) throw new Error(`resumeSession: session not found: ${sessionId}`);
  session.status = "active";
  session.updatedAt = deps.now();
  await deps.store.save(session);
  return session;
}
