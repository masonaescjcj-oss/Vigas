'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ClearDemoButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const run = async () => {
    if (!window.confirm('Delete all prototype sample articles from the database? Original articles you wrote will stay untouched.')) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/articles/demo', { method: 'DELETE' });
      const data = (await res.json()) as { deleted?: number; error?: { message?: string } };
      if (!res.ok) throw new Error(data.error?.message ?? 'Could not clear demo articles.');
      setStatus(`Removed ${data.deleted ?? 0} demo stories.`);
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <button type="button" className="btn gh" disabled={busy} onClick={run}>
        {busy ? 'Clearing…' : 'Clear demo articles'}
      </button>
      {status && (
        <span className="mn" role="status" style={{ fontSize: 12, color: 'var(--vg-ink2)' }}>
          {status}
        </span>
      )}
    </div>
  );
}
