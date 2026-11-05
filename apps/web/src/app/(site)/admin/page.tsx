import Link from 'next/link';
import { Suspense } from 'react';
import { adminListArticles, getDb } from '@vigas/db';
import { AdminPage, AdminSkeleton, StatusBadge } from '@/components/admin/admin-shell';
import { getAdminUser } from '@/lib/admin';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({ title: 'Admin', description: 'Vigas content admin.', path: '/admin', noindex: true });

export default function AdminArticlesPage() {
  return (
    <AdminPage
      active="articles"
      title={
        <>
          News <em className="hi">desk.</em>
        </>
      }
      actions={
        <Link href="/admin/articles/new" className="btn key">
          New article
        </Link>
      }
    >
      <Suspense fallback={<AdminSkeleton />}>
        <ArticleList />
      </Suspense>
    </AdminPage>
  );
}

async function ArticleList() {
  await getAdminUser();
  const rows = await adminListArticles(getDb(), { limit: 100 });
  if (rows.length === 0) return <p style={{ color: 'var(--vg-ink2)' }}>No articles yet.</p>;
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 20 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720, fontSize: 14 }}>
          <thead>
            <tr className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)', textTransform: 'uppercase', letterSpacing: '.07em', textAlign: 'left', background: 'var(--vg-bg2)' }}>
              <th style={{ padding: '12px 18px', fontWeight: 500 }}>Title</th>
              <th style={{ padding: '12px 10px', fontWeight: 500 }}>Section</th>
              <th style={{ padding: '12px 10px', fontWeight: 500 }}>Status</th>
              <th style={{ padding: '12px 10px', fontWeight: 500 }}>Author</th>
              <th style={{ padding: '12px 18px', fontWeight: 500 }}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.slug} style={{ borderTop: '1px solid var(--vg-line)' }}>
                <td style={{ padding: '12px 18px', maxWidth: 460 }}>
                  <Link href={`/admin/articles/${a.slug}`} style={{ fontWeight: 500 }}>
                    {a.title}
                  </Link>
                  {a.status === 'published' && (
                    <Link href={`/news/${a.slug}`} className="mn" style={{ display: 'block', fontSize: 12, color: 'var(--vg-indigo)', marginTop: 2 }}>
                      /news/{a.slug}
                    </Link>
                  )}
                </td>
                <td style={{ padding: '12px 10px', color: 'var(--vg-ink2)' }}>{a.category}</td>
                <td style={{ padding: '12px 10px' }}>
                  <StatusBadge status={a.status} />
                </td>
                <td style={{ padding: '12px 10px', color: 'var(--vg-ink2)' }}>{a.authorName}</td>
                <td className="mn" style={{ padding: '12px 18px', fontSize: 12, color: 'var(--vg-ink3)', whiteSpace: 'nowrap' }}>
                  {a.updatedAt.slice(0, 16).replace('T', ' ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
