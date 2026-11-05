import { Suspense } from 'react';
import { adminListNewsItems, getDb } from '@vigas/db';
import { AdminPage, AdminSkeleton, StatusBadge } from '@/components/admin/admin-shell';
import { InboxActions } from '@/components/admin/inbox-actions';
import { getAdminUser } from '@/lib/admin';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({ title: 'News inbox', description: 'Vigas content admin.', path: '/admin/inbox', noindex: true });

export default function InboxPage() {
  return (
    <AdminPage active="inbox" title={<>News <em className="hi">inbox.</em></>} crumbs={[{ name: 'News inbox' }]}>
      <p style={{ color: 'var(--vg-ink2)', margin: '-8px 0 20px', maxWidth: 720 }}>
        Stories collected from your feeds by <code className="mn">pnpm --filter @vigas/db ingest-news</code>. “Draft with AI” writes an original brief
        with a source link as an unpublished draft, billed to your account. Nothing is published until you press Publish in the editor.
      </p>
      <Suspense fallback={<AdminSkeleton />}>
        <Inbox />
      </Suspense>
    </AdminPage>
  );
}

async function Inbox() {
  await getAdminUser();
  const items = await adminListNewsItems(getDb(), { statuses: ['new', 'error', 'drafted', 'ignored'], limit: 100 });
  if (items.length === 0) {
    return (
      <div className="card" style={{ borderRadius: 20, padding: 20 }}>
        <p style={{ margin: 0, color: 'var(--vg-ink2)' }}>
          The inbox is empty. Add feeds with <code className="mn">NEWS_FEEDS=&quot;Name|https://example.com/feed.xml&quot;</code> and run the ingest job.
        </p>
      </div>
    );
  }
  return (
    <div className="card" style={{ padding: 0, borderRadius: 20, overflow: 'hidden' }}>
      {items.map((it, i) => (
        <article key={it.id} style={{ display: 'flex', gap: 16, padding: '16px 20px', borderTop: i ? '1px solid var(--vg-line)' : undefined, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 420px', minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusBadge status={it.status} />
              <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
                {it.sourceName}
                {it.publishedAt ? ` · ${it.publishedAt.slice(0, 10)}` : ''}
              </span>
            </div>
            <h2 className="sf" style={{ fontSize: 22, lineHeight: 1.2, margin: '6px 0' }}>
              <a href={it.url} target="_blank" rel="noopener noreferrer nofollow">
                {it.title}
              </a>
            </h2>
            {it.summary && <p style={{ margin: 0, color: 'var(--vg-ink2)', fontSize: 14 }}>{it.summary.slice(0, 280)}</p>}
            {it.error && <p style={{ margin: '6px 0 0', color: 'var(--vg-red)', fontSize: 13 }}>Last draft failed: {it.error}</p>}
          </div>
          <InboxActions id={it.id} status={it.status} articleSlug={it.articleSlug} />
        </article>
      ))}
    </div>
  );
}
