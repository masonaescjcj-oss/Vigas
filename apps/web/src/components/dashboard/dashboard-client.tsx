'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type CSSProperties, type FormEvent } from 'react';
import { ApiError } from '@vigas/api-client';
import type { ApiKeySummary, AppError, CreatedApiKey, ModelListItem, PublicUser, WalletResponse } from '@vigas/core';
import { formatCompact, formatUsd, shortDay } from '@/lib/fmt';
import { isAdminHintEmail } from '@/lib/client/admin-fetch';
import { api } from '@/lib/client/session';
import { signOutEverywhere } from '@/lib/client/session-sync';
import {
  createSupabaseApiKey,
  fetchSupabaseAccount,
  revokeSupabaseApiKey,
  startSupabaseCreditsCheckout,
  SUPABASE_CREDIT_PACKS,
  type SupabaseCreditPackId,
  type SupabaseUsageSummary,
} from '@/lib/client/supabase-account';
import { API_BASE_URL } from '@/lib/client/supabase-config';
import { CopyButton } from '../copy-button';
import { ThemeToggle } from '../theme-toggle';
import { Icon, type IconName } from '../ui';
import { DashboardConnect } from './dashboard-connect';
import { DashboardModels } from './dashboard-models';

type ConsoleTab = 'overview' | 'keys' | 'credits' | 'models' | 'connect';

const PRESETS = [5, 10, 25, 50, 100];
const FREE_ALLOWANCE = 5_000_000;
const SOURCE_LABEL_EN: Record<string, string> = { api: 'API Gateway', chat: 'Playground', arena: 'Eval', retrobuild: 'Sandbox' };
const SOURCE_LABEL_FA: Record<string, string> = { api: 'گیت‌وی API', chat: 'پلی‌گراند', arena: 'ارزیابی', retrobuild: 'سندباکس' };
const SOURCE_COLOR: Record<string, string> = { api: 'var(--vg-orange)', chat: 'var(--vg-sand-fill)', arena: 'var(--vg-indigo)', retrobuild: 'var(--vg-teal)' };

const CONSOLE_TABS: Array<{ id: ConsoleTab; icon: IconName; en: string; fa: string }> = [
  { id: 'overview', icon: 'grid', en: 'Overview', fa: 'نمای کلی' },
  { id: 'keys', icon: 'key', en: 'API Keys', fa: 'کلیدهای API' },
  { id: 'credits', icon: 'wallet', en: 'Buy Credits', fa: 'خرید اعتبار API' },
  { id: 'models', icon: 'cube', en: 'Models & Calculator', fa: 'مدل‌ها و تعرفه' },
  { id: 'connect', icon: 'code', en: 'Connect Tools', fa: 'اتصال ابزارها' },
];

/** Same rule as quoteTopup in @vigas/core: the first $5 of lifetime top-ups is fee-free. */
function quote(amountMicros: number, lifetime: number, feeBps: number) {
  const free = Math.min(amountMicros, Math.max(0, FREE_ALLOWANCE - lifetime));
  const fee = Math.ceil(((amountMicros - free) * feeBps) / 10_000);
  return { fee, total: amountMicros + fee };
}

async function createPostgresKey(name: string, monthlyLimitMicros: number | null): Promise<CreatedApiKey> {
  const res = await fetch('/api/app/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name, ...(monthlyLimitMicros ? { monthlyLimitMicros } : {}) }),
  });
  const body = (await res.json().catch(() => null)) as (CreatedApiKey & Partial<AppError>) | null;
  if (!res.ok || !body) throw new ApiError(res.status, body?.error?.code ?? 'error', body?.error?.message ?? `HTTP ${res.status}`);
  return body;
}

function tabFromHash(hash: string): ConsoleTab | null {
  const clean = hash.replace(/^#/, '').toLowerCase();
  if (clean === 'overview' || clean === 'keys' || clean === 'credits' || clean === 'models' || clean === 'connect') {
    return clean;
  }
  return null;
}

export function DashboardClient({
  user,
  initial,
  models,
  paymentMode,
  backend = 'postgres',
  supabaseRpcReady = true,
  supabaseUsage = null,
  lang = 'en',
}: {
  user: PublicUser;
  initial: WalletResponse;
  models: ModelListItem[];
  paymentMode: 'avexpay' | 'test' | 'none';
  backend?: 'postgres' | 'supabase';
  supabaseRpcReady?: boolean;
  supabaseUsage?: SupabaseUsageSummary | null;
  lang?: 'en' | 'fa';
}) {
  const isFa = lang === 'fa';
  const isSupabase = backend === 'supabase';
  const isAdmin = isAdminHintEmail(user.email);
  const paymentsEnabled = isSupabase || paymentMode !== 'none';
  const router = useRouter();
  const ids = useId();

  const [tab, setTab] = useState<ConsoleTab>('overview');
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('vigas/auto');
  const [wallet, setWallet] = useState(initial);
  const [rpcReady, setRpcReady] = useState(supabaseRpcReady);
  const [usageSummary, setUsageSummary] = useState<SupabaseUsageSummary | null>(supabaseUsage);

  const [amount, setAmount] = useState(25);
  const [custom, setCustom] = useState('');
  const [supaPack, setSupaPack] = useState<SupabaseCreditPackId>('credits_25');
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupMsg, setTopupMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [keyName, setKeyName] = useState('');
  const [keyLimit, setKeyLimit] = useState('');
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyErr, setKeyErr] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [editingLimitId, setEditingLimitId] = useState<string | null>(null);
  const [editingLimitValue, setEditingLimitValue] = useState('');
  const [savingLimitId, setSavingLimitId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const switchTab = (next: ConsoleTab) => {
    setTab(next);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${next}`);
      window.dispatchEvent(new Event('vigas-hash'));
    }
  };

  useEffect(() => {
    if (!accountSheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountSheetOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [accountSheetOpen]);

  useEffect(() => {
    const onHash = () => {
      const next = tabFromHash(window.location.hash);
      if (next) setTab(next);
    };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('vigas-hash', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('vigas-hash', onHash);
    };
  }, []);

  const refresh = async () => {
    if (isSupabase) {
      const next = await fetchSupabaseAccount();
      setWallet(next.wallet);
      setRpcReady(next.rpcReady);
      if (next.usage) setUsageSummary(next.usage);
      return;
    }
    try {
      setWallet(await api.wallet());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.replace('/signin?next=/dashboard');
    }
  };

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const hashTab = tabFromHash(window.location.hash);
    const qModel = sp.get('model')?.trim();
    const t = Number(sp.get('topup'));

    /* eslint-disable react-hooks/set-state-in-effect -- one-time URL hash & query hydration */
    if (hashTab) {
      setTab(hashTab);
    } else if (Number.isFinite(t) && t >= 1 && t <= 1000) {
      setTab('credits');
    } else if (qModel) {
      setTab('connect');
    }

    if (qModel) setSelectedModel(qModel);
    if (Number.isFinite(t) && t >= 1 && t <= 1000) {
      const rounded = Math.round(t);
      setAmount(rounded);
      const nearest = SUPABASE_CREDIT_PACKS.find((p) => p.usd >= rounded) ?? SUPABASE_CREDIT_PACKS[SUPABASE_CREDIT_PACKS.length - 1]!;
      setSupaPack(nearest.id);
    }

    const checkout = sp.get('checkout');
    const ref = sp.get('ref');
    if (checkout === 'cancelled') {
      setTab('credits');
      setTopupMsg({
        ok: false,
        text: isFa ? 'پرداخت در AvexPay لغو شد و مبلغی کسر نگردید.' : 'Checkout was cancelled. Nothing was charged.',
      });
      return;
    }

    if (checkout === 'success' && ref) {
      setTab('credits');
      let active = true;
      void (async () => {
        if (!isSupabase) {
          for (let attempt = 0; attempt < 4 && active; attempt += 1) {
            try {
              const st = await api.checkoutStatus(ref);
              if (!active) return;
              if (st.status === 'succeeded') {
                setTopupMsg({
                  ok: true,
                  text: isFa
                    ? `${formatUsd(st.amountMicros)} اعتبار به کیف‌پول شما اضافه شد.`
                    : `${formatUsd(st.amountMicros)} in credits was added to your wallet.`,
                });
                await refresh();
                return;
              }
              if (st.status === 'failed') {
                setTopupMsg({
                  ok: false,
                  text: isFa ? 'پرداخت تکمیل نشد یا منقضی شد.' : 'Payment could not be completed or expired.',
                });
                return;
              }
            } catch {
              // Fall through to status banner
            }
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
        if (active) {
          setTopupMsg({
            ok: true,
            text: isFa
              ? 'پرداخت شما ثبت شد و در حال تأیید نهایی شبکه است. موجودی به محض تأیید به‌روزرسانی می‌شود.'
              : 'Payment submitted and awaiting confirmation. Your balance will update automatically once settled.',
          });
          await refresh();
        }
      })();
      return () => {
        active = false;
      };
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const amountUsd = custom ? Number(custom) : amount;
  const amountValid = Number.isFinite(amountUsd) && amountUsd >= 1 && amountUsd <= 1000;
  const amountMicros = amountValid ? Math.round(amountUsd * 100) * 10_000 : 0;
  const q = quote(amountMicros, wallet.lifetimeTopupMicros, wallet.feeBps);

  const selectedPack = SUPABASE_CREDIT_PACKS.find((p) => p.id === supaPack) ?? SUPABASE_CREDIT_PACKS[1]!;

  const topup = async () => {
    if (topupBusy) return;
    setTopupBusy(true);
    setTopupMsg(null);
    try {
      if (isSupabase) {
        const res = await startSupabaseCreditsCheckout(supaPack);
        if (res.url) {
          window.location.assign(res.url);
          return;
        }
        throw new Error(isFa ? 'لینک پرداخت از AvexPay دریافت نشد.' : 'Checkout URL was not returned.');
      }

      if (!amountValid) return;
      const r = await api.startCheckout(amountMicros);
      if (r.mode === 'redirect' && r.checkoutUrl) {
        window.location.assign(r.checkoutUrl);
        return;
      }
      setTopupMsg({
        ok: true,
        text: isFa
          ? `${formatUsd(amountMicros)} به اعتبار حساب اضافه شد. مبلغ کل: ${formatUsd(r.totalMicros)}${r.feeMicros ? ` (شامل ${formatUsd(r.feeMicros)} کارمزد)` : ''}.`
          : `Added ${formatUsd(amountMicros)}. Charged ${formatUsd(r.totalMicros)}${r.feeMicros ? ` (incl. ${formatUsd(r.feeMicros)} fee)` : ''}.`,
      });
      setCustom('');
      await refresh();
    } catch (e) {
      setTopupMsg({ ok: false, text: e instanceof Error ? e.message : isFa ? 'افزایش اعتبار ناموفق بود.' : 'Top-up failed.' });
    } finally {
      setTopupBusy(false);
    }
  };

  const onCreateKey = async (e: FormEvent) => {
    e.preventDefault();
    if (keyBusy) return;
    const name = keyName.trim();
    if (!name) {
      setKeyErr(isFa ? 'برای کلید یک نام بنویسید، مثلاً «سرور اصلی».' : 'Give the key a name, e.g. “Production server”.');
      return;
    }
    const limitUsd = keyLimit.trim() ? Number(keyLimit) : null;
    if (limitUsd !== null && !(Number.isFinite(limitUsd) && limitUsd >= 1 && limitUsd <= 100_000)) {
      setKeyErr(
        isFa
          ? 'سقف ماهانه باید بین $1 تا $100,000 باشد یا برای بدون محدودیت خالی بماند.'
          : 'Monthly limit must be between $1 and $100,000, or empty for no limit.',
      );
      return;
    }
    setKeyBusy(true);
    setKeyErr(null);
    try {
      const limitMicros = limitUsd ? Math.round(limitUsd * 100) * 10_000 : null;
      const k = isSupabase ? await createSupabaseApiKey(name, limitMicros) : await createPostgresKey(name, limitMicros);
      setCreated(k);
      setKeyName('');
      setKeyLimit('');
      await refresh();
    } catch (err) {
      setKeyErr(err instanceof Error ? err.message : isFa ? 'ساخت کلید API ناموفق بود.' : 'Could not create the key.');
    } finally {
      setKeyBusy(false);
    }
  };

  const saveKeyLimit = async (k: ApiKeySummary) => {
    const raw = editingLimitValue.trim();
    const limitUsd = raw ? Number(raw) : null;
    if (limitUsd !== null && !(Number.isFinite(limitUsd) && limitUsd >= 1 && limitUsd <= 100_000)) {
      setKeyErr(
        isFa
          ? 'سقف ماهانه باید بین $1 تا $100,000 باشد یا برای بدون محدودیت خالی بماند.'
          : 'Monthly limit must be between $1 and $100,000, or empty for no limit.',
      );
      return;
    }
    setSavingLimitId(k.id);
    setKeyErr(null);
    try {
      await api.updateKeyLimit(k.id, limitUsd ? Math.round(limitUsd * 100) * 10_000 : null);
      setEditingLimitId(null);
      await refresh();
    } catch (err) {
      setKeyErr(err instanceof Error ? err.message : isFa ? 'ذخیره سقف ماهانه ناموفق بود.' : 'Could not update the monthly limit.');
    } finally {
      setSavingLimitId(null);
    }
  };

  const revoke = async (k: ApiKeySummary) => {
    setRevoking(k.id);
    try {
      if (isSupabase) await revokeSupabaseApiKey(k.id);
      else await api.revokeKey(k.id);
      if (created?.id === k.id) setCreated(null);
      setConfirm(null);
      await refresh();
    } catch (e) {
      setKeyErr(e instanceof Error ? e.message : isFa ? 'لغو کلید ناموفق بود.' : 'Could not revoke the key.');
    } finally {
      setRevoking(null);
    }
  };

  const signOut = async () => {
    try {
      await signOutEverywhere();
    } finally {
      router.replace(isFa ? '/fa' : '/');
      router.refresh();
    }
  };

  const weekTotal = wallet.week.reduce((s, d) => s + d.costMicros, 0);
  const weekMax = Math.max(...wallet.week.map((d) => d.costMicros), 1);
  const sourceTotal = wallet.bySource.reduce((s, d) => s + d.costMicros, 0);
  const sourceLabels = isFa ? SOURCE_LABEL_FA : SOURCE_LABEL_EN;

  const renderCreditsSection = () => (
    <section
      id="credits"
      aria-labelledby={`${ids}-credits`}
      className="card dash-wallet-hero"
      style={{ ...card, flex: '1 1 380px', scrollMarginTop: 24, position: 'relative', overflow: 'hidden' }}
    >
      <div aria-hidden="true" className="dash-wallet-ring dash-wallet-ring-lg" />
      <div aria-hidden="true" className="dash-wallet-ring dash-wallet-ring-sm" />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <h2 id={`${ids}-credits`} className="lbl" style={{ margin: 0 }}>
          {isFa ? 'موجودی در دسترس · AvexPay' : 'Available credits · AvexPay'}
        </h2>
        {wallet.balanceMicros > 0 && (
          <a
            href="/chat"
            className="mn"
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 9px',
              borderRadius: 999,
              background: 'var(--vg-green-soft)',
              color: 'var(--vg-green)',
              border: '1px solid var(--vg-green-edge)',
              textDecoration: 'none',
            }}
          >
            {isFa ? 'فعال در چت ←' : 'Ready in Chat →'}
          </a>
        )}
      </div>
      <div
        className="sf"
        aria-live="polite"
        dir="ltr"
        style={{
          position: 'relative',
          fontSize: 'clamp(46px,11vw,60px)',
          lineHeight: 1.02,
          letterSpacing: '-.03em',
          margin: '10px 0 6px',
          textAlign: isFa ? 'right' : 'left',
        }}
      >
        {formatUsd(wallet.balanceMicros)}
      </div>
      <div className="mn" style={{ position: 'relative', fontSize: 12, color: 'var(--vg-ink3)' }}>
        {isFa
          ? `شامل $5.00 اعتبار هدیه · قابل استفاده برای Gemini 4 Hydrogen و چت`
          : `Includes $5.00 welcome credit · ready for Gemini 4 Hydrogen & Chat`}
      </div>

      {isSupabase ? (
        <>
          <div role="group" aria-label={isFa ? 'بسته شارژ اعتبار' : 'Credit pack'} dir="ltr" style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8, margin: '18px 0 12px' }}>
            {SUPABASE_CREDIT_PACKS.map((p) => {
              const on = supaPack === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSupaPack(p.id)}
                  className="mn"
                  style={{
                    height: 48,
                    borderRadius: 14,
                    cursor: 'pointer',
                    fontSize: 15,
                    fontWeight: 600,
                    background: on ? 'var(--vg-orange-soft)' : 'var(--vg-bg2)',
                    color: on ? 'var(--vg-orange-text)' : 'var(--vg-ink)',
                    border: `1px solid ${on ? 'var(--vg-orange-edge)' : 'var(--vg-line2)'}`,
                  }}
                >
                  ${p.usd}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="btn key dash-pay-cta"
            onClick={topup}
            disabled={topupBusy}
            style={{ position: 'relative', width: '100%', minHeight: 52, borderRadius: 16, fontSize: 15.5, fontWeight: 600 }}
          >
            {topupBusy
              ? isFa
                ? 'در حال انتقال به درگاه AvexPay…'
                : 'Opening AvexPay checkout…'
              : isFa
                ? `شارژ $${selectedPack.usd} با AvexPay`
                : `Add $${selectedPack.usd}.00 with AvexPay`}
          </button>
          <p className="mn" style={{ position: 'relative', fontSize: 11.5, color: 'var(--vg-ink3)', textAlign: 'center', margin: '10px 0 0' }}>
            {isFa ? 'USDT · BTC · ETH · TON · Telegram Stars' : 'USDT · BTC · ETH · TON · Telegram Stars'}
          </p>
        </>
      ) : (
        <>
          <div role="group" aria-label={isFa ? 'انتخاب مبلغ شارژ' : 'Top-up amount'} dir="ltr" style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 6, margin: '18px 0 10px' }}>
            {PRESETS.map((a) => {
              const on = !custom && amount === a;
              return (
                <button
                  key={a}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setAmount(a);
                    setCustom('');
                  }}
                  className="mn"
                  style={{
                    height: 46,
                    borderRadius: 13,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                    background: on ? 'var(--vg-orange-soft)' : 'var(--vg-bg2)',
                    color: on ? 'var(--vg-orange-text)' : 'var(--vg-ink)',
                    border: `1px solid ${on ? 'var(--vg-orange-edge)' : 'var(--vg-line2)'}`,
                  }}
                >
                  ${a}
                </button>
              );
            })}
          </div>
          <label className="field" dir="ltr" style={{ position: 'relative', height: 46, borderRadius: 13, marginBottom: 12 }}>
            <span className="mn" style={{ fontSize: 14 }}>
              $
            </span>
            <span className="sr-only">{isFa ? 'مبلغ دلخواه به دلار' : 'Custom amount in US dollars'}</span>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              max={1000}
              step="0.01"
              placeholder={isFa ? `مبلغ دلخواه ($1 – $1,000)، مثلاً ${amount}` : `Other amount ($1 – $1,000), e.g. ${amount}`}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              style={{ font: '14px var(--vg-font-mono)' }}
            />
          </label>
          <button
            type="button"
            className="btn key dash-pay-cta"
            onClick={topup}
            disabled={!amountValid || topupBusy || !paymentsEnabled}
            style={{ position: 'relative', width: '100%', minHeight: 52, borderRadius: 16, fontSize: 15.5, fontWeight: 600 }}
          >
            {topupBusy
              ? paymentMode === 'avexpay'
                ? isFa
                  ? 'در حال انتقال به AvexPay…'
                  : 'Opening AvexPay checkout…'
                : isFa
                  ? 'در حال افزودن اعتبار…'
                  : 'Adding credits…'
              : amountValid
                ? paymentMode === 'avexpay'
                  ? isFa
                    ? `پرداخت ${formatUsd(q.total)} با AvexPay`
                    : `Continue to AvexPay (${formatUsd(q.total)})`
                  : isFa
                    ? `افزودن ${formatUsd(amountMicros)} اعتبار`
                    : `Add ${formatUsd(amountMicros)} in credits`
                : isFa
                  ? 'مبلغی بین $1 تا $1,000 وارد کنید'
                  : 'Enter $1 – $1,000'}
          </button>
          <p className="mn" style={{ position: 'relative', fontSize: 11.5, color: 'var(--vg-ink3)', textAlign: 'center', margin: '10px 0 0' }}>
            {amountValid
              ? q.fee
                ? isFa
                  ? `مبلغ نهایی ${formatUsd(q.total)} · شامل ${formatUsd(q.fee)} کارمزد`
                  : `Total ${formatUsd(q.total)} · includes ${formatUsd(q.fee)} fee`
                : isFa
                  ? `مبلغ نهایی ${formatUsd(q.total)} · بدون کارمزد`
                  : `Total ${formatUsd(q.total)} · $0 fee`
              : '\u00A0'}
          </p>
        </>
      )}

      {topupMsg && (
        <p role={topupMsg.ok ? 'status' : 'alert'} className={`notice ${topupMsg.ok ? 'ok' : 'err'}`} style={{ position: 'relative', margin: '12px 0 0' }}>
          {topupMsg.text}
        </p>
      )}
    </section>
  );

  const renderUsageSection = () => (
    <section aria-labelledby={`${ids}-usage`} className="card dash-card" style={{ ...card, flex: '1.4 1 460px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h2 id={`${ids}-usage`} className="sf" style={{ fontSize: isFa ? 22 : 26, margin: 0, fontWeight: isFa ? 700 : 400 }}>
          {isFa ? 'مصرف این هفته' : 'This week'}
        </h2>
        <span className="mn" dir="ltr" style={{ fontSize: 13.5, color: 'var(--vg-ink2)' }}>
          {formatUsd(weekTotal, { maxDecimals: 4 })}
        </span>
      </div>
      <ol aria-label={isFa ? 'هزینه روزانه' : 'Spend per day'} dir="ltr" style={{ listStyle: 'none', margin: '18px 0 0', padding: 0, display: 'flex', alignItems: 'flex-end', gap: 8, height: 140, borderBottom: '1px solid var(--vg-line)' }}>
        {wallet.week.map((d, i) => {
          const last = i === wallet.week.length - 1;
          const h = d.costMicros ? Math.max(8, Math.round((d.costMicros / weekMax) * 104)) : 4;
          return (
            <li key={d.date} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span className="mn" style={{ fontSize: 10.5, color: last ? 'var(--vg-orange-text)' : 'var(--vg-ink3)', whiteSpace: 'nowrap' }}>
                {d.costMicros ? formatUsd(d.costMicros, { maxDecimals: 4 }) : '$0'}
              </span>
              <span
                aria-hidden="true"
                style={{
                  display: 'block',
                  width: '74%',
                  maxWidth: 32,
                  height: h,
                  borderRadius: '6px 6px 2px 2px',
                  background: last ? 'var(--vg-orange)' : 'var(--vg-pillar)',
                }}
              />
              <span className="sr-only">{shortDay(d.date)}</span>
            </li>
          );
        })}
      </ol>
      <div aria-hidden="true" dir="ltr" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {wallet.week.map((d, i) => {
          const last = i === wallet.week.length - 1;
          return (
            <span
              key={d.date}
              className="mn"
              style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center', fontSize: 11, color: last ? 'var(--vg-ink)' : 'var(--vg-ink3)', whiteSpace: 'nowrap', overflow: 'hidden' }}
            >
              {shortDay(d.date)}
            </span>
          );
        })}
      </div>

      <h3 className="lbl" style={{ margin: '22px 0 10px' }}>
        {isFa ? 'بر اساس بخش · ۳۰ روز گذشته' : 'By product · last 30 days'}
      </h3>
      {wallet.bySource.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--vg-ink3)', lineHeight: 1.6 }}>
          {isFa ? 'هنوز مصرفی ثبت نشده است. با اولین درخواست API نمودار زنده می‌شود.' : 'No usage yet. Make your first API call to see live breakdown here.'}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {wallet.bySource.map((s) => (
            <li key={s.source} style={{ display: 'grid', gridTemplateColumns: '96px minmax(0,1fr) 76px', gap: 10, alignItems: 'center', fontSize: 13.5 }}>
              <span>{sourceLabels[s.source] ?? s.source}</span>
              <span aria-hidden="true" style={{ height: 6, borderRadius: 3, background: 'var(--vg-raised)', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${sourceTotal ? (s.costMicros / sourceTotal) * 100 : 0}%`, background: SOURCE_COLOR[s.source] ?? 'var(--vg-blue)', borderRadius: 3 }} />
              </span>
              <span className="mn" dir="ltr" style={{ fontSize: 12.5, textAlign: 'end' }}>
                {formatUsd(s.costMicros, { maxDecimals: 4 })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const renderKeysSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Compact single-row Gateway Endpoint strip on mobile */}
      <div className="dash-mob-only dash-endpoint-bar">
        <span className="mn" style={{ fontSize: 10.5, color: 'var(--vg-ink3)', textTransform: 'uppercase', letterSpacing: '.08em', flexShrink: 0 }}>
          API
        </span>
        <code className="mn" dir="ltr" style={{ fontSize: 12.5, color: 'var(--vg-green)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
          {API_BASE_URL}
        </code>
        <CopyButton text={API_BASE_URL} label={isFa ? 'کپی Base URL' : 'Copy Base URL'} copiedText={isFa ? 'کپی شد' : 'Copied'} style={{ minHeight: 30, padding: '0 10px', fontSize: 11.5, borderRadius: 9 }}>
          {isFa ? 'کپی' : 'Copy'}
        </CopyButton>
      </div>

      <section id="keys" aria-labelledby={`${ids}-keys`} className="card dash-card" style={{ ...card, scrollMarginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 id={`${ids}-keys`} className="sf" style={{ fontSize: isFa ? 22 : 26, margin: 0, fontWeight: isFa ? 700 : 400 }}>
            {isFa ? 'ساخت کلید جدید' : 'Create API key'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
              {isFa ? `${wallet.keys.length} کلید فعال` : `${wallet.keys.length} active`}
            </span>
            <button type="button" className="btn gh dash-desk-only" onClick={() => switchTab('connect')} style={{ minHeight: 32, padding: '0 10px', fontSize: 12 }}>
              <Icon name="code" size={14} />
              {isFa ? 'نمونه کد و اتصال ابزارها' : 'Code & tool setup'}
            </button>
          </div>
        </div>

        {isSupabase && !rpcReady && (
          <div
            role="status"
            style={{
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: 12,
              background: 'var(--vg-sand-soft)',
              border: '1px solid var(--vg-sand-edge)',
              color: 'var(--vg-ink2)',
              fontSize: 12.5,
              lineHeight: 1.55,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span>
              {isFa
                ? 'ساخت کلید دائمی پس از فعال‌سازی دیتابیس کیف‌پول آماده می‌شود.'
                : 'Persistent API keys unlock as soon as the wallet database is connected.'}
            </span>
            {isAdmin && (
              <Link href="/admin/providers" className="mn" style={{ fontSize: 11.5, color: 'var(--vg-orange-text)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {isFa ? 'تنظیم در پنل ادمین ←' : 'Configure in Admin →'}
              </Link>
            )}
          </div>
        )}

        <form onSubmit={onCreateKey} className="dash-key-form" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', margin: '14px 0 4px' }}>
          <label style={{ flex: '2 1 220px', minWidth: 0 }}>
            <span style={fieldLabel}>{isFa ? 'نام کلید' : 'Key name'}</span>
            <input
              className="input"
              value={keyName}
              maxLength={80}
              placeholder={isFa ? 'مثلاً سرور اصلی، Cursor یا ربات تلگرام' : 'e.g. Production, Cursor, Bot'}
              onChange={(e) => setKeyName(e.target.value)}
              style={{ height: 46, borderRadius: 13 }}
            />
          </label>
          <label style={{ flex: '1 1 160px', minWidth: 0 }}>
            <span style={fieldLabel}>
              {isFa ? 'سقف ماهانه ' : 'Monthly limit '}
              <span style={{ color: 'var(--vg-ink3)' }}>{isFa ? '(اختیاری، $)' : '(optional, $)'}</span>
            </span>
            <input
              className="input"
              type="number"
              dir="ltr"
              inputMode="decimal"
              min={1}
              max={100000}
              step="0.01"
              value={keyLimit}
              placeholder={isFa ? 'نامحدود' : 'No limit'}
              onChange={(e) => setKeyLimit(e.target.value)}
              style={{ height: 46, borderRadius: 13, fontFamily: 'var(--vg-font-mono)' }}
            />
          </label>
          <button type="submit" className="btn key dash-create-btn" disabled={keyBusy || (isSupabase && !rpcReady)} style={{ minHeight: 46, borderRadius: 14 }}>
            <Icon name="plus" size={16} />
            {keyBusy ? (isFa ? 'در حال ساخت…' : 'Creating…') : isFa ? 'ساخت کلید جدید' : 'Create key'}
          </button>
        </form>
        {keyErr && (
          <p role="alert" className="notice err" style={{ margin: '10px 0 0' }}>
            {keyErr}
          </p>
        )}

      {created && (
        <div role="status" style={{ margin: '16px 0 4px', padding: 16, borderRadius: 14, background: 'var(--vg-green-soft)', border: '1px solid var(--vg-green-edge)' }}>
          <p style={{ margin: '0 0 10px', fontSize: 14 }}>
            {isFa ? (
              <>
                <b style={{ fontWeight: 600 }}>کلید «{created.name}» ساخته شد.</b> همین حالا کپی کنید — برای امنیت شما کلید کامل فقط یک بار نمایش داده می‌شود.
              </>
            ) : (
              <>
                <b style={{ fontWeight: 600 }}>“{created.name}” is ready.</b> Copy it now — for your security we only show the full key once.
              </>
            )}
          </p>
          <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 6px 6px 14px', borderRadius: 11, background: 'var(--vg-code)', border: '1px solid var(--vg-line2)' }}>
            <code className="mn" style={{ fontSize: 13, color: 'var(--vg-code-green)', overflowWrap: 'anywhere', flex: 1, minWidth: 0 }}>
              {created.key}
            </code>
            <CopyButton text={created.key} label={isFa ? 'کپی کلید API' : 'Copy API key'} copiedText={isFa ? 'کپی شد' : undefined} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn key" onClick={() => switchTab('connect')} style={{ minHeight: 34, fontSize: 13 }}>
              <Icon name="code" size={14} />
              {isFa ? 'استفاده در کد و Cursor' : 'Use in code & Cursor'}
            </button>
            <button type="button" className="btn gh" onClick={() => setCreated(null)} style={{ minHeight: 34, fontSize: 13 }}>
              {isFa ? 'ذخیره کردم' : 'I’ve saved it'}
            </button>
          </div>
        </div>
      )}

      {wallet.keys.length === 0 ? (
        <p style={{ margin: '16px 0 0', fontSize: 14, color: 'var(--vg-ink2)' }}>
          {isFa ? 'هنوز کلید فعالی ندارید. از فرم بالا یک کلید بسازید تا به API متصل شوید.' : 'No active keys yet. Create one above to start calling 25+ frontier models.'}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0 }}>
          {wallet.keys.map((k) => {
            const limit = k.monthlyLimitMicros ?? null;
            const pct = limit ? Math.min(100, (k.spentThisMonthMicros / limit) * 100) : 0;
            const editingLimit = editingLimitId === k.id;
            return (
              <li key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '14px 0', borderTop: '1px solid var(--vg-line-soft)' }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--vg-indigo-soft)', color: 'var(--vg-indigo)', flexShrink: 0 }}>
                  <Icon name="key" size={17} />
                </span>
                <span style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <b style={{ display: 'block', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.name}</b>
                  <span className="mn" style={{ display: 'block', fontSize: 12, color: 'var(--vg-ink3)' }}>
                    {isFa ? (
                      <>
                        <bdi dir="ltr">{k.display}</bdi> · ساخته‌شده <bdi dir="ltr">{shortDay(k.createdAt)}</bdi> ·{' '}
                        {k.lastUsedAt ? (
                          <>
                            آخرین استفاده <bdi dir="ltr">{shortDay(k.lastUsedAt)}</bdi>
                          </>
                        ) : (
                          'هنوز استفاده نشده'
                        )}
                      </>
                    ) : (
                      `${k.display} · created ${shortDay(k.createdAt)} · ${k.lastUsedAt ? `last used ${shortDay(k.lastUsedAt)}` : 'never used'}`
                    )}
                  </span>
                </span>
                <span style={{ flex: '0 1 210px', minWidth: 150 }}>
                  {editingLimit && !isSupabase ? (
                    <span dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                      <input
                        type="number"
                        min={1}
                        max={100000}
                        step="0.01"
                        value={editingLimitValue}
                        placeholder={isFa ? 'نامحدود' : 'No limit'}
                        onChange={(e) => setEditingLimitValue(e.target.value)}
                        aria-label={isFa ? `سقف ماهانه کلید ${k.name}` : `Monthly limit for ${k.name}`}
                        className="input"
                        style={{ width: 96, height: 34, padding: '0 8px', fontSize: 13, fontFamily: 'var(--vg-font-mono)' }}
                      />
                      <button
                        type="button"
                        className="btn key"
                        disabled={savingLimitId === k.id}
                        onClick={() => void saveKeyLimit(k)}
                        style={{ minHeight: 34, padding: '0 10px', fontSize: 12 }}
                      >
                        {savingLimitId === k.id ? '…' : isFa ? 'ذخیره' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="btn gh"
                        onClick={() => setEditingLimitId(null)}
                        style={{ minHeight: 34, padding: '0 8px', fontSize: 12 }}
                      >
                        {isFa ? 'بستن' : 'Cancel'}
                      </button>
                    </span>
                  ) : (
                    <>
                      <span className="mn" dir="ltr" style={{ display: 'block', fontSize: 13, textAlign: 'end' }}>
                        {formatUsd(k.spentThisMonthMicros)}
                        {limit ? <span style={{ color: 'var(--vg-ink3)' }}> / {formatUsd(limit)}</span> : null}
                      </span>
                      <span className="mn" style={{ display: 'block', fontSize: 11, color: 'var(--vg-ink3)', textAlign: 'end' }}>
                        {isFa
                          ? limit
                            ? 'مصرف / سقف ماهانه'
                            : 'مصرف این ماه · نامحدود'
                          : limit
                            ? 'spent / monthly limit'
                            : 'spent this month · no limit'}
                      </span>
                      {limit ? (
                        <span aria-hidden="true" style={{ display: 'block', height: 4, borderRadius: 2, background: 'var(--vg-raised)', marginTop: 5, overflow: 'hidden' }}>
                          <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: pct >= 90 ? 'var(--vg-red)' : 'var(--vg-orange)' }} />
                        </span>
                      ) : null}
                    </>
                  )}
                </span>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {!isSupabase && !editingLimit && confirm !== k.id && (
                    <button
                      type="button"
                      className="btn gh"
                      onClick={() => {
                        setConfirm(null);
                        setEditingLimitId(k.id);
                        setEditingLimitValue(limit ? String(limit / 1_000_000) : '');
                      }}
                      style={{ minHeight: 36, padding: '0 10px', fontSize: 12.5 }}
                    >
                      {isFa ? 'سقف مصرف' : 'Set limit'}
                    </button>
                  )}
                  {confirm === k.id ? (
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => revoke(k)}
                        disabled={revoking === k.id}
                        style={{ minHeight: 36, padding: '0 12px', fontSize: 13, background: 'var(--vg-red-soft)', color: 'var(--vg-red)', boxShadow: 'inset 0 0 0 1px var(--vg-red-edge)' }}
                      >
                        {revoking === k.id ? (isFa ? 'در حال لغو…' : 'Revoking…') : isFa ? `لغو «${k.name}»` : `Revoke “${k.name}”`}
                      </button>
                      <button type="button" className="btn gh" onClick={() => setConfirm(null)} style={{ minHeight: 36, padding: '0 12px', fontSize: 13 }}>
                        {isFa ? 'انصراف' : 'Cancel'}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn gh"
                      onClick={() => {
                        setEditingLimitId(null);
                        setConfirm(k.id);
                      }}
                      style={{ minHeight: 36, padding: '0 12px', fontSize: 13 }}
                      aria-label={isFa ? `لغو کلید ${k.name}` : `Revoke key ${k.name}`}
                    >
                      <Icon name="trash" size={15} />
                      {isFa ? 'لغو کلید' : 'Revoke'}
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      </section>
    </div>
  );

  const initials = (user.name || user.email || 'VG').replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '').slice(0, 2).toUpperCase() || 'VG';
  const mobileTitle =
    tab === 'credits'
      ? isFa
        ? 'کیف‌پول'
        : 'Wallet'
      : tab === 'connect'
        ? isFa
          ? 'اتصال ابزارها'
          : 'Connect tools'
        : tab === 'models'
          ? isFa
            ? 'مدل‌ها و تعرفه'
            : 'Models'
          : isFa
            ? 'کلیدهای API'
            : 'API keys';

  return (
    <div className="dash-root" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Native Mobile Top App Bar (visible ONLY <= 860px) */}
      <header className="dash-mhdr">
        <div className="dash-mhdr-start">
          {tab === 'connect' && (
            <button
              type="button"
              className="dash-mhdr-back"
              onClick={() => switchTab('keys')}
              aria-label={isFa ? 'بازگشت به کلیدها' : 'Back to API keys'}
            >
              <Icon name="arrow" size={18} style={{ transform: isFa ? undefined : 'rotate(180deg)' }} />
            </button>
          )}
          <h1 className="sf dash-mhdr-title">{mobileTitle}</h1>
        </div>
        <div className="dash-mhdr-end">
          {(tab === 'keys' || tab === 'overview') && (
            <button type="button" className="dash-mhdr-pill" onClick={() => switchTab('connect')}>
              <Icon name="code" size={14} />
              <span>{isFa ? 'کد اتصال' : 'Code'}</span>
            </button>
          )}
          <button
            type="button"
            className="dash-mhdr-avatar"
            onClick={() => setAccountSheetOpen(true)}
            aria-label={isFa ? 'تنظیمات حساب' : 'Account menu'}
            aria-expanded={accountSheetOpen}
          >
            <span>{initials}</span>
            <span className="dash-mhdr-dot" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Native Android Slide-Up Account Sheet */}
      {accountSheetOpen && (
        <div
          className="vg-sheet-scrim"
          role="dialog"
          aria-modal="true"
          aria-label={isFa ? 'حساب کاربری' : 'Account'}
          onClick={(e) => {
            if (e.target === e.currentTarget) setAccountSheetOpen(false);
          }}
        >
          <div className="vg-sheet">
            <div className="vg-sheet-handle" aria-hidden="true" />
            <div className="vg-sheet-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <span className="adm-avatar" style={{ width: 38, height: 38, borderRadius: 12, fontSize: 13 }}>
                  {initials}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.name || user.email}
                  </div>
                  <div className="mn" dir="ltr" style={{ fontSize: 11.5, color: 'var(--vg-ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.email}
                    {usageSummary?.tier ? ` · ${usageSummary.tier.toUpperCase()}` : ''}
                  </div>
                </div>
              </div>
              <button type="button" className="ib" onClick={() => setAccountSheetOpen(false)} aria-label={isFa ? 'بستن' : 'Close'}>
                <Icon name="x" size={17} />
              </button>
            </div>

            <div className="vg-sheet-grid">
              {isAdmin && (
                <Link href="/admin/providers" className="vg-sheet-tile accent" onClick={() => setAccountSheetOpen(false)}>
                  <Icon name="shield" size={18} style={{ color: 'var(--vg-orange-text)' }} />
                  <div>
                    <strong>{isFa ? 'پنل ادمین' : 'Admin Panel'}</strong>
                    <small>{isFa ? 'پروایدرها و کلیدها' : 'Providers & keys'}</small>
                  </div>
                </Link>
              )}
              <a href="/chat" className="vg-sheet-tile" onClick={() => setAccountSheetOpen(false)}>
                <Icon name="chat" size={18} style={{ color: 'var(--vg-orange-text)' }} />
                <div>
                  <strong>{isFa ? 'چت هوشمند' : 'AI Chat'}</strong>
                  <small>{isFa ? 'گفتگو با مدل‌ها' : 'Launch workspace'}</small>
                </div>
              </a>
              <button
                type="button"
                className="vg-sheet-tile"
                style={{ textAlign: 'start', cursor: 'pointer' }}
                onClick={() => {
                  setAccountSheetOpen(false);
                  switchTab('connect');
                }}
              >
                <Icon name="code" size={18} style={{ color: 'var(--vg-indigo)' }} />
                <div>
                  <strong>{isFa ? 'اتصال ابزارها' : 'Connect tools'}</strong>
                  <small>Cursor · Python · Node</small>
                </div>
              </button>
              <Link href={isFa ? '/fa' : '/'} className="vg-sheet-tile" onClick={() => setAccountSheetOpen(false)}>
                <Icon name="globe" size={18} style={{ color: 'var(--vg-ink2)' }} />
                <div>
                  <strong>{isFa ? 'صفحه اصلی' : 'Home'}</strong>
                  <small>vigas.app</small>
                </div>
              </Link>
            </div>

            <div className="vg-sheet-controls">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span className="mn" style={{ fontSize: 11, color: 'var(--vg-ink3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  {isFa ? 'زبان و ظاهر' : 'Language & Theme'}
                </span>
                <div className="hdr-lang">
                  <Link href="/" aria-current={!isFa ? 'page' : undefined} onClick={() => setAccountSheetOpen(false)}>
                    EN
                  </Link>
                  <Link href="/fa" className="fa-ui" aria-current={isFa ? 'page' : undefined} onClick={() => setAccountSheetOpen(false)}>
                    فارسی
                  </Link>
                </div>
              </div>
              <ThemeToggle variant="drawer" lang={lang} />
            </div>

            <div className="vg-sheet-foot">
              <button
                type="button"
                className="btn gh"
                onClick={() => {
                  setAccountSheetOpen(false);
                  void signOut();
                }}
                style={{ width: '100%', minHeight: 44, borderRadius: 13, color: 'var(--vg-red)', borderColor: 'var(--vg-red-edge)' }}
              >
                <Icon name="logout" size={15} />
                {isFa ? 'خروج از حساب' : 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Top account bar (hidden on mobile <= 860px) */}
      <div className="dash-top-bar dash-desk-only">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--vg-green)', display: 'inline-block', flexShrink: 0 }} />
          <p style={{ margin: 0, color: 'var(--vg-ink2)', fontSize: 14, overflowWrap: 'anywhere' }}>
            {isFa ? 'حساب فعال: ' : 'Signed in as '}
            <b dir="ltr" style={{ color: 'var(--vg-ink)', fontWeight: 600 }}>
              {user.name ? `${user.name} · ` : ''}
              {user.email}
            </b>
          </p>
          {usageSummary?.tier && (
            <span className="mn" style={{ fontSize: 11, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 999, background: 'var(--vg-orange-soft)', color: 'var(--vg-orange-text)', border: '1px solid var(--vg-orange-edge)' }}>
              {usageSummary.tier}
            </span>
          )}
        </div>
        <div className="dash-top-actions">
          {isAdmin && (
            <Link
              href="/admin/providers"
              className="btn gh"
              style={{
                minHeight: 38,
                fontSize: 13,
                borderColor: 'var(--vg-orange-edge)',
                color: 'var(--vg-orange-text)',
                background: 'var(--vg-orange-soft)',
              }}
            >
              <Icon name="shield" size={15} />
              {isFa ? 'پنل ادمین' : 'Admin Panel'}
            </Link>
          )}
          <button type="button" className="btn key" onClick={() => switchTab('credits')} style={{ minHeight: 38, fontSize: 13 }}>
            <Icon name="wallet" size={15} />
            {isFa ? 'خرید اعتبار' : 'Add credits'}
          </button>
          <a href="/chat" className="btn gh" style={{ minHeight: 38, fontSize: 13 }}>
            <Icon name="spark" size={15} />
            {isFa ? 'چت AI' : 'AI Chat'}
          </a>
          <button type="button" className="btn gh" onClick={signOut} style={{ minHeight: 38, fontSize: 13 }}>
            <Icon name="logout" size={15} />
            {isFa ? 'خروج' : 'Sign out'}
          </button>
        </div>
      </div>

      {/* Desktop KPI Strip (hidden on mobile <= 860px) */}
      <div className="dash-kpi-grid dash-desk-only">
        <div className="card" style={kpiCard}>
          <span className="lbl">{isFa ? 'موجودی کیف‌پول API' : 'API balance'}</span>
          <div className="sf dash-kpi-val" dir="ltr" style={{ textAlign: isFa ? 'right' : 'left' }}>
            {formatUsd(wallet.balanceMicros)}
          </div>
          <span className="mn" style={{ fontSize: 11.5, color: 'var(--vg-ink3)', marginTop: 4 }}>
            {isFa ? 'شارژ آنی با AvexPay' : 'Instant top-up via AvexPay'}
          </span>
        </div>

        <div className="card" style={kpiCard}>
          <span className="lbl">{isFa ? 'کلیدهای فعال' : 'Active API keys'}</span>
          <div className="sf dash-kpi-val" dir="ltr" style={{ textAlign: isFa ? 'right' : 'left' }}>
            {wallet.keys.length}
          </div>
          <button
            type="button"
            onClick={() => switchTab('keys')}
            style={{ background: 'none', border: 'none', padding: 0, marginTop: 4, cursor: 'pointer', fontSize: 12, color: 'var(--vg-orange-text)', textAlign: 'start' }}
          >
            {isFa ? 'ساخت یا مدیریت کلیدها ←' : 'Create or manage keys →'}
          </button>
        </div>

        <div className="card" style={kpiCard}>
          <span className="lbl">{isFa ? 'مصرف ۷ روز گذشته' : '7-day spend'}</span>
          <div className="sf dash-kpi-val" dir="ltr" style={{ textAlign: isFa ? 'right' : 'left' }}>
            {formatUsd(weekTotal, { maxDecimals: 4 })}
          </div>
          <span className="mn" style={{ fontSize: 11.5, color: 'var(--vg-ink3)', marginTop: 4 }}>
            {usageSummary && usageSummary.planLimitTokens > 0
              ? isFa
                ? `${formatCompact(usageSummary.remainingTokens)} توکن باقی‌مانده چت`
                : `${formatCompact(usageSummary.remainingTokens)} chat tokens remaining`
              : isFa
                ? `${models.length} مدل در دسترس`
                : `${models.length} models ready`}
          </span>
        </div>

        <div className="card" style={kpiCard}>
          <span className="lbl">{isFa ? 'آدرس گیت‌وی (Base URL)' : 'Gateway base URL'}</span>
          <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <code className="mn" style={{ fontSize: 12, color: 'var(--vg-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {API_BASE_URL}
            </code>
            <CopyButton text={API_BASE_URL} label={isFa ? 'کپی Base URL' : 'Copy Base URL'} copiedText={isFa ? 'کپی شد' : 'Copied'} style={{ minHeight: 28, padding: '0 8px', fontSize: 11.5, borderRadius: 7 }}>
              {isFa ? 'کپی' : 'Copy'}
            </CopyButton>
          </div>
          <button
            type="button"
            onClick={() => switchTab('connect')}
            style={{ background: 'none', border: 'none', padding: 0, marginTop: 6, cursor: 'pointer', fontSize: 12, color: 'var(--vg-indigo)', textAlign: 'start' }}
          >
            {isFa ? 'اتصال به Cursor / Python / Node ←' : 'Connect Cursor / Python / Node →'}
          </button>
        </div>
      </div>

      {/* Desktop Console Tab Bar (hidden on mobile <= 860px — zero duplicate menu!) */}
      <nav aria-label={isFa ? 'بخش‌های پنل کاربری' : 'API Console sections'} role="tablist" className="dash-tabs dash-desk-only scroll-x">
        {CONSOLE_TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchTab(item.id)}
              className={`dash-tab${active ? ' on' : ''}`}
            >
              <Icon name={item.icon} size={15} />
              <span>{isFa ? item.fa : item.en}</span>
            </button>
          );
        })}
      </nav>

      {/* Active Panel View */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Desktop overview shows Wallet + Usage; mobile focuses cleanly on Keys to match the active Bottom Bar tab */}
          <div className="dash-desk-only" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
            {renderCreditsSection()}
            {renderUsageSection()}
          </div>

          {renderKeysSection()}
        </div>
      )}

      {tab === 'keys' && renderKeysSection()}

      {tab === 'credits' && (
        <div className="dash-wallet-stack">
          {renderCreditsSection()}
          {renderUsageSection()}
          <section className="card dash-desk-only" style={card}>
            <div className="lbl">{isFa ? 'چرا اعتبار پیش‌پرداخت ویگاس؟' : 'How Vigas prepaid credits work'}</div>
            <h3 className="sf" style={{ fontSize: isFa ? 22 : 26, margin: '8px 0 12px', fontWeight: isFa ? 700 : 400 }}>
              {isFa ? 'یک موجودی برای ۲۵+ مدل پیشتاز' : 'One balance across 25+ frontier models'}
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, color: 'var(--vg-ink2)' }}>
              {(isFa
                ? [
                    'پرداخت امن با رمزارزها (USDT، BTC، ETH، TON) و Telegram Stars از طریق AvexPay.net',
                    'بدون اشتراک ماهانه اجباری — فقط به اندازه توکن مصرفی کسر می‌شود',
                    'سقف مصرف ماهانه دلاری جداگانه برای هر کلید API جهت کنترل هزینه',
                    'همگام‌سازی خودکار موجودی بین پنل API، ابزارهای کدنویسی و چت AI',
                  ]
                : [
                    'Pay globally with Crypto (USDT, BTC, ETH, TON) & Telegram Stars via AvexPay.net',
                    'No mandatory $20/mo subscriptions — pay strictly per token used',
                    'Set per-key monthly USD spending limits to cap team or agent spend',
                    'One unified account works across API Gateway, Cursor/Cline, and AI Chat',
                  ]
              ).map((line) => (
                <li key={line} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Icon name="check" size={16} style={{ color: 'var(--vg-green)', marginTop: 2, flexShrink: 0 }} />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {tab === 'models' && (
        <DashboardModels
          models={models}
          balanceMicros={wallet.balanceMicros}
          lang={lang}
          onUseModelInCode={(modelId) => {
            setSelectedModel(modelId);
            switchTab('connect');
          }}
        />
      )}

      {tab === 'connect' && (
        <DashboardConnect
          models={models}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          apiKeyPreview={created?.key ?? null}
          lang={lang}
          onGoToKeys={() => switchTab('keys')}
        />
      )}
    </div>
  );
}

const card: CSSProperties = { minWidth: 0, borderRadius: 24, padding: 22 };
const kpiCard: CSSProperties = { minWidth: 0, borderRadius: 18, padding: '16px 18px', display: 'flex', flexDirection: 'column' };
const fieldLabel: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--vg-ink2)' };
