'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Draft-with-AI / Ignore / Restore buttons for one news inbox item. */
export function InboxActions({ id, status, articleSlug }: { id: number; status: string; articleSlug: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (action: 'draft' | 'ignore' | 'restore') => {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/news-items/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = (await res.json()) as { slug?: string; error?: { message?: string } };
      if (!res.ok) throw new Error(body.error?.message ?? `Failed (${res.status})`);
      if (action === 'draft' && body.slug) router.push(`/admin/articles/${body.slug}`);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed.');
    } finally {
      setBusy(null);
    }
  };

  if (status === 'drafted' && articleSlug) {
    return (
      <Link href={`/admin/articles/${articleSlug}`} className="btn gh" style={{ minHeight: 36, fontSize: 13 }}>
        Open draft
      </Link>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {status === 'ignored' ? (
          <button type="button" className="btn gh" disabled={busy !== null} onClick={() => act('restore')} style={{ minHeight: 36, fontSize: 13 }}>
            Restore
          </button>
        ) : (
          <>
            <button type="button" className="btn key" disabled={busy !== null} onClick={() => act('draft')} style={{ minHeight: 36, fontSize: 13 }}>
              {busy === 'draft' ? 'Writing…' : status === 'error' ? 'Retry draft' : 'Draft with AI'}
            </button>
            <button type="button" className="btn gh" disabled={busy !== null} onClick={() => act('ignore')} style={{ minHeight: 36, fontSize: 13 }}>
              Ignore
            </button>
          </>
        )}
      </div>
      {error && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--vg-red)', maxWidth: 260, textAlign: 'right' }}>
          {error}
        </span>
      )}
    </div>
  );
}
