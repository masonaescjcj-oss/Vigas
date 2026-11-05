'use client';

import { useState } from 'react';

interface Props {
  callbackUrl: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256' | 'plain';
  app: string;
  limitMicros: number | null;
}

/** Approve / Cancel for the Sign in with Vigas consent page. */
export function ConsentButtons(props: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callbackUrl: props.callbackUrl,
          codeChallenge: props.codeChallenge,
          codeChallengeMethod: props.codeChallengeMethod,
          app: props.app,
          limitMicros: props.limitMicros,
        }),
      });
      const body = (await res.json()) as { redirectUrl?: string; error?: { message?: string } };
      if (!res.ok || !body.redirectUrl) throw new Error(body.error?.message ?? 'Authorization failed.');
      window.location.assign(body.redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authorization failed.');
      setBusy(false);
    }
  };

  const cancel = () => {
    const url = new URL(props.callbackUrl);
    url.searchParams.set('error', 'access_denied');
    window.location.assign(url.toString());
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn key" onClick={approve} disabled={busy} style={{ flex: '1 1 180px', minHeight: 50 }}>
          {busy ? 'Authorizing…' : `Allow ${props.app}`}
        </button>
        <button type="button" className="btn gh" onClick={cancel} disabled={busy} style={{ flex: '1 1 140px', minHeight: 50 }}>
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" style={{ color: 'var(--vg-red)', margin: '12px 0 0', fontSize: 14 }}>
          {error}
        </p>
      )}
    </div>
  );
}
