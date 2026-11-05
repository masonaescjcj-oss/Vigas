'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';
import { ApiError } from '@vigas/api-client';
import type { ArenaVote, ChatMessage, PublicUser } from '@vigas/core';
import { formatUsd, initials } from '@/lib/fmt';
import { api, notifyAuthChanged } from '@/lib/client/session';
import { renderChatMarkdown } from '@/lib/markdown';
import { Icon, LogoMark } from '../ui';

export interface ChatModel {
  id: string;
  name: string;
  org: string;
  inputPerMillionMicros: number;
  outputPerMillionMicros: number;
}

interface ErrorInfo {
  code: string;
  message: string;
  status?: number;
}

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string | null;
  tokens?: number;
  costUsd?: number | null;
  error?: ErrorInfo;
  pending?: boolean;
}

interface ArenaSideView {
  label: 'A' | 'B';
  content: string;
  modelId?: string;
  modelName?: string;
}

interface ArenaRec {
  prompt: string;
  battleId?: string;
  sides?: ArenaSideView[];
  vote?: ArenaVote;
  error?: ErrorInfo;
  pending?: boolean;
  voting?: boolean;
}

interface Convo {
  id: string;
  title: string;
  mode: 'chat' | 'arena';
  model: string;
  messages: Msg[];
  arena?: ArenaRec;
  updatedAt: number;
}

const STORE_KEY = 'vigas.chat.v1';
const AUTO = 'vigas/auto';
const SUGGESTIONS = [
  'Which model should I use to summarize long contracts, and what would 10,000 cost?',
  'Explain the difference between win share and an Elo-style score.',
  'Write a Python script that calls the Vigas API with streaming.',
  'Give me three ideas for an app I could build with RetroBuild.',
];

const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

function loadConvos(): Convo[] {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const list = raw ? (JSON.parse(raw) as Convo[]) : [];
    return Array.isArray(list)
      ? list
          .filter((c) => c && typeof c.id === 'string')
          .map((c) => ({
            ...c,
            messages: (c.messages ?? []).map((m) => (m.pending ? { ...m, pending: false, error: m.content ? undefined : { code: 'interrupted', message: 'This answer was interrupted.' } } : m)),
            arena: c.arena?.pending ? { ...c.arena, pending: false, error: { code: 'interrupted', message: 'This battle was interrupted.' } } : c.arena,
          }))
      : [];
  } catch {
    return [];
  }
}

function errorText(e: ErrorInfo): { text: string; action?: { href: string; label: string } } {
  switch (e.code) {
    case 'gateway_unavailable':
      return { text: 'Vigas Chat can’t reach the model gateway right now. Please try again in a moment.' };
    case 'unauthorized':
      return { text: 'Your session has ended. Sign in again to keep chatting.', action: { href: '/signin?next=/chat', label: 'Sign in' } };
    case 'insufficient_credits':
    case 'insufficient_balance':
    case 'payment_required':
      return { text: e.message || 'You are out of credits.', action: { href: '/dashboard#credits', label: 'Add credits' } };
    case 'arena_limit':
      return { text: e.message, action: { href: '/leaderboard', label: 'See the leaderboard' } };
    case 'rate_limited':
      return { text: 'You are sending messages too quickly. Wait a few seconds and try again.' };
    default:
      if (e.status === 402) return { text: e.message || 'You are out of credits.', action: { href: '/dashboard#credits', label: 'Add credits' } };
      return { text: e.message || 'Something went wrong.' };
  }
}

const toError = (err: unknown): ErrorInfo =>
  err instanceof ApiError ? { code: err.code, message: err.message, status: err.status } : { code: 'network', message: 'Could not reach Vigas. Check your connection.' };

function group(convos: Convo[]): Array<{ when: string; items: Convo[] }> {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86_400_000;
  const buckets: Array<{ when: string; test: (t: number) => boolean; items: Convo[] }> = [
    { when: 'Today', test: (t) => t >= startToday, items: [] },
    { when: 'Yesterday', test: (t) => t >= startToday - day, items: [] },
    { when: 'Previous 7 days', test: (t) => t >= startToday - 7 * day, items: [] },
    { when: 'Older', test: () => true, items: [] },
  ];
  for (const c of [...convos].sort((a, b) => b.updatedAt - a.updatedAt)) buckets.find((b) => b.test(c.updatedAt))!.items.push(c);
  return buckets.filter((b) => b.items.length);
}

function Markdown({ text }: { text: string }) {
  const html = useMemo(() => renderChatMarkdown(text), [text]);
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function ChatApp({ models }: { models: ChatModel[] }) {
  const [me, setMe] = useState<PublicUser | null | undefined>(undefined);
  const [balance, setBalance] = useState<number | null>(null);
  const [convos, setConvos] = useState<Convo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<'chat' | 'arena'>('chat');
  const [model, setModel] = useState(AUTO);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [asideOpen, setAsideOpen] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const loaded = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const active = convos.find((c) => c.id === activeId) ?? null;
  const modelName = (id: string | null | undefined) => (id ? (models.find((m) => m.id === id || m.id.endsWith(`/${id}`))?.name ?? id) : null);

  // Restore history and pick up ?q=, ?model=, ?mode= from links elsewhere on the site.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const list = loadConvos();
    /* eslint-disable react-hooks/set-state-in-effect -- one-time restore after hydration (localStorage and URL are client-only) */
    setConvos(list);
    loaded.current = true;
    const m = sp.get('model');
    if (m && (m === AUTO || models.some((x) => x.id === m))) setModel(m);
    if (sp.get('mode') === 'arena') setMode('arena');
    const q = sp.get('q');
    if (q) setInput(q.slice(0, 4000));
    /* eslint-enable react-hooks/set-state-in-effect */
    api
      .me()
      .then(({ user }) => setMe(user))
      .catch(() => setMe(null));
  }, [models]);

  useEffect(() => {
    if (!me) return;
    api
      .wallet()
      .then((w) => setBalance(w.balanceMicros))
      .catch(() => {});
  }, [me]);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(convos.slice(0, 50)));
    } catch {
      // Storage full or blocked: history just won't persist.
    }
  }, [convos]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [active?.messages.length, active?.arena?.sides, active?.arena?.pending]);

  const refreshBalance = useCallback(() => {
    api
      .wallet()
      .then((w) => setBalance(w.balanceMicros))
      .catch(() => {});
  }, []);

  const update = (id: string, fn: (c: Convo) => Convo) => setConvos((list) => list.map((c) => (c.id === id ? fn(c) : c)));

  const newChat = () => {
    abortRef.current?.abort();
    setActiveId(null);
    setInput('');
    setAsideOpen(false);
    inputRef.current?.focus();
  };

  const switchMode = (m: 'chat' | 'arena') => {
    if (m === mode) return;
    setMode(m);
    if (active && active.mode !== m) setActiveId(null);
  };

  const sendChat = async (text: string) => {
    let convo = active && active.mode === 'chat' ? active : null;
    const userMsg: Msg = { id: uid(), role: 'user', content: text };
    const reply: Msg = { id: uid(), role: 'assistant', content: '', pending: true };
    if (!convo) {
      convo = { id: uid(), title: text.slice(0, 60), mode: 'chat', model, messages: [], updatedAt: Date.now() };
      const fresh = convo;
      setConvos((list) => [fresh, ...list]);
      setActiveId(fresh.id);
    }
    const id = convo.id;
    const history: ChatMessage[] = [...convo.messages.filter((m) => !m.error && m.content), userMsg].map((m) => ({ role: m.role, content: m.content }));
    update(id, (c) => ({ ...c, model, messages: [...c.messages, userMsg, reply], updatedAt: Date.now() }));

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let acc = '';
    try {
      const res = await api.chat(
        { model, messages: history },
        {
          signal: ctrl.signal,
          onDelta: (d) => {
            acc += d;
            const snapshot = acc;
            update(id, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === reply.id ? { ...m, content: snapshot } : m)) }));
          },
        },
      );
      update(id, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === reply.id ? { ...m, content: res.content, pending: false, model: res.model, tokens: res.promptTokens + res.completionTokens, costUsd: res.costUsd } : m,
        ),
      }));
      refreshBalance();
    } catch (err) {
      const aborted = ctrl.signal.aborted;
      update(id, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === reply.id ? { ...m, pending: false, error: aborted ? (acc ? undefined : { code: 'stopped', message: 'Stopped.' }) : toError(err) } : m,
        ),
      }));
      if (err instanceof ApiError && err.status === 401) {
        setMe(null);
        notifyAuthChanged();
      }
    } finally {
      abortRef.current = null;
    }
  };

  const sendArena = async (text: string) => {
    const convo: Convo = { id: uid(), title: `Arena: ${text.slice(0, 52)}`, mode: 'arena', model: AUTO, messages: [], arena: { prompt: text, pending: true }, updatedAt: Date.now() };
    setConvos((list) => [convo, ...list]);
    setActiveId(convo.id);
    try {
      const b = await api.arenaBattle(text);
      update(convo.id, (c) => ({ ...c, arena: { prompt: b.prompt, battleId: b.battleId, sides: b.sides.map((s) => ({ label: s.label, content: s.content })) } }));
    } catch (err) {
      update(convo.id, (c) => ({ ...c, arena: { prompt: text, error: toError(err) } }));
      if (err instanceof ApiError && err.status === 401) setMe(null);
    }
  };

  const vote = async (v: ArenaVote) => {
    if (!active?.arena?.battleId || active.arena.vote || active.arena.voting) return;
    const id = active.id;
    const battleId = active.arena.battleId;
    update(id, (c) => ({ ...c, arena: { ...c.arena!, voting: true } }));
    try {
      const r = await api.arenaVote(battleId, v);
      update(id, (c) => ({
        ...c,
        updatedAt: Date.now(),
        arena: { ...c.arena!, voting: false, vote: r.vote, sides: r.sides.map((s) => ({ label: s.label, content: s.content, modelId: s.modelId, modelName: s.modelName })) },
      }));
    } catch (err) {
      update(id, (c) => ({ ...c, arena: { ...c.arena!, voting: false, error: toError(err) } }));
    }
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy || !me) return;
    setInput('');
    setBusy(true);
    try {
      if (mode === 'arena') await sendArena(text);
      else await sendChat(text);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  const removeConvo = (id: string) => {
    setConvos((list) => list.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const shown = filter ? convos.filter((c) => c.title.toLowerCase().includes(filter.toLowerCase())) : convos;
  const totals = (active?.messages ?? []).reduce((s, m) => ({ tokens: s.tokens + (m.tokens ?? 0), cost: s.cost + (m.costUsd ?? 0) }), { tokens: 0, cost: 0 });
  const selected = models.find((m) => m.id === model);
  const estimate = selected ? Math.ceil((selected.inputPerMillionMicros * 1000 + selected.outputPerMillionMicros * 500) / 1_000_000) : null;
  const streaming = busy && mode === 'chat';

  return (
    <div className="chat-shell">
      <button type="button" className="chat-scrim" data-open={asideOpen} aria-label="Close chat history" onClick={() => setAsideOpen(false)} tabIndex={asideOpen ? 0 : -1} />
      <aside className="chat-aside" data-open={asideOpen} aria-label="Chat history">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px' }}>
          <Link href="/" aria-label="Vigas home" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <LogoMark size={22} />
            <span className="sf" style={{ fontSize: 24, lineHeight: 1 }}>
              Vigas <em className="hi">Chat</em>
            </span>
          </Link>
          <button type="button" className="ib" aria-label={filter === null ? 'Search chats' : 'Close chat search'} aria-pressed={filter !== null} onClick={() => setFilter((f) => (f === null ? '' : null))}>
            <Icon name={filter === null ? 'search' : 'x'} size={17} />
          </button>
        </div>
        {filter !== null && (
          <label className="field" style={{ height: 40 }}>
            <span className="sr-only">Search chats</span>
            <input autoFocus value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search your chats" style={{ fontSize: 14 }} />
          </label>
        )}
        <button type="button" className="btn key" style={{ width: '100%' }} onClick={newChat}>
          <Icon name="plus" size={16} />
          New chat
        </button>
        <nav aria-label="Recent chats" style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minHeight: 0 }}>
          {shown.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--vg-ink3)', padding: '14px 10px', margin: 0 }}>
              {filter ? 'No chats match.' : 'Your chats are saved in this browser.'}
            </p>
          ) : (
            group(shown).map((g) => (
              <div key={g.when}>
                <div className="lbl" style={{ padding: '14px 10px 6px' }}>
                  {g.when}
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {g.items.map((c) => (
                    <li key={c.id} style={{ display: 'flex', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="hist"
                        aria-current={c.id === activeId ? 'true' : undefined}
                        onClick={() => {
                          setActiveId(c.id);
                          setMode(c.mode);
                          if (c.mode === 'chat') setModel(c.model);
                          setAsideOpen(false);
                        }}
                      >
                        {c.mode === 'arena' && <Icon name="arena" size={13} style={{ marginRight: 6, verticalAlign: '-2px' }} />}
                        {c.title || 'New chat'}
                      </button>
                      {c.id === activeId && (
                        <button type="button" className="ib" aria-label={`Delete chat “${c.title}”`} onClick={() => removeConvo(c.id)} style={{ width: 30, height: 30 }}>
                          <Icon name="trash" size={14} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </nav>
        <div className="card" style={{ borderRadius: 14, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="lbl">Credits</span>
            <span className="mn" style={{ fontSize: 16 }}>
              {me ? (balance === null ? '—' : formatUsd(balance)) : '—'}
            </span>
          </div>
          <div aria-hidden="true" style={{ height: 4, borderRadius: 2, background: 'var(--vg-raised)', margin: '10px 0 12px', overflow: 'hidden' }}>
            <div style={{ width: balance ? `${Math.min(100, (balance / 50_000_000) * 100)}%` : 0, height: '100%', background: 'var(--vg-orange)' }} />
          </div>
          <Link href="/dashboard#credits" style={{ fontSize: 13, color: 'var(--vg-indigo)', fontWeight: 500 }}>
            Add credits · Get API key
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 6px' }}>
          {me ? (
            <>
              <span
                aria-hidden="true"
                style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--vg-sand)', color: '#1a0e06', font: '600 12px var(--vg-font-sans)', display: 'grid', placeItems: 'center', flexShrink: 0 }}
              >
                {initials(me.name || me.email)}
              </span>
              <Link href="/dashboard" style={{ fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {me.name || me.email}
              </Link>
            </>
          ) : (
            <Link href="/signin?next=/chat" className="btn gh" style={{ width: '100%', minHeight: 40 }}>
              Sign in
            </Link>
          )}
        </div>
      </aside>

      <main id="main" className="chat-main">
        <h1 className="sr-only">Vigas Chat</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--vg-line)', flexWrap: 'wrap' }}>
          <button type="button" className="ib chat-menu" aria-label="Open chat history" onClick={() => setAsideOpen(true)}>
            <Icon name="menu" size={18} />
          </button>
          {mode === 'chat' ? (
            <label className="chip" style={{ minHeight: 40, padding: '0 34px 0 14px', color: 'var(--vg-ink)', background: 'var(--vg-surface)', position: 'relative' }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--vg-green)' }} />
              <span className="sr-only">Model</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={streaming}
                className="mn"
                style={{ appearance: 'none', background: 'transparent', border: 0, color: 'var(--vg-ink)', fontSize: 13, cursor: 'pointer', maxWidth: 'min(260px,46vw)' }}
              >
                <option value={AUTO}>vigas/auto — best route</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.id}
                  </option>
                ))}
              </select>
              <Icon name="chevDown" size={14} style={{ position: 'absolute', right: 12, pointerEvents: 'none' }} />
            </label>
          ) : (
            <span className="chip" style={{ minHeight: 40, color: 'var(--vg-ink)', background: 'var(--vg-surface)', cursor: 'default' }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--vg-orange)' }} />
              <span className="mn" style={{ fontSize: 13 }}>
                Arena · 2 hidden models
              </span>
            </span>
          )}
          <div className="seg" role="group" aria-label="Mode">
            {(
              [
                ['chat', 'Chat', 'chat'],
                ['arena', 'Arena', 'arena'],
              ] as const
            ).map(([id, label, icon]) => (
              <button key={id} type="button" aria-pressed={mode === id} onClick={() => switchMode(id)} disabled={busy}>
                <Icon name={icon} size={15} />
                {label}
              </button>
            ))}
          </div>
          <span className="mn chat-cost" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--vg-ink3)' }}>
            {active?.mode === 'chat' && totals.tokens ? `This chat · ${totals.tokens.toLocaleString('en-US')} tokens · ${formatUsd(Math.round(totals.cost * 1_000_000))}` : ''}
          </span>
        </div>

        <div style={{ flex: 1, padding: '32px 20px 24px' }} aria-live="polite" aria-busy={busy}>
          {!active ? (
            <Welcome mode={mode} me={me} onPick={(s) => setInput(s)} />
          ) : active.mode === 'chat' ? (
            <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>
              {active.messages.map((m) =>
                m.role === 'user' ? (
                  <div
                    key={m.id}
                    style={{ alignSelf: 'flex-end', maxWidth: '78%', background: 'var(--vg-raised)', border: '1px solid var(--vg-line)', borderRadius: '18px 18px 4px 18px', padding: '12px 16px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    <span className="sr-only">You: </span>
                    {m.content}
                  </div>
                ) : (
                  <article key={m.id} style={{ display: 'flex', gap: 14 }}>
                    <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--vg-orange-soft)', color: 'var(--vg-orange)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <LogoMark size={18} color="currentColor" />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)', marginBottom: 8 }}>
                        <span className="sr-only">Vigas: </span>
                        {active.model === AUTO ? (
                          <>
                            vigas/auto{m.model ? <> → <span style={{ color: 'var(--vg-sand)' }}>{modelName(m.model)}</span></> : null}
                          </>
                        ) : (
                          <span style={{ color: 'var(--vg-sand)' }}>{modelName(m.model ?? active.model)}</span>
                        )}
                      </div>
                      {m.content && <Markdown text={m.content} />}
                      {m.pending && !m.content && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--vg-ink3)', fontSize: 14 }}>
                          <span className="spin" aria-hidden="true" />
                          Thinking…
                        </span>
                      )}
                      {m.pending && m.content && <span className="cursor" aria-hidden="true" />}
                      {m.error && <ErrorNote error={m.error} />}
                      {!m.pending && !m.error && m.content && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 14, color: 'var(--vg-ink3)', flexWrap: 'wrap' }}>
                          <CopyText text={m.content} />
                          <button
                            type="button"
                            className="chip"
                            style={{ minHeight: 32, marginLeft: 6 }}
                            onClick={() => {
                              const lastUser = [...active.messages].reverse().find((x) => x.role === 'user');
                              switchMode('arena');
                              if (lastUser) setInput(lastUser.content);
                            }}
                          >
                            <Icon name="arena" size={14} />
                            Compare in Arena
                          </button>
                          {(m.tokens ?? 0) > 0 && (
                            <span className="mn" style={{ marginLeft: 'auto', fontSize: 12 }}>
                              {(m.tokens ?? 0).toLocaleString('en-US')} tokens{m.costUsd != null ? ` · ${formatUsd(Math.round(m.costUsd * 1_000_000))}` : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                ),
              )}
              <div ref={endRef} />
            </div>
          ) : (
            <ArenaView rec={active.arena!} onVote={vote} onNext={newChat} />
          )}
          {active?.mode === 'arena' && <div ref={endRef} />}
        </div>

        <div style={{ position: 'sticky', bottom: 0, padding: '12px 20px 18px', background: 'var(--vg-bg)' }}>
          {me === null ? (
            <div className="card" style={{ maxWidth: 820, margin: '0 auto', borderRadius: 20, padding: 18, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ flex: '1 1 260px', color: 'var(--vg-ink2)' }}>
                <b style={{ color: 'var(--vg-ink)', fontWeight: 500 }}>Sign in to start chatting.</b> Chat and Arena use your Vigas account — new accounts get zero markup on the first $5 of credits.
              </span>
              <Link href="/signin?next=/chat" className="btn gh">
                Sign in
              </Link>
              <Link href="/signup?next=/chat" className="btn key">
                Create account
              </Link>
            </div>
          ) : (
            <form
              onSubmit={submit}
              style={{ maxWidth: 820, margin: '0 auto', background: 'var(--vg-surface)', border: '1px solid var(--vg-line2)', borderRadius: 20, padding: 10, boxShadow: '0 -20px 40px -20px rgba(0,0,0,.6)' }}
            >
              <label style={{ display: 'block', padding: '6px 8px 4px' }}>
                <span className="sr-only">Message</span>
                <textarea
                  ref={inputRef}
                  rows={2}
                  value={input}
                  maxLength={mode === 'arena' ? 4000 : 32_000}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKey}
                  placeholder={mode === 'arena' ? 'Ask both models anything…' : 'Message Vigas — any model, one key…'}
                  style={{ width: '100%', resize: 'none', background: 'transparent', border: 0, outline: 0, color: 'var(--vg-ink)', font: '15px/1.5 var(--vg-font-sans)', maxHeight: 220, fieldSizing: 'content' } as CSSProperties}
                />
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)', paddingLeft: 8 }}>
                  {mode === 'arena'
                    ? 'Two hidden models answer · your vote updates the leaderboard'
                    : estimate !== null
                      ? `≈ ${formatUsd(estimate, { maxDecimals: 4 })} / message`
                      : 'vigas/auto routes each message by price and quality'}
                </span>
                <span style={{ marginLeft: 'auto' }} />
                {streaming ? (
                  <button type="button" className="btn gh" aria-label="Stop generating" onClick={() => abortRef.current?.abort()} style={{ minHeight: 40, width: 40, padding: 0, borderRadius: 11 }}>
                    <Icon name="stop" size={16} />
                  </button>
                ) : (
                  <button type="submit" aria-label={mode === 'arena' ? 'Start battle' : 'Send message'} className="btn key" disabled={!input.trim() || busy || me === undefined} style={{ minHeight: 40, width: 40, padding: 0, borderRadius: 11 }}>
                    <Icon name="send" size={18} />
                  </button>
                )}
              </div>
            </form>
          )}
          <div className="mn" style={{ textAlign: 'center', fontSize: 12, color: 'var(--vg-ink3)', marginTop: 8 }}>
            Answers can be wrong. Check sources before you act on them.
          </div>
        </div>
      </main>
    </div>
  );
}

function Welcome({ mode, me, onPick }: { mode: 'chat' | 'arena'; me: PublicUser | null | undefined; onPick: (s: string) => void }) {
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', paddingTop: 'clamp(8px,6vh,64px)' }}>
      <div className="lbl" style={{ color: mode === 'arena' ? 'var(--vg-orange-text)' : undefined }}>
        {mode === 'arena' ? 'Arena · blind test' : me ? `Welcome${me.name ? `, ${me.name.split(' ')[0]}` : ''}` : 'Vigas Chat'}
      </div>
      <p className="sf" style={{ fontSize: 'clamp(38px,5vw,64px)', lineHeight: 1.02, letterSpacing: '-.025em', margin: '12px 0 14px' }}>
        {mode === 'arena' ? (
          <>
            Two hidden models. <em className="hi">You pick the winner.</em>
          </>
        ) : (
          <>
            Ask any model. <em className="hi">Or two at once.</em>
          </>
        )}
      </p>
      <p style={{ color: 'var(--vg-ink2)', margin: '0 0 24px', maxWidth: 600 }}>
        {mode === 'arena'
          ? 'Write one prompt. Two anonymous models from the top of the leaderboard answer, you vote, and then we reveal who was who. Your vote feeds the public leaderboard.'
          : 'Chat with every model in the Vigas gateway, billed per token to your credits. Pick a model above, or let vigas/auto route each message.'}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="chip" onClick={() => onPick(s)} style={{ whiteSpace: 'normal', textAlign: 'left', minHeight: 40, padding: '8px 14px', lineHeight: 1.35, flexShrink: 1 }}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function ErrorNote({ error }: { error: ErrorInfo }) {
  if (error.code === 'stopped') return <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--vg-ink3)' }}>Stopped.</p>;
  const e = errorText(error);
  return (
    <div role="alert" className="notice err" style={{ marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ flex: '1 1 240px' }}>{e.text}</span>
      {e.action && (
        <Link href={e.action.href} className="btn gh" style={{ minHeight: 34, fontSize: 13 }}>
          {e.action.label}
        </Link>
      )}
    </div>
  );
}

function CopyText({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="ib"
      aria-label={done ? 'Answer copied' : 'Copy answer'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        } catch {
          // Clipboard blocked.
        }
      }}
    >
      <Icon name={done ? 'check' : 'copy'} size={16} />
    </button>
  );
}

const VERDICT: Record<ArenaVote, string> = { a: 'A is better', b: 'B is better', tie: 'a tie', bad: 'both answers marked bad' };

function ArenaView({ rec, onVote, onNext }: { rec: ArenaRec; onVote: (v: ArenaVote) => void; onNext: () => void }) {
  const voted = Boolean(rec.vote);
  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="lbl" style={{ color: 'var(--vg-orange-text)' }}>
          Arena · blind test
        </span>
        <span style={{ fontSize: 14, color: 'var(--vg-ink2)' }}>Two anonymous models answer. Your vote updates the public leaderboard.</span>
      </div>
      <div style={{ alignSelf: 'flex-end', maxWidth: '70%', background: 'var(--vg-raised)', border: '1px solid var(--vg-line)', borderRadius: '18px 18px 4px 18px', padding: '12px 16px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        <span className="sr-only">You: </span>
        {rec.prompt}
      </div>
      {rec.pending && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {(['A', 'B'] as const).map((l) => (
            <div key={l} className="card" style={{ flex: '1 1 360px', minWidth: 0, borderRadius: 18, padding: 20, minHeight: 160 }}>
              <span className="sf" style={{ fontSize: 24 }}>
                Model {l}
              </span>
              <p style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--vg-ink3)', fontSize: 14 }}>
                <span className="spin" aria-hidden="true" />
                Writing an answer…
              </p>
            </div>
          ))}
        </div>
      )}
      {rec.sides && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {rec.sides.map((s) => {
            const win = (rec.vote === 'a' && s.label === 'A') || (rec.vote === 'b' && s.label === 'B');
            return (
              <article key={s.label} aria-label={`Answer ${s.label}`} style={{ flex: '1 1 360px', minWidth: 0, background: 'var(--vg-surface)', border: `1px solid ${win ? 'var(--vg-orange)' : 'rgba(239,234,225,.1)'}`, borderRadius: 18, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                  <h2 className="sf" style={{ fontSize: 24, lineHeight: 1, margin: 0, fontWeight: 400 }}>
                    {voted && s.modelName ? s.modelName : `Model ${s.label}`}
                  </h2>
                  <span className="mn" style={{ fontSize: 12, color: win ? 'var(--vg-orange-text)' : 'var(--vg-ink3)' }}>
                    {voted ? (win ? 'YOUR PICK' : s.label) : 'HIDDEN'}
                  </span>
                </div>
                <div style={{ color: '#D9D3C7', fontSize: 14 }}>{s.content ? <Markdown text={s.content} /> : <em style={{ color: 'var(--vg-ink3)' }}>No answer.</em>}</div>
              </article>
            );
          })}
        </div>
      )}
      {rec.error && <ErrorNote error={rec.error} />}
      {rec.sides && !voted && (
        <div role="group" aria-label="Vote" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="arena-vote" disabled={rec.voting} onClick={() => onVote('a')}>
            ← A is better
          </button>
          <button type="button" className="arena-vote" disabled={rec.voting} onClick={() => onVote('tie')}>
            It’s a tie
          </button>
          <button type="button" className="arena-vote" disabled={rec.voting} onClick={() => onVote('bad')}>
            Both are bad
          </button>
          <button type="button" className="arena-vote" disabled={rec.voting} onClick={() => onVote('b')}>
            B is better →
          </button>
        </div>
      )}
      {voted && rec.sides && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '16px 18px', borderRadius: 14, background: 'rgba(111,207,115,.08)', border: '1px solid rgba(111,207,115,.3)' }}>
          <Icon name="check" size={20} style={{ color: 'var(--vg-green)' }} />
          <span style={{ flex: '1 1 260px' }}>
            Vote counted — <b style={{ fontWeight: 600 }}>{VERDICT[rec.vote!]}</b>. A was {rec.sides[0]?.modelName}, B was {rec.sides[1]?.modelName}.
          </span>
          <Link href="/leaderboard" className="btn gh" style={{ minHeight: 38 }}>
            See the leaderboard
          </Link>
          <button type="button" className="btn key" onClick={onNext} style={{ minHeight: 38 }}>
            Next battle
          </button>
        </div>
      )}
    </div>
  );
}
