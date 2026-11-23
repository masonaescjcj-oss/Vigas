import { Suspense } from 'react';
import { adminListCatalog, getDb } from '@vigas/db';
import { AdminPage, AdminSkeleton } from '@/components/admin/admin-shell';
import { ModelsManager } from '@/components/admin/models-manager';
import { getAdminUser } from '@/lib/admin';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Models & Routing — Admin',
  description: 'Manage public models, retail pricing, and upstream endpoint mappings.',
  path: '/admin/models',
  noindex: true,
});

export default function AdminModelsPage() {
  return (
    <AdminPage
      active="models"
      crumbs={[{ name: 'Models & Routing' }]}
      title={
        <>
          Models &amp; <em className="hi">routing.</em>
        </>
      }
    >
      <Suspense fallback={<AdminSkeleton />}>
        <ModelsLoader />
      </Suspense>
    </AdminPage>
  );
}

async function ModelsLoader() {
  await getAdminUser();
  const models = await adminListCatalog(getDb()).catch(() => []);
  return <ModelsManager initialModels={models} />;
}
