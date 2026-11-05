'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { ApiError } from '@vigas/api-client';
import { api, notifyAuthChanged, safeNext } from '@/lib/client/session';

export function AuthForm({ mode }: { mode: 'signin' | 'signup' }) {
  const router = useRouter();
  const id = useId();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [nextQs, setNextQs] = useState('');
  const signup = mode === 'signup';

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get('next');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carries ?next= over to the other auth page
    if (next) setNextQs(`?next=${encodeURIComponent(next)}`);
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (signup && password.length < 8) {
      setError({ message: 'Password must be at least 8 characters.' });
      return;
    }
    setBusy(true);
    try {
      if (signup) await api.signup({ email, password, name: name.trim() || undefined });
      else await api.login({ email, password });
      notifyAuthChanged();
      router.replace(safeNext('/dashboard'));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) setError({ message: err.message, code: err.code });
      else setError({ message: 'Could not reach Vigas. Check your connection and try again.' });
      setBusy(false);
    }
  };

  const label = { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--vg-ink2)' } as const;

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {signup && (
        <div>
          <label htmlFor={`${id}-name`} style={label}>
            Name <span style={{ color: 'var(--vg-ink3)' }}>(optional)</span>
          </label>
          <input id={`${id}-name`} className="input" autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      )}
      <div>
        <label htmlFor={`${id}-email`} style={label}>
          Email
        </label>
        <input
          id={`${id}-email`}
          className="input"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
        />
      </div>
      <div>
        <label htmlFor={`${id}-pw`} style={label}>
          Password
        </label>
        <input
          id={`${id}-pw`}
          className="input"
          type="password"
          required
          minLength={signup ? 8 : 1}
          autoComplete={signup ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${error ? `${id}-err ` : ''}${id}-pwhint`}
        />
        <p id={`${id}-pwhint`} className="mn" style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--vg-ink3)' }}>
          {signup ? 'At least 8 characters.' : ' '}
        </p>
      </div>
      {error && (
        <div id={`${id}-err`} role="alert" className="notice err">
          <span>
            {error.message}
            {error.code === 'email_taken' && (
              <>
                {' '}
                <Link href={`/signin${nextQs}`} style={{ color: 'var(--vg-ink)', textDecoration: 'underline' }}>
                  Sign in
                </Link>
              </>
            )}
          </span>
        </div>
      )}
      <button type="submit" className="btn key" disabled={busy} style={{ minHeight: 50, fontSize: 15 }}>
        {busy ? (signup ? 'Creating your account…' : 'Signing in…') : signup ? 'Create account' : 'Sign in'}
      </button>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--vg-ink2)', textAlign: 'center' }}>
        {signup ? 'Already have an account? ' : 'New to Vigas? '}
        <Link href={`${signup ? '/signin' : '/signup'}${nextQs}`} style={{ color: 'var(--vg-indigo)', fontWeight: 500 }}>
          {signup ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </form>
  );
}
