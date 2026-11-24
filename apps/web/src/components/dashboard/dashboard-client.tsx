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
    <section id="credits" aria-labelledby={`${ids}-credits`} className="card" style={{ ...card, flex: '1 1 380px', scrollMarginTop: 24 }}>
      <h2 id={`${ids}-credits`} className="lbl" style={{ margin: 0 }}>
        {isFa ? 'خرید اعتبار API · درگاه AvexPay' : 'Buy API credits · AvexPay'}
      </h2>
      <div className="sf" aria-live="polite" dir="ltr" style={{ fontSize: 'clamp(40px,5vw,60px)', lineHeight: 1.05, letterSpacing: '-.03em', margin: '10px 0 6px', textAlign: isFa ? 'right' : 'left' }}>
        {formatUsd(wallet.balanceMicros)}
      </div>
      <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
        {isFa
          ? `مجموع شارژ تاکنون: ${formatUsd(wallet.lifetimeTopupMicros)} · بدون انقضا برای همه مدل‌ها`
          : `${formatUsd(wallet.lifetimeTopupMicros)} lifetime top-ups · never expires across all models`}
      </div>

      {isSupabase ? (
        <>
          <div role="group" aria-label={isFa ? 'بسته شارژ اعتبار' : 'Credit pack'} dir="ltr" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8, margin: '18px 0 14px' }}>
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
                    height: 50,
                    borderRadius: 12,
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
          <button type="button" className="btn key" onClick={topup} disabled={topupBusy} style={{ width: '100%', minHeight: 50, fontSize: 15 }}>
            {topupBusy
              ? isFa
                ? 'در حال انتقال به درگاه AvexPay…'
                : 'Opening AvexPay checkout…'
              : isFa
                ? `شارژ $${selectedPack.usd} با AvexPay (رمزارز و Stars)`
                : `Pay $${selectedPack.usd} with AvexPay (Crypto & Stars)`}
          </button>
          <p style={{ fontSize: 13, color: 'var(--vg-ink3)', margin: '10px 0 0' }}>
            {isFa
              ? 'درگاه امن AvexPay.net · پرداخت آنی با USDT (TRC20/TON/BEP20)، BTC، ETH و Telegram Stars.'
              : 'Powered by AvexPay.net · instant settlement with USDT, BTC, ETH, TON & Telegram Stars.'}
          </p>
        </>
      ) : (
        <>
          <div role="group" aria-label={isFa ? 'انتخاب مبلغ شارژ' : 'Top-up amount'} dir="ltr" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 6, margin: '18px 0 10px' }}>
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
                    height: 44,
                    borderRadius: 11,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 500,
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
          <label className="field" dir="ltr" style={{ height: 44, marginBottom: 12 }}>
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
          <button type="button" className="btn key" onClick={topup} disabled={!amountValid || topupBusy || !paymentsEnabled} style={{ width: '100%', minHeight: 50, fontSize: 15 }}>
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
          <p className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)', textAlign: 'center', margin: '8px 0 0' }}>
            {amountValid
              ? q.fee
                ? isFa
                  ? `پرداختی شما ${formatUsd(q.total)} · شامل ${formatUsd(q.fee)} کارمزد`
                  : `You pay ${formatUsd(q.total)} · includes ${formatUsd(q.fee)} fee`
                : isFa
                  ? `پرداختی شما ${formatUsd(q.total)} · بدون کارمزد`
                  : `You pay ${formatUsd(q.total)} · no fee`
              : '\u00A0'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--vg-ink3)', margin: '10px 0 0' }}>
            {paymentMode === 'avexpay'
              ? isFa
                ? 'درگاه امن AvexPay.net · پرداخت با رمزارزها (USDT/BTC/ETH/TON) و Telegram Stars.'
                : 'Powered by AvexPay.net · pay securely with Crypto or Telegram Stars.'
              : paymentMode === 'test'
                ? isFa
                  ? 'حالت آزمایشی: اعتبار فوراً اضافه می‌شود و هیچ وجهی کسر نمی‌گردد.'
                  : 'Test mode: credits are added instantly and no payment is charged.'
                : isFa
                  ? 'درگاه پرداخت در حال حاضر متصل نیست.'
                  : 'Payments are not connected yet.'}
          </p>
        </>
      )}

      {topupMsg && (
        <p role={topupMsg.ok ? 'status' : 'alert'} className={`notice ${topupMsg.ok ? 'ok' : 'err'}`} style={{ margin: '12px 0 0' }}>
          {topupMsg.text}
        </p>
      )}
    </section>
  );

  const renderKeysSection = () => (
    <section id="keys" aria-labelledby={`${ids}-keys`} className="card" style={{ ...card, scrollMarginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 id={`${ids}-keys`} className="sf" style={{ fontSize: isFa ? 24 : 28, margin: 0, fontWeight: isFa ? 700 : 400 }}>
          {isFa ? 'مدیریت کلیدهای API' : 'API keys'}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
            {isFa ? `${wallet.keys.length} کلید فعال` : `${wallet.keys.length} active`}
          </span>
          <button type="button" className="btn gh" onClick={() => switchTab('connect')} style={{ minHeight: 32, padding: '0 10px', fontSize: 12 }}>
            <Icon name="code" size={14} />
            {isFa ? 'نمونه کد و اتصال ابزارها' : 'Code & tool setup'}
          </button>
        </div>
      </div>

      {isSupabase && !rpcReady && (
        <div
          role="status"
          style={{
            marginTop: 14,
            padding: '12px 14px',
            borderRadius: 12,
            background: 'var(--vg-sand-soft)',
            border: '1px solid var(--vg-sand-edge)',
            color: 'var(--vg-ink)',
            fontSize: 13.5,
            lineHeight: 1.6,
          }}
        >
          {isFa
            ? 'ساخت و ذخیره کلید API نیازمند اجرای مایگریشن کیف‌پول روی دیتابیس Supabase (فایل 20261119090000_vigas_wallet_api_keys.sql) یا تنظیم DATABASE_URL روی Vercel است.'
            : 'Persistent API key creation requires applying the Supabase wallet migration (20261119090000_vigas_wallet_api_keys.sql) or configuring DATABASE_URL on Vercel.'}
        </div>
      )}

      <form onSubmit={onCreateKey} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', margin: '18px 0 6px' }}>
        <label style={{ flex: '2 1 240px', minWidth: 0 }}>
          <span style={fieldLabel}>{isFa ? 'نام کلید' : 'Key name'}</span>
          <input
            className="input"
            value={keyName}
            maxLength={80}
            placeholder={isFa ? 'مثلاً سرور اصلی، Cursor یا ربات تلگرام' : 'e.g. Production server, Cursor, Bot'}
            onChange={(e) => setKeyName(e.target.value)}
            style={{ height: 46 }}
          />
        </label>
        <label style={{ flex: '1 1 180px', minWidth: 0 }}>
          <span style={fieldLabel}>
            {isFa ? 'سقف ماهانه ' : 'Monthly limit '}
            <span style={{ color: 'var(--vg-ink3)' }}>{isFa ? '(اختیاری، دلاری)' : '(optional, $)'}</span>
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
            style={{ height: 46, fontFamily: 'var(--vg-font-mono)' }}
          />
        </label>
        <button type="submit" className="btn key" disabled={keyBusy || (isSupabase && !rpcReady)} style={{ minHeight: 46 }}>
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
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Top account bar */}
      <div className="dash-top-bar">
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

      {/* KPI Strip */}
      <div className="dash-kpi-grid">
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

      {/* Console Tab Bar */}
      <nav aria-label={isFa ? 'بخش‌های پنل کاربری' : 'API Console sections'} role="tablist" className="dash-tabs scroll-x">
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
            {renderCreditsSection()}

            {/* Usage chart */}
            <section aria-labelledby={`${ids}-usage`} className="card" style={{ ...card, flex: '1.4 1 460px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <h2 id={`${ids}-usage`} className="sf" style={{ fontSize: isFa ? 24 : 28, margin: 0, fontWeight: isFa ? 700 : 400 }}>
                  {isFa ? 'مصرف · ۷ روز گذشته' : 'Usage · last 7 days'}
                </h2>
                <span className="mn" dir="ltr" style={{ fontSize: 13 }}>
                  {formatUsd(weekTotal, { maxDecimals: 4 })}
                </span>
              </div>
              <ol aria-label={isFa ? 'هزینه روزانه' : 'Spend per day'} dir="ltr" style={{ listStyle: 'none', margin: '20px 0 0', padding: 0, display: 'flex', alignItems: 'flex-end', gap: 8, height: 180, borderBottom: '1px solid var(--vg-line2)' }}>
                {wallet.week.map((d, i) => {
                  const last = i === wallet.week.length - 1;
                  const h = d.costMicros ? Math.max(4, Math.round((d.costMicros / weekMax) * 140)) : 2;
                  return (
                    <li key={d.date} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <span className="mn" style={{ fontSize: 11, color: last ? 'var(--vg-orange-text)' : 'var(--vg-ink3)', whiteSpace: 'nowrap' }}>
                        {d.costMicros ? formatUsd(d.costMicros, { maxDecimals: 4 }) : '$0'}
                      </span>
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'block',
                          width: '70%',
                          height: h,
                          borderRadius: '3px 3px 0 0',
                          background: last ? 'repeating-linear-gradient(90deg,#FF6A1A 0 5px,#C9520F 5px 6px)' : 'var(--vg-pillar)',
                        }}
                      />
                      <span className="sr-only">{shortDay(d.date)}</span>
                    </li>
                  );
                })}
              </ol>
              <div aria-hidden="true" dir="ltr" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {wallet.week.map((d) => (
                  <span key={d.date} className="mn" style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center', fontSize: 11, color: 'var(--vg-ink3)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    {shortDay(d.date)}
                  </span>
                ))}
              </div>

              <h3 className="lbl" style={{ margin: '26px 0 10px' }}>
                {isFa ? 'بر اساس بخش · ۳۰ روز گذشته' : 'By product · last 30 days'}
              </h3>
              {wallet.bySource.length === 0 ? (
                <p style={{ margin: 0, fontSize: 14, color: 'var(--vg-ink2)' }}>
                  {isFa ? 'هنوز مصرفی ثبت نشده است. با ساخت کلید API و اولین درخواست، نمودار اینجا زنده می‌شود.' : 'No usage yet. Create an API key and make your first request to see live spend here.'}
                </p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {wallet.bySource.map((s) => (
                    <li key={s.source} style={{ display: 'grid', gridTemplateColumns: '104px minmax(0,1fr) 84px', gap: 12, alignItems: 'center', fontSize: 14 }}>
                      <span>{sourceLabels[s.source] ?? s.source}</span>
                      <span aria-hidden="true" style={{ height: 8, borderRadius: 4, background: 'var(--vg-raised)', overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', width: `${sourceTotal ? (s.costMicros / sourceTotal) * 100 : 0}%`, background: SOURCE_COLOR[s.source] ?? 'var(--vg-blue)' }} />
                      </span>
                      <span className="mn" dir="ltr" style={{ fontSize: 13, textAlign: 'end' }}>
                        {formatUsd(s.costMicros, { maxDecimals: 4 })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {renderKeysSection()}
        </div>
      )}

      {tab === 'keys' && renderKeysSection()}

      {tab === 'credits' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
          {renderCreditsSection()}
          <section className="card" style={card}>
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

const card: CSSProperties = { minWidth: 0, borderRadius: 22, padding: 24 };
const kpiCard: CSSProperties = { minWidth: 0, borderRadius: 18, padding: '16px 18px', display: 'flex', flexDirection: 'column' };
const fieldLabel: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--vg-ink2)' };
