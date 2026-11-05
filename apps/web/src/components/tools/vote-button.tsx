'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError } from '@vigas/api-client';
import { api, useSignedInHint } from '@/lib/client/session';
import { Icon } from '../ui';

export interface VoteState {
  votes: number;
  voted: boolean;
}

/** Toggles the signed-in user's upvote. Signed-out users are sent to sign in first. */
export function useToolVote(slug: string, initial: VoteState) {
  const router = useRouter();
  const signedIn = useSignedInHint();
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (!signedIn) {
      router.push(`/signin?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (busy) return;
    const prev = state;
    setBusy(true);
    setError(null);
    setState({ voted: !prev.voted, votes: prev.votes + (prev.voted ? -1 : 1) });
    try {
      setState(await api.voteTool(slug));
    } catch (e) {
      setState(prev);
      if (e instanceof ApiError && e.status === 401) {
        router.push(`/signin?next=${encodeURIComponent(window.location.pathname)}`);
      } else {
        setError(e instanceof Error ? e.message : 'Could not save your vote.');
      }
    } finally {
      setBusy(false);
    }
  };
  return { state, setState, toggle, busy, error };
}

export function VoteButton({
  name,
  state,
  busy,
  onClick,
  large = false,
}: {
  name: string;
  state: VoteState;
  busy?: boolean;
  onClick: () => void;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      className="vote-btn"
      onClick={onClick}
      aria-pressed={state.voted}
      aria-busy={busy || undefined}
      aria-label={`${state.voted ? 'Remove upvote from' : 'Upvote'} ${name} (${state.votes.toLocaleString('en-US')} votes)`}
      style={large ? { width: 76, height: 72, fontSize: 14, marginLeft: 0 } : undefined}
    >
      <Icon name="up" size={large ? 18 : 15} />
      {state.votes.toLocaleString('en-US')}
    </button>
  );
}

/** Standalone vote button for the tool detail page. Loads the user's vote after hydration. */
export function ToolVote({ slug, name, votes }: { slug: string; name: string; votes: number }) {
  const signedIn = useSignedInHint();
  const v = useToolVote(slug, { votes, voted: false });
  const { setState } = v;
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    api
      .tools()
      .then(({ items }) => {
        const t = items.find((x) => x.slug === slug);
        if (live && t) setState({ votes: t.votes, voted: Boolean(t.voted) });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [signedIn, slug, setState]);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
      <VoteButton name={name} state={v.state} busy={v.busy} onClick={v.toggle} large />
      <span style={{ fontSize: 13, color: v.error ? 'var(--vg-red)' : 'var(--vg-ink3)', maxWidth: 180 }} role="status">
        {v.error ?? (v.state.voted ? 'You upvoted this tool.' : signedIn ? 'Upvote if it earns a spot in your stack.' : 'Sign in to upvote.')}
      </span>
    </span>
  );
}
