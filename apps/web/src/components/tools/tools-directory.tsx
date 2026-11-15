'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '@vigas/api-client';
import type { ToolCategory, ToolItem } from '@vigas/core';
import { api, useSignedInHint } from '@/lib/client/session';
import { toolImageUrl } from '@/lib/media';
import { TOOL_CATEGORY_LABELS_FA } from '@/lib/seo-catalog';
import { Icon, ToolMark } from '../ui';
import { VoteButton, type VoteState } from './vote-button';

type Sort = 'votes' | 'rating' | 'new';
const PAGE = 24;

const PRICING_FA: Record<string, string> = {
  Free: 'رایگان',
  Freemium: 'فریمیوم',
  Paid: 'پولی',
  free: 'رایگان',
  freemium: 'فریمیوم',
  paid: 'پولی',
};

export function ToolsDirectory({
  tools,
  categories,
  initialCategory = 'All',
  initialPricing = null,
  initialVigasOnly = false,
  initialSort = 'votes',
  categoryMode = 'filter',
  lang = 'en',
}: {
  tools: ToolItem[];
  categories: readonly ToolCategory[];
  initialCategory?: ToolCategory | 'All';
  initialPricing?: string | null;
  initialVigasOnly?: boolean;
  initialSort?: Sort;
  categoryMode?: 'filter' | 'link';
  lang?: 'en' | 'fa';
}) {
  const isFa = lang === 'fa';
  const router = useRouter();
  const signedIn = useSignedInHint();
  const [cat, setCat] = useState<ToolCategory | 'All'>(initialCategory);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>(initialSort);
  const [pricing, setPricing] = useState<string | null>(initialPricing);
  const [vigasOnly, setVigasOnly] = useState(initialVigasOnly);
  const [limit, setLimit] = useState(PAGE);
  const [votes, setVotes] = useState<Record<string, VoteState>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const catLabel = (c: ToolCategory | 'All') => {
    if (!isFa) return c;
    return c === 'All' ? 'همه' : (TOOL_CATEGORY_LABELS_FA[c] ?? c);
  };

  const pricingLabel = (p: string) => (isFa ? (PRICING_FA[p] ?? PRICING_FA[p.toLowerCase()] ?? p) : p);

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
        (!s || `${t.name} ${t.tagline} ${t.category} ${TOOL_CATEGORY_LABELS_FA[t.category] ?? ''} ${t.pricing}`.toLowerCase().includes(s)),
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
      else setError(e instanceof Error ? e.message : isFa ? 'خطا در ثبت رأی.' : 'Could not save your vote.');
    } finally {
      setBusy(null);
    }
  };

  const filtersOn = categoryMode === 'filter' && (pricing || vigasOnly);

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <label className="field" style={{ flex: '1 1 280px', minWidth: 0, height: 46 }}>
          <Icon name="search" size={17} />
          <span className="sr-only">{isFa ? 'جستجوی ابزارها' : 'Search tools'}</span>
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
            placeholder={
              isFa
                ? `جستجو بین ${tools.length} ابزار AI — “coding”, “video”, “free”…`
                : `Search ${tools.length} AI apps — “coding”, “video”, “free”…`
            }
            style={{ font: isFa ? '14.5px var(--vg-font-fa)' : '15px var(--vg-font-sans)' }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--vg-ink2)' }}>
          {isFa ? 'مرتب‌سازی' : 'Sort'}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            style={{
              height: 46,
              borderRadius: 12,
              background: 'var(--vg-surface)',
              border: '1px solid var(--vg-line2)',
              color: 'var(--vg-ink)',
              padding: '0 12px',
              font: isFa ? '14px var(--vg-font-fa)' : '14px var(--vg-font-sans)',
            }}
          >
            <option value="votes">{isFa ? 'پررأی‌ترین' : 'Most upvoted'}</option>
            <option value="rating">{isFa ? 'بالاترین امتیاز' : 'Top rated'}</option>
            <option value="new">{isFa ? 'جدیدترین' : 'Newest'}</option>
          </select>
        </label>
      </div>
      <div role="group" aria-label={isFa ? 'فیلترهای دسته‌بندی و ابزارها' : 'Category and app filters'} className="scroll-x" style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {(['All', ...categories] as const).map((c) =>
          categoryMode === 'link' ? (
            <Link
              key={c}
              href={c === 'All' ? '/tools#dir' : `/tools/category/${c.toLowerCase()}`}
              className="chip"
              aria-current={cat === c ? 'page' : undefined}
              style={{ minHeight: 36, padding: '0 14px' }}
            >
              {catLabel(c)}
            </Link>
          ) : (
            <button
              key={c}
              type="button"
              className="chip"
              aria-pressed={cat === c}
              onClick={() => {
                setCat(c);
                setLimit(PAGE);
              }}
              style={{ minHeight: 36, padding: '0 14px' }}
            >
              {catLabel(c)}
            </button>
          ),
        )}
        {categoryMode === 'filter' && (
          <>
            <button
              type="button"
              className="chip"
              aria-pressed={pricing === 'free'}
              onClick={() => {
                setPricing((p) => (p === 'free' ? null : 'free'));
                setLimit(PAGE);
              }}
              style={{ minHeight: 36, padding: '0 14px' }}
            >
              {isFa ? 'رایگان / فریمیوم' : 'Free / Freemium'}
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={vigasOnly}
              onClick={() => {
                setVigasOnly((v) => !v);
                setLimit(PAGE);
              }}
              style={{ minHeight: 36, padding: '0 14px' }}
            >
              Vigas API
            </button>
          </>
        )}
        {filtersOn && pricing && pricing !== 'free' && (
          <button
            type="button"
            className="chip"
            onClick={() => {
              setPricing(null);
              setVigasOnly(false);
            }}
            style={{ minHeight: 36, padding: '0 14px', color: 'var(--vg-orange-text)', borderColor: 'var(--vg-orange-edge)' }}
          >
            {isFa ? `ابزارهای ${pricingLabel(pricing)}` : `${pricing} tools`}
            <Icon name="x" size={13} />
            <span className="sr-only">{isFa ? 'حذف فیلتر' : 'Clear filter'}</span>
          </button>
        )}
      </div>
      {error && (
        <p className="notice err" role="alert" style={{ marginTop: 0 }}>
          {error}
        </p>
      )}
      <p className="sr-only" role="status">
        {isFa ? `${rows.length} ابزار نمایش داده شد` : `${rows.length} tools shown`}
      </p>
      {rows.length === 0 ? (
        <p style={{ padding: '40px 0', textAlign: 'center', color: 'var(--vg-ink2)' }}>
          {isFa ? 'ابزاری با این مشخصات پیدا نشد. عبارت یا دسته دیگری را امتحان کنید.' : 'No tools match. Try another search or category.'}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(290px,100%),1fr))', gap: 16 }}>
          {rows.slice(0, limit).map((t) => {
            const st = stateOf(t);
            const previewUrl = toolImageUrl(t.slug, t.imageUrl);
            return (
              <li key={t.slug} className="lift card" style={{ borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {previewUrl && (
                  <Link href={`/tools/${t.slug}`} className="tool-thumb" aria-label={isFa ? `مشاهده جزئیات ${t.name}` : `Open ${t.name} details`}>
                    <img src={previewUrl} alt={`${t.name} — ${t.category} AI app preview`} width={640} height={360} loading="lazy" />
                  </Link>
                )}
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                  <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                    <ToolMark slug={t.slug} iconUrl={t.iconUrl} color={t.color} letter={t.letter} size={42} radius={11} fontSize={18} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Link href={`/tools/${t.slug}`} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.name}
                        </Link>
                        {t.runsOnVigas && <Icon name="verified" size={14} style={{ color: 'var(--vg-blue)' }} label={isFa ? 'متصل به Vigas API' : 'Runs on the Vigas API'} />}
                      </h3>
                      <p
                        dir="ltr"
                        style={{
                          margin: '3px 0 0',
                          color: 'var(--vg-ink2)',
                          fontSize: 13.5,
                          lineHeight: 1.42,
                          textAlign: isFa ? 'right' : undefined,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {t.tagline}
                      </p>
                    </div>
                    <VoteButton name={t.name} state={st} busy={busy === t.slug} onClick={() => vote(t)} lang={lang} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 'auto', paddingTop: 2 }}>
                    <Link href={`/tools/category/${t.category.toLowerCase()}`} className="pill" style={{ color: 'var(--vg-ink2)' }}>
                      {catLabel(t.category)}
                    </Link>
                    <span className="pill" style={{ color: t.pricing === 'Free' ? 'var(--vg-green)' : undefined }}>
                      {pricingLabel(t.pricing)}
                    </span>
                    {t.runsOnVigas && (
                      <Link href="/tools/collection/vigas-api" className="pill" dir="ltr" style={{ background: 'var(--vg-orange-soft)', color: 'var(--vg-orange-text)' }}>
                        Vigas API
                      </Link>
                    )}
                    {t.isNew && (
                      <span className="pill" style={{ color: 'var(--vg-sand)' }}>
                        {isFa ? 'جدید' : 'New'}
                      </span>
                    )}
                    <span className="mn" dir="ltr" style={{ marginInlineStart: 'auto', fontSize: 12, color: 'var(--vg-sand)' }}>
                      <span aria-hidden="true">★</span> {t.rating.toFixed(1)}
                      <span className="sr-only">{isFa ? ' از ۵' : ' out of 5'}</span>
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > limit && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button type="button" className="btn gh" onClick={() => setLimit((l) => l + PAGE)}>
            {isFa ? `نمایش ${Math.min(PAGE, rows.length - limit)} مورد بیشتر` : `Show ${Math.min(PAGE, rows.length - limit)} more`}
          </button>
        </div>
      )}
    </>
  );
}
