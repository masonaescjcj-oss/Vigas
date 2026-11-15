'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { WalletResponse } from '@vigas/core';
import { formatCompact, formatUsd } from '@/lib/fmt';
import { api, useSignedInHint } from '@/lib/client/session';
import { Icon } from './ui';

const AMOUNTS = [10, 25, 50, 100];

/** Balance, top-up shortcut and keys. Actions happen on the dashboard. */
export function CreditsCard({ blendedPerMillionMicros, lang = 'en' }: { blendedPerMillionMicros: number; lang?: 'en' | 'fa' }) {
  const isFa = lang === 'fa';
  const signedIn = useSignedInHint();
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [amt, setAmt] = useState(25);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    api
      .wallet()
      .then((w) => live && setWallet(w))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [signedIn]);

  const balance = wallet?.balanceMicros ?? 0;
  const tokens = blendedPerMillionMicros > 0 ? (balance / blendedPerMillionMicros) * 1_000_000 : 0;
  const topupHref = `/dashboard?topup=${amt}#credits`;
  const showAccount = signedIn && !failed;

  return (
    <div className="card" style={{ flex: '1 1 360px', minWidth: 0, borderRadius: 22, padding: 24, display: 'flex', flexDirection: 'column' }}>
      <div className="lbl">{showAccount ? (isFa ? 'اعتبار موجود' : 'Available credits') : isFa ? 'اعتبار پیش‌پرداخت' : 'Prepaid credits'}</div>
      <div
        className={isFa ? 'fa-ui' : 'sf'}
        aria-live="polite"
        dir={showAccount ? 'ltr' : undefined}
        style={{
          fontSize: isFa ? 'clamp(36px,4vw,48px)' : 64,
          lineHeight: isFa ? 1.18 : 1,
          fontWeight: isFa ? 700 : 400,
          letterSpacing: isFa ? 0 : '-.03em',
          margin: '10px 0 6px',
          textAlign: isFa ? 'right' : undefined,
        }}
      >
        {showAccount ? (wallet ? formatUsd(balance) : '—') : isFa ? '۰٪ کارمزد' : '$0 markup'}
      </div>
      <div className={isFa ? 'fa-ui' : 'mn'} style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
        {showAccount
          ? wallet
            ? isFa
              ? `≈ ${formatCompact(Math.round(tokens))} توکن بر اساس میانگین تعرفه کاتالوگ`
              : `≈ ${formatCompact(Math.round(tokens))} tokens at the catalogue's median blended rate`
            : isFa
              ? 'در حال بارگذاری موجودی…'
              : 'Loading your balance…'
          : isFa
            ? 'تا ۵ دلار اول بدون کارمزد · کارمزد ناچیز بعدی پیش از پرداخت نمایش داده می‌شود'
            : 'on your first $5 · then a small fee shown before you pay'}
      </div>
      <div role="group" aria-label={isFa ? 'مبلغ شارژ' : 'Top-up amount'} dir="ltr" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 6, margin: '18px 0 12px' }}>
        {AMOUNTS.map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={amt === a}
            onClick={() => setAmt(a)}
            className="mn"
            style={{
              height: 46,
              borderRadius: 11,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              background: amt === a ? 'var(--vg-orange-soft)' : 'var(--vg-bg2)',
              color: amt === a ? 'var(--vg-orange-text)' : 'var(--vg-ink)',
              border: `1px solid ${amt === a ? 'var(--vg-orange)' : 'var(--vg-line2)'}`,
            }}
          >
            ${a}
          </button>
        ))}
      </div>
      <Link
        href={signedIn ? topupHref : `/signup?next=${encodeURIComponent(topupHref)}`}
        className="btn key"
        style={{ width: '100%', minHeight: 50, fontSize: 15 }}
      >
        {isFa ? (
          <>
            افزودن <span dir="ltr">${amt}.00</span> اعتبار
          </>
        ) : (
          `Add $${amt}.00 in credits`
        )}
      </Link>
      <div className={isFa ? 'fa-ui' : 'mn'} style={{ fontSize: 12, color: 'var(--vg-ink3)', textAlign: 'center', marginTop: 8 }}>
        {signedIn ? (isFa ? 'برای تأیید به داشبورد هدایت می‌شوید' : 'Opens your dashboard to confirm') : isFa ? 'برای شارژ اعتبار، حساب رایگان بسازید' : 'Create a free account to add credits'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--vg-line)' }}>
        <b style={{ fontWeight: 600 }}>{isFa ? 'کلیدهای API' : 'API keys'}</b>
        <Link
          href={signedIn ? '/dashboard#keys' : '/signup?next=/dashboard%23keys'}
          className="btn gh"
          style={{ minHeight: 34, padding: '0 12px', fontSize: 13, borderRadius: 9 }}
        >
          <Icon name="plus" size={15} />
          {isFa ? 'کلید جدید' : 'New key'}
        </Link>
      </div>
      {showAccount && wallet ? (
        wallet.keys.length ? (
          wallet.keys.slice(0, 3).map((k) => (
            <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: '1px solid var(--vg-line-soft)' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.name}</span>
                <span className="mn" dir="ltr" style={{ display: 'block', fontSize: 12, color: 'var(--vg-ink3)', textAlign: isFa ? 'right' : undefined }}>
                  {k.display} · {k.spentThisMonthMicros ? `${formatUsd(k.spentThisMonthMicros)} ${isFa ? 'این ماه' : 'this month'}` : isFa ? 'بدون مصرف در این ماه' : 'Not used this month'}
                </span>
              </span>
            </div>
          ))
        ) : (
          <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--vg-ink2)' }}>
            {isFa ? 'هنوز کلیدی ندارید. برای استفاده از API یک کلید بسازید.' : 'No keys yet. Create one to call the API.'}
          </p>
        )
      ) : (
        <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--vg-ink2)' }}>
          {signedIn ? (
            isFa ? (
              'کلیدهای شما اینجا نمایش داده می‌شوند.'
            ) : (
              'Your keys appear here.'
            )
          ) : isFa ? (
            <>
              برای مشاهده موجودی و کلیدها{' '}
              <Link href="/signin?next=/models" style={{ color: 'var(--vg-indigo)' }}>
                وارد شوید
              </Link>
              .
            </>
          ) : (
            <>
              <Link href="/signin?next=/models" style={{ color: 'var(--vg-indigo)' }}>
                Sign in
              </Link>{' '}
              to see your balance and keys.
            </>
          )}
        </p>
      )}
    </div>
  );
}
