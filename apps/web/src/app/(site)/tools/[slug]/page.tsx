import type { Metadata } from 'next';
import Link from 'next/link';
import { cacheLife, cacheTag } from 'next/cache';
import { notFound } from 'next/navigation';
import { withAlpha } from '@vigas/tokens';
import { SiteHeader } from '@/components/site-header';
import { ToolVote } from '@/components/tools/vote-button';
import { Breadcrumb, Icon, JsonLd, Mark } from '@/components/ui';
import { getToolBySlug, getTools } from '@/lib/data';
import { breadcrumbLd, pageMetadata } from '@/lib/seo';

const APP_CATEGORY: Record<string, string> = {
  Agents: 'DeveloperApplication',
  Coding: 'DeveloperApplication',
  Research: 'ReferenceApplication',
  Image: 'MultimediaApplication',
  Video: 'MultimediaApplication',
  Audio: 'MultimediaApplication',
  Productivity: 'BusinessApplication',
};

const host = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export async function generateStaticParams() {
  const tools = await getTools({ sort: 'votes' });
  return tools.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps<'/tools/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const tool = await getToolBySlug(slug);
  if (!tool) return { title: 'Tool not found', robots: { index: false } };
  return pageMetadata({
    title: `${tool.name} — ${tool.tagline.replace(/\.$/, '')}`,
    description: `${tool.name} review: ${tool.description} Pricing: ${tool.pricing}. Rated ${tool.rating.toFixed(1)}/5 by builders on Vigas.`,
    path: `/tools/${tool.slug}`,
  });
}

export default async function ToolPage({ params }: PageProps<'/tools/[slug]'>) {
  const { slug } = await params;
  if (slug.length > 200 || !(await getToolBySlug(slug))) notFound();
  return (
    <>
      <SiteHeader active="tools" />
      <main id="main" className="wrap">
        <ToolView slug={slug} />
      </main>
    </>
  );
}

async function ToolView({ slug }: { slug: string }) {
  'use cache';
  cacheLife('catalog');
  cacheTag('tools', `tool:${slug}`);
  const [tool, all] = await Promise.all([getToolBySlug(slug), getTools({ sort: 'votes' })]);
  if (!tool) notFound();
  const rank = all.findIndex((t) => t.slug === tool.slug) + 1;
  const categoryRank = all.filter((t) => t.category === tool.category).findIndex((t) => t.slug === tool.slug) + 1;
  const similar = [...all.filter((t) => t.category === tool.category && t.slug !== tool.slug), ...all.filter((t) => t.category !== tool.category)].slice(0, 3);

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: tool.name,
      description: tool.description,
      applicationCategory: APP_CATEGORY[tool.category] ?? 'WebApplication',
      operatingSystem: 'Web',
      url: tool.url,
      offers:
        tool.pricing === 'Paid'
          ? { '@type': 'Offer', availability: 'https://schema.org/InStock', url: tool.url }
          : { '@type': 'Offer', price: '0', priceCurrency: 'USD', url: tool.url },
      aggregateRating: { '@type': 'AggregateRating', ratingValue: tool.rating.toFixed(1), bestRating: '5', worstRating: '1', ratingCount: tool.votes },
    },
    breadcrumbLd([
      { name: 'Home', path: '/' },
      { name: 'Tools', path: '/tools' },
      { name: tool.name, path: `/tools/${tool.slug}` },
    ]),
  ];

  const facts: Array<[string, string]> = [
    ['Category', tool.category],
    ['Pricing', tool.pricing],
    ['Rating', `★ ${tool.rating.toFixed(1)} / 5`],
    ['Upvotes', tool.votes.toLocaleString('en-US')],
    ['Rank', `#${rank} overall · #${categoryRank} in ${tool.category}`],
    ['Website', host(tool.url)],
  ];

  return (
    <>
      <JsonLd data={ld} />
      <Breadcrumb
        items={[
          { name: 'Home', href: '/' },
          { name: 'Tools', href: '/tools' },
          { name: tool.category, href: `/tools?category=${tool.category}#dir` },
          { name: tool.name },
        ]}
        style={{ paddingTop: 28 }}
      />

      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 40, padding: '28px 0 56px', alignItems: 'stretch', borderBottom: '1px solid var(--vg-line)' }}>
        <div style={{ flex: '1.4 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Mark color={tool.color} letter={tool.letter} size={84} radius={22} fontSize={40} />
            <div>
              <div className="lbl" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {tool.category} · {tool.pricing}
                {tool.isNew && <span style={{ color: 'var(--vg-sand)' }}>· New</span>}
              </div>
              <h1 className="sf" style={{ fontSize: 'clamp(48px,6vw,84px)', lineHeight: 0.96, letterSpacing: '-.03em', margin: '8px 0 0' }}>
                {tool.name}
              </h1>
            </div>
          </div>
          <p className="sf" style={{ fontSize: 'clamp(22px,2.2vw,28px)', lineHeight: 1.3, color: 'var(--vg-ink)', margin: 0, maxWidth: 680 }}>
            <em className="hi">{tool.tagline}</em>
          </p>
          <p style={{ fontSize: 17, color: 'var(--vg-ink2)', margin: 0, maxWidth: 640 }}>{tool.description}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
            <a href={tool.url} className="btn key" target="_blank" rel="noopener noreferrer" style={{ minHeight: 50, padding: '0 22px', fontSize: 15 }}>
              Visit {host(tool.url)}
              <Icon name="external" size={16} />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <ToolVote slug={tool.slug} name={tool.name} votes={tool.votes} />
          </div>
        </div>

        <aside aria-label="At a glance" className="card" style={{ flex: '1 1 320px', minWidth: 0, borderRadius: 22, padding: 22, alignSelf: 'flex-start' }}>
          <h2 className="lbl" style={{ margin: '0 0 6px' }}>
            At a glance
          </h2>
          <dl style={{ margin: 0 }}>
            {facts.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderTop: '1px solid rgba(239,234,225,.06)', fontSize: 14 }}>
                <dt style={{ color: 'var(--vg-ink3)' }}>{k}</dt>
                <dd className="mn" style={{ margin: 0, textAlign: 'right', fontSize: 13 }}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          {tool.runsOnVigas && (
            <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: withAlpha('#FF6A1A', 0.08), border: '1px solid rgba(255,106,26,.3)', display: 'flex', gap: 10 }}>
              <Icon name="verified" size={18} style={{ color: 'var(--vg-blue)', marginTop: 2 }} />
              <p style={{ margin: 0, fontSize: 14, color: 'var(--vg-ink2)' }}>
                <b style={{ color: 'var(--vg-ink)', fontWeight: 500 }}>Runs on the Vigas API.</b> Use your Vigas key and credits — no separate model subscription.
              </p>
            </div>
          )}
        </aside>
      </section>

      <section aria-labelledby="why" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(260px,100%),1fr))', gap: 16, padding: '56px 0' }}>
        <h2 id="why" className="sr-only">
          Why builders pick {tool.name}
        </h2>
        {[
          ['var(--vg-orange)', 'What it does', tool.tagline],
          ['var(--vg-sand)', 'Who it’s for', `Builders and teams looking for a ${tool.category.toLowerCase()} tool${tool.pricing === 'Free' ? ' that costs nothing to start' : tool.pricing === 'Freemium' ? ' with a free tier to try first' : ' worth paying for'}.`],
          [
            'var(--vg-ink3)',
            'How it ranks',
            `#${categoryRank} of ${all.filter((t) => t.category === tool.category).length} in ${tool.category} and #${rank} of ${all.length} overall, by builder upvotes on Vigas.`,
          ],
        ].map(([c, t, d]) => (
          <div key={t} style={{ borderTop: `2px solid ${c}`, paddingTop: 18 }}>
            <h3 className="sf" style={{ fontSize: 26, margin: '0 0 6px', fontWeight: 400 }}>
              {t}
            </h3>
            <p style={{ margin: 0, color: 'var(--vg-ink2)' }}>{d}</p>
          </div>
        ))}
      </section>

      {similar.length > 0 && (
        <section aria-labelledby="similar" style={{ paddingBottom: 64 }}>
          <div className="lbl">§ Alternatives</div>
          <h2 id="similar" className="sf" style={{ fontSize: 'clamp(32px,3.4vw,46px)', margin: '10px 0 22px', letterSpacing: '-.02em', lineHeight: 1.04 }}>
            More <em className="hi">{tool.category.toLowerCase()}</em> tools
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(300px,100%),1fr))', gap: 14 }}>
            {similar.map((t) => (
              <Link key={t.slug} href={`/tools/${t.slug}`} className="lift card" style={{ borderRadius: 18, padding: 18, display: 'flex', gap: 12, alignItems: 'flex-start', color: 'var(--vg-ink)' }}>
                <Mark color={t.color} letter={t.letter} size={48} radius={13} fontSize={21} />
                <span style={{ minWidth: 0 }}>
                  <b style={{ display: 'block', fontWeight: 600 }}>{t.name}</b>
                  <span style={{ display: 'block', color: 'var(--vg-ink2)', fontSize: 14, lineHeight: 1.45, marginTop: 3 }}>{t.tagline}</span>
                  <span className="mn" style={{ display: 'block', fontSize: 12, color: 'var(--vg-ink3)', marginTop: 8 }}>
                    {t.category} · {t.pricing} · ★ {t.rating.toFixed(1)} · ▲ {t.votes.toLocaleString('en-US')}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section
        style={{
          marginBottom: 96,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 24,
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'clamp(22px,3vw,40px)',
          borderRadius: 24,
          background: 'var(--vg-surface)',
          border: '1px solid rgba(255,106,26,.32)',
        }}
      >
        <div style={{ flex: '1 1 420px' }}>
          <h2 className="sf" style={{ fontSize: 'clamp(30px,3.2vw,44px)', margin: 0, lineHeight: 1.04, fontWeight: 400 }}>
            Building your own? <em className="hi">One key, every model.</em>
          </h2>
          <p style={{ margin: '10px 0 0', color: 'var(--vg-ink2)', maxWidth: 560 }}>
            Vigas routes to every frontier model through one OpenAI-compatible endpoint, with prepaid credits and honest prices.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/models" className="btn key" style={{ minHeight: 50 }}>
            See model prices
          </Link>
          <Link href="/tools" className="btn gh" style={{ minHeight: 50 }}>
            All tools
          </Link>
        </div>
      </section>
    </>
  );
}
