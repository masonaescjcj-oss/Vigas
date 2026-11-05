import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { TOOL_CATEGORIES } from '@vigas/core';
import { getDb, getTool } from '@vigas/db';
import { AdminPage, AdminSkeleton } from '@/components/admin/admin-shell';
import { ToolEditor } from '@/components/admin/tool-editor';
import { getAdminUser } from '@/lib/admin';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({ title: 'Edit tool', description: 'Vigas content admin.', path: '/admin/tools', noindex: true });

type Params = Promise<{ slug: string }>;

/** `/admin/tools/new` adds a tool; any other slug edits it. */
export default function EditToolPage({ params }: { params: Params }) {
  return (
    <AdminPage active="tools" title={<>Tool <em className="hi">editor.</em></>} crumbs={[{ name: 'Tools', href: '/admin/tools' }, { name: 'Edit' }]}>
      <Suspense fallback={<AdminSkeleton />}>
        <Editor params={params} />
      </Suspense>
    </AdminPage>
  );
}

async function Editor({ params }: { params: Params }) {
  await getAdminUser();
  const { slug } = await params;
  const tool = slug === 'new' ? null : await getTool(getDb(), slug);
  if (slug !== 'new' && !tool) notFound();
  return (
    <ToolEditor
      key={tool?.slug ?? 'new'}
      categories={[...TOOL_CATEGORIES]}
      initial={
        tool && {
          slug: tool.slug,
          name: tool.name,
          tagline: tool.tagline,
          description: tool.description,
          category: tool.category,
          pricing: tool.pricing,
          rating: tool.rating,
          color: tool.color,
          letter: tool.letter,
          url: tool.url,
          runsOnVigas: tool.runsOnVigas,
          isNew: tool.isNew,
        }
      }
    />
  );
}
