import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { NEWS_CATEGORIES } from '@vigas/core';
import { adminGetArticle, adminListAuthors, getDb, listModels } from '@vigas/db';
import { AdminPage, AdminSkeleton } from '@/components/admin/admin-shell';
import { ArticleEditor } from '@/components/admin/article-editor';
import { getAdminUser } from '@/lib/admin';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({ title: 'Edit article', description: 'Vigas content admin.', path: '/admin', noindex: true });

type Params = Promise<{ slug: string }>;

/** `/admin/articles/new` creates; any other slug edits that article. */
export default function EditArticlePage({ params }: { params: Params }) {
  return (
    <AdminPage active="articles" title={<>Article <em className="hi">editor.</em></>} crumbs={[{ name: 'Article' }]}>
      <Suspense fallback={<AdminSkeleton />}>
        <Editor params={params} />
      </Suspense>
    </AdminPage>
  );
}

async function Editor({ params }: { params: Params }) {
  await getAdminUser();
  const { slug } = await params;
  const db = getDb();
  const [article, authors, models] = await Promise.all([
    slug === 'new' ? Promise.resolve(null) : adminGetArticle(db, slug),
    adminListAuthors(db),
    listModels(db),
  ]);
  if (slug !== 'new' && !article) notFound();
  return (
    <ArticleEditor
      key={article?.slug ?? 'new'}
      initial={article}
      authors={authors.map((a) => ({ slug: a.slug, name: a.name }))}
      categories={[...NEWS_CATEGORIES]}
      models={models.map((m) => ({ id: m.id, name: m.name }))}
    />
  );
}
