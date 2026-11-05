'use client';

import { useState } from 'react';

/** The Daily Token sign-up. The newsletter is not live yet, so nothing is stored. */
export function NewsletterForm({ variant = 'card' }: { variant?: 'card' | 'orange' }) {
  const [done, setDone] = useState(false);
  const orange = variant === 'orange';
  const note = done ? 'Sign-ups for The Daily Token open soon — nothing was stored yet.' : 'Free · Unsubscribe anytime';
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setDone(true);
      }}
      style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
    >
      <label style={{ flex: orange ? '1 1 100%' : '1 1 220px', minWidth: 0 }}>
        <span className={orange ? 'sr-only' : 'lbl'} style={orange ? undefined : { display: 'block', marginBottom: 8 }}>
          {orange ? 'Email' : 'Work email'}
        </span>
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          className="input"
          style={orange ? { height: 46, border: 0, background: 'var(--vg-on-orange)', borderRadius: 11 } : { height: 50 }}
        />
      </label>
      <button
        type="submit"
        className={orange ? 'btn dark-btn' : 'btn key'}
        style={orange ? { width: '100%' } : { alignSelf: 'flex-end', minHeight: 50, padding: '0 24px' }}
      >
        {orange ? 'Subscribe free' : 'Subscribe'}
      </button>
      <p
        role="status"
        className="mn"
        style={{ flexBasis: '100%', margin: '2px 0 0', fontSize: 12, color: orange ? 'var(--vg-on-orange)' : 'var(--vg-ink3)' }}
      >
        {note}
      </p>
    </form>
  );
}
