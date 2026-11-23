import { Suspense } from 'react';
import { adminListUpstreamProviders, getDb } from '@vigas/db';
import { AdminPage, AdminSkeleton } from '@/components/admin/admin-shell';
import { ProvidersManager } from '@/components/admin/providers-manager';
import { getAdminUser } from '@/lib/admin';
import { fetchGatewayPools } from '@/lib/admin-gateway';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Providers & Multi-Key Pools — Admin',
  description: 'Manage upstream AI providers, multi-key rotation pools, and model allowlists.',
  path: '/admin/providers',
  noindex: true,
});

export default function AdminProvidersPage() {
  return (
    <AdminPage
      active="providers"
      crumbs={[{ name: 'Providers & Keys' }]}
      title={
        <>
          Upstream <em className="hi">pools.</em>
        </>
      }
    >
      <Suspense fallback={<AdminSkeleton />}>
        <ProvidersLoader />
      </Suspense>
    </AdminPage>
  );
}

async function ProvidersLoader() {
  await getAdminUser();
  const [providers, gateway] = await Promise.all([
    adminListUpstreamProviders(getDb()).catch(() => []),
    fetchGatewayPools(),
  ]);
  return <ProvidersManager initialProviders={providers} initialGateway={gateway} />;
}
