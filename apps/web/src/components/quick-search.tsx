'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { api } from '@/lib/client/session';
import { Icon } from './ui';

interface Entry {
  type: 'Model' | 'News' | 'Tool' | 'Page';
  title: string;
  sub: string;
  href: string;
}

const LEADERBOARDS: Array<[string, string]> = [
  ['Overall', '/leaderboard'],
  ['Coding', '/leaderboard/coding'],
  ['WebDev', '/leaderboard/webdev'],
  ['Text', '/leaderboard/text'],
  ['Vision', '/leaderboard/vision'],
  ['Image edit', '/leaderboard/image-edit'],
  ['Aligned', '/leaderboard/aligned'],
  ['Work', '/leaderboard/work'],
];

const PAGES: Entry[] = [
  ...LEADERBOARDS.map(([label, href]) => ({ type: 'Page' as const, title: `${label} leaderboard`, sub: 'Rankings from real use', href })),
  { type: 'Page', title: 'Vigas Chat', sub: 'Chat with any model, or two at once in Arena', href: '/chat' },
  { type: 'Page', title: 'API quickstart', sub: 'Python, TypeScript and cURL', href: '/models#quickstart' },
  { type: 'Page', title: 'RetroBuild', sub: 'Describe an app, the agent builds it', href: '/retrobuild' },
  { type: 'Page', title: 'Dashboard', sub: 'Credits, usage and API keys', href: '/dashboard' },
];

let indexPromise: Promise<Entry[]> | null = null;

function loadIndex(): Promise<Entry[]> {
  indexPromise ??= Promise.all([api.models(), api.news({ limit: 50 }), api.tools()])
    .then(([models, news, tools]) => [
      ...models.items.map((m) => ({ type: 'Model' as const, title: m.name, sub: `${m.org} · ${m.id}`, href: `/models?q=${encodeURIComponent(m.id)}` })),
      ...news.items.map((n) => ({ type: 'News' as const, title: n.title, sub: n.category, href: `/news/${n.slug}` })),
      ...tools.items.map((t) => ({ type: 'Tool' as const, title: t.name, sub: `${t.category} · ${t.tagline}`, href: `/tools/${t.slug}` })),
      ...PAGES,
    ])
    .catch(() => {
      indexPromise = null;
      return PAGES;
    });
  return indexPromise;
}

function search(index: Entry[], q: string): Entry[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const scored: Array<[number, Entry]> = [];
  for (const e of index) {
    const t = e.title.toLowerCase();
    const score = t.startsWith(s) ? 3 : t.includes(s) ? 2 : e.sub.toLowerCase().includes(s) ? 1 : 0;
    if (score) scored.push([score, e]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, 8).map(([, e]) => e);
}

export function QuickSearch() {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [index, setIndex] = useState<Entry[] | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = index ? search(index, q) : [];

  const warm = useCallback(() => {
    if (!index) void loadIndex().then(setIndex);
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const el = inputRef.current;
        if (el && el.offsetParent !== null) {
          e.preventDefault();
          el.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQ('');
    inputRef.current?.blur();
    router.push(href);
  };

  return (
    <div className="qs hdr-search" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const pick = results[active] ?? results[0];
          if (pick) go(pick.href);
          else if (q.trim()) go(`/tools?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <label className="qs-box">
          <Icon name="search" size={15} />
          <span className="sr-only">Search Vigas</span>
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={open && results.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
            placeholder="Search models, news, tools"
            value={q}
            onFocus={() => {
              warm();
              setOpen(true);
            }}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
              setOpen(true);
              warm();
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, Math.max(0, results.length - 1)));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
          />
          <kbd aria-hidden="true">⌘K</kbd>
        </label>
      </form>
      {open && q.trim() && (
        <div className="qs-pop">
          {index === null ? (
            <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--vg-ink3)' }}>Loading…</div>
          ) : results.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--vg-ink3)' }}>
              No matches. Press Enter to search the tools directory.
            </div>
          ) : (
            <ul id={listId} role="listbox" aria-label="Search results" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {results.map((r, i) => (
                <li key={`${r.type}${r.href}`} role="presentation">
                  <a
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    href={r.href}
                    className="qs-item"
                    onMouseEnter={() => setActive(i)}
                    onClick={(e) => {
                      e.preventDefault();
                      go(r.href);
                    }}
                  >
                    <span className="mn" style={{ fontSize: 11, color: 'var(--vg-ink3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                      {r.type}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--vg-ink3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.sub}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
