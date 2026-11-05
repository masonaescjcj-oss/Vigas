'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '@vigas/api-client';
import type { ToolCategory, ToolItem } from '@vigas/core';
import { api, useSignedInHint } from '@/lib/client/session';
import { Icon, Mark } from '../ui';
import { VoteButton, type VoteState } from './vote-button';

type Sort = 'votes' | 'rating' | 'new';
const PAGE = 24;

export function ToolsDirectory({ tools, categories }: { tools: ToolItem[]; categories: readonly ToolCategory[] }) {
  const router = useRouter();
  const signedIn = useSignedInHint();
  const [cat, setCat] = useState<ToolCategory | 'All'>('All');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('votes');
  const [pricing, setPricing] = useState<string | null>(null);
  const [vigasOnly, setVigasOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [votes, setVotes] = useState<Record<string, VoteState>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Deep links: ?category=, ?q=, ?sort=, ?pricing=, ?vigas=1
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const c = sp.get('category');
    const s = sp.get('sort');
    /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from the URL after hydration */
    if (c && categories.includes(c as ToolCategory)) setCat(c as ToolCategory);
    if (sp.get('q')) setQ(sp.get('q')!.slice(0, 100));
    if (s === 'rating' || s === 'new') setSort(s);
    if (sp.get('pricing')) setPricing(sp.get('pricing'));
    if (sp.get('vigas') === '1') setVigasOnly(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [categories]);

  // The signed-in user's own votes are fetched live (never from the shared cache).
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    api
      .tools()
      .then(({ items }) => {
        if (live) setVotes(Object.fromEntries(items.map((t) => [t.slug, { votes: t.votes, voted: Boolean(t.voted) }])));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [signedIn]);

  const stateOf = (t: ToolItem): VoteState => votes[t.slug] ?? { votes: t.votes, voted: false };

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = tools.filter(
      (t) =>
        (cat === 'All' || t.category === cat) &&
        (!pricing || t.pricing.toLowerCase() === pricing.toLowerCase() || (pricing.toLowerCase() === 'free' && t.pricing === 'Freemium')) &&
        (!vigasOnly || t.runsOnVigas) &&
        (!s || `${t.name} ${t.tagline} ${t.category} ${t.pricing}`.toLowerCase().includes(s)),
    );
    const v = (t: ToolItem) => votes[t.slug]?.votes ?? t.votes;
    return list.sort((a, b) =>
      sort === 'rating' ? b.rating - a.rating || a.name.localeCompare(b.name) : sort === 'new' ? Number(b.isNew) - Number(a.isNew) || v(b) - v(a) : v(b) - v(a),
    );
  }, [tools, cat, q, sort, pricing, vigasOnly, votes]);

  const vote = async (t: ToolItem) => {
    if (!signedIn) {
      router.push(`/signin?next=${encodeURIComponent('/tools#dir')}`);
      return;
    }
    if (busy) return;
    const prev = stateOf(t);
    setBusy(t.slug);
    setError(null);
    setVotes((m) => ({ ...m, [t.slug]: { voted: !prev.voted, votes: prev.votes + (prev.voted ? -1 : 1) } }));
    try {
      const r = await api.voteTool(t.slug);
      setVotes((m) => ({ ...m, [t.slug]: r }));
    } catch (e) {
      setVotes((m) => ({ ...m, [t.slug]: prev }));
      if (e instanceof ApiError && e.status === 401) router.push(`/signin?next=${encodeURIComponent('/tools#dir')}`);
      else setError(e instanceof Error ? e.message : 'Could not save your vote.');
    } finally {
      setBusy(null);
    }
  };

  const filtersOn = pricing || vigasOnly;

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
        <label className="field" style={{ flex: '1 1 280px', minWidth: 0, height: 48 }}>
          <Icon name="search" size={17} />
          <span className="sr-only">Search tools</span>
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
            placeholder={`Search ${tools.length} tools — “video”, “free”, “coding agent”…`}
            style={{ font: '15px var(--vg-font-sans)' }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--vg-ink2)' }}>
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            style={{ height: 48, borderRadius: 12, background: 'var(--vg-surface)', border: '1px solid var(--vg-line2)', color: 'var(--vg-ink)', padding: '0 12px', font: '14px var(--vg-font-sans)' }}
          >
            <option value="votes">Most upvoted</option>
            <option value="rating">Top rated</option>
            <option value="new">Newest</option>
          </select>
        </label>
      </div>
      <div role="group" aria-label="Category" className="scroll-x" style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
        {(['All', ...categories] as const).map((c) => (
          <button
            key={c}
            type="button"
            className="chip"
            aria-pressed={cat === c}
            onClick={() => {
              setCat(c);
              setLimit(PAGE);
            }}
            style={{ minHeight: 38, padding: '0 15px' }}
          >
            {c}
          </button>
        ))}
        {filtersOn && (
          <button
            type="button"
            className="chip"
            onClick={() => {
              setPricing(null);
              setVigasOnly(false);
            }}
            style={{ minHeight: 38, padding: '0 15px', color: 'var(--vg-orange-text)', borderColor: 'rgba(255,106,26,.5)' }}
          >
            {pricing ? `${pricing} tools` : 'Runs on Vigas'}
            <Icon name="x" size={13} />
            <span className="sr-only">Clear filter</span>
          </button>
        )}
      </div>
      {error && (
        <p className="notice err" role="alert" style={{ marginTop: 0 }}>
          {error}
        </p>
      )}
      <p className="sr-only" role="status">
        {rows.length} tools shown
      </p>
      {rows.length === 0 ? (
        <p style={{ padding: '40px 0', textAlign: 'center', color: 'var(--vg-ink2)' }}>No tools match. Try another search or category.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(300px,100%),1fr))', gap: 14 }}>
          {rows.slice(0, limit).map((t) => {
            const st = stateOf(t);
            return (
              <li key={t.slug} className="lift card" style={{ borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <Mark color={t.color} letter={t.letter} size={48} radius={13} fontSize={21} />
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Link href={`/tools/${t.slug}`}>{t.name}</Link>
                      {t.runsOnVigas && <Icon name="verified" size={15} style={{ color: 'var(--vg-blue)' }} label="Runs on the Vigas API" />}
                    </h3>
                    <p style={{ margin: '3px 0 0', color: 'var(--vg-ink2)', fontSize: 14, lineHeight: 1.45 }}>{t.tagline}</p>
                  </div>
                  <VoteButton name={t.name} state={st} busy={busy === t.slug} onClick={() => vote(t)} />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 'auto' }}>
                  <span className="pill">{t.category}</span>
                  <span className="pill" style={{ color: t.pricing === 'Free' ? 'var(--vg-green)' : undefined }}>
                    {t.pricing}
                  </span>
                  {t.runsOnVigas && (
                    <span className="pill" style={{ background: 'var(--vg-orange-soft)', color: 'var(--vg-orange-text)' }}>
                      Vigas API
                    </span>
                  )}
                  {t.isNew && (
                    <span className="pill" style={{ color: 'var(--vg-sand)' }}>
                      New
                    </span>
                  )}
                  <span className="mn" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--vg-sand)' }}>
                    <span aria-hidden="true">★</span> {t.rating.toFixed(1)}
                    <span className="sr-only"> out of 5</span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > limit && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button type="button" className="btn gh" onClick={() => setLimit((l) => l + PAGE)}>
            Show {Math.min(PAGE, rows.length - limit)} more
          </button>
        </div>
      )}
    </>
  );
}
