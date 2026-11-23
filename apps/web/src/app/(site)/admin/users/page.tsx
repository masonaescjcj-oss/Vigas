import { Suspense } from 'react';
import { adminListUsers, getDb } from '@vigas/db';
import { AdminPage, AdminSkeleton } from '@/components/admin/admin-shell';
import { UsersManager } from '@/components/admin/users-manager';
import { getAdminUser } from '@/lib/admin';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Users & Credits — Admin',
  description: 'Manage Vigas accounts, promo credits, and admin roles.',
  path: '/admin/users',
  noindex: true,
});

export default function AdminUsersPage() {
  return (
    <AdminPage
      active="users"
      crumbs={[{ name: 'Users & Credits' }]}
      title={
        <>
          Users &amp; <em className="hi">credits.</em>
        </>
      }
    >
      <Suspense fallback={<AdminSkeleton />}>
        <UsersLoader />
      </Suspense>
    </AdminPage>
  );
}

async function UsersLoader() {
  const admin = await getAdminUser();
  const users = await adminListUsers(getDb()).catch(() => []);
  return <UsersManager initialUsers={users} currentUserId={admin.id} />;
}
