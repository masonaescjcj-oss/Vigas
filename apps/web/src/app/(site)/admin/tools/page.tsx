import Link from 'next/link';
import { Suspense } from 'react';
import { getDb, listTools } from '@vigas/db';
import { AdminPage, AdminSkeleton } from '@/components/admin/admin-shell';
import { getAdminUser } from '@/lib/admin';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({ title: 'Tools admin', description: 'Vigas content admin.', path: '/admin/tools', noindex: true });

export default function AdminToolsPage() {
  return (
    <AdminPage
      active="tools"
      title={<>Tools <em className="hi">directory.</em></>}
      crumbs={[{ name: 'Tools' }]}
      actions={
        <Link href="/admin/tools/new" className="btn key">
          Add tool
        </Link>
      }
    >
      <Suspense fallback={<AdminSkeleton />}>
        <ToolList />
      </Suspense>
    </AdminPage>
  );
}

async function ToolList() {
  await getAdminUser();
  const tools = await listTools(getDb(), { limit: 200 });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
      {tools.map((t) => (
        <Link key={t.slug} href={`/admin/tools/${t.slug}`} className="card" style={{ borderRadius: 16, display: 'flex', gap: 12, alignItems: 'center', padding: 16 }}>
          <span aria-hidden="true" className="sf" style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', fontSize: 18, background: `${t.color}26`, color: t.color, flexShrink: 0 }}>
            {t.letter}
          </span>
          <span style={{ minWidth: 0 }}>
            <b style={{ display: 'block', fontWeight: 600 }}>{t.name}</b>
            <span className="mn" style={{ fontSize: 12, color: 'var(--vg-ink3)' }}>
              {t.category} · {t.pricing} · ▲ {t.votes.toLocaleString('en-US')}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
