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
export function useToolVote(slug: string, initial: VoteState, lang: 'en' | 'fa' = 'en') {
  const router = useRouter();
  const signedIn = useSignedInHint();
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFa = lang === 'fa';

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
        setError(e instanceof Error ? e.message : isFa ? 'خطا در ثبت رأی.' : 'Could not save your vote.');
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
  lang = 'en',
}: {
  name: string;
  state: VoteState;
  busy?: boolean;
  onClick: () => void;
  large?: boolean;
  lang?: 'en' | 'fa';
}) {
  const isFa = lang === 'fa';
  const count = state.votes.toLocaleString('en-US');
  return (
    <button
      type="button"
      className="vote-btn"
      dir="ltr"
      onClick={onClick}
      aria-pressed={state.voted}
      aria-busy={busy || undefined}
      aria-label={
        isFa
          ? `${state.voted ? 'حذف رأی از' : 'ثبت رأی برای'} ${name} (${count} رأی)`
          : `${state.voted ? 'Remove upvote from' : 'Upvote'} ${name} (${count} votes)`
      }
      style={large ? { width: 76, height: 72, fontSize: 14, marginLeft: 0, marginRight: 0 } : undefined}
    >
      <Icon name="up" size={large ? 18 : 15} />
      {count}
    </button>
  );
}

/** Standalone vote button for the tool detail page. Loads the user's vote after hydration. */
export function ToolVote({
  slug,
  name,
  votes,
  lang = 'en',
}: {
  slug: string;
  name: string;
  votes: number;
  lang?: 'en' | 'fa';
}) {
  const isFa = lang === 'fa';
  const signedIn = useSignedInHint();
  const v = useToolVote(slug, { votes, voted: false }, lang);
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
      <VoteButton name={name} state={v.state} busy={v.busy} onClick={v.toggle} large lang={lang} />
      <span style={{ fontSize: 13, color: v.error ? 'var(--vg-red)' : 'var(--vg-ink3)', maxWidth: 200 }} role="status">
        {v.error ??
          (v.state.voted
            ? isFa
              ? 'شما به این ابزار رأی داده‌اید.'
              : 'You upvoted this tool.'
            : signedIn
              ? isFa
                ? 'اگر این ابزار برایتان مفید است رأی دهید.'
                : 'Upvote if it earns a spot in your stack.'
              : isFa
                ? 'برای ثبت رأی وارد شوید.'
                : 'Sign in to upvote.')}
      </span>
    </span>
  );
}
