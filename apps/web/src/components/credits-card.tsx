'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { WalletResponse } from '@vigas/core';
import { formatCompact, formatUsd } from '@/lib/fmt';
import { api, useSignedInHint } from '@/lib/client/session';
import { Icon } from './ui';

const AMOUNTS = [10, 25, 50, 100];

/** Balance, top-up shortcut and keys. Actions happen on the dashboard. */
export function CreditsCard({ blendedPerMillionMicros }: { blendedPerMillionMicros: number }) {
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
      <div className="lbl">{showAccount ? 'Available credits' : 'Prepaid credits'}</div>
      <div className="sf" aria-live="polite" style={{ fontSize: 64, lineHeight: 1, letterSpacing: '-.03em', margin: '10px 0 6px' }}>
        {showAccount ? (wallet ? formatUsd(balance) : '—') : '$0 markup'}
      </div>
      <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
        {showAccount
          ? wallet
            ? `≈ ${formatCompact(Math.round(tokens))} tokens at the catalogue's median blended rate`
            : 'Loading your balance…'
          : 'on your first $5 · then a small fee shown before you pay'}
      </div>
      <div role="group" aria-label="Top-up amount" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 6, margin: '18px 0 12px' }}>
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
        Add ${amt}.00 in credits
      </Link>
      <div className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)', textAlign: 'center', marginTop: 8 }}>
        {signedIn ? 'Opens your dashboard to confirm' : 'Create a free account to add credits'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--vg-line)' }}>
        <b style={{ fontWeight: 600 }}>API keys</b>
        <Link
          href={signedIn ? '/dashboard#keys' : '/signup?next=/dashboard%23keys'}
          className="btn gh"
          style={{ minHeight: 34, padding: '0 12px', fontSize: 13, borderRadius: 9 }}
        >
          <Icon name="plus" size={15} />
          New key
        </Link>
      </div>
      {showAccount && wallet ? (
        wallet.keys.length ? (
          wallet.keys.slice(0, 3).map((k) => (
            <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: '1px solid rgba(239,234,225,.06)' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.name}</span>
                <span className="mn" style={{ display: 'block', fontSize: 12, color: 'var(--vg-ink3)' }}>
                  {k.display} · {k.spentThisMonthMicros ? `${formatUsd(k.spentThisMonthMicros)} this month` : 'Not used this month'}
                </span>
              </span>
            </div>
          ))
        ) : (
          <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--vg-ink2)' }}>No keys yet. Create one to call the API.</p>
        )
      ) : (
        <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--vg-ink2)' }}>
          {signedIn ? 'Your keys appear here.' : (
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
