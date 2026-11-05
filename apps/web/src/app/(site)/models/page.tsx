import { cacheLife, cacheTag } from 'next/cache';
import { orgMark } from '@vigas/tokens';
import { CopyButton } from '@/components/copy-button';
import { CreditsCard } from '@/components/credits-card';
import { ModelsCatalogue } from '@/components/models-catalogue';
import { QuickstartTabs } from '@/components/quickstart-tabs';
import { SiteHeader } from '@/components/site-header';
import { Breadcrumb, Icon, JsonLd, type IconName } from '@/components/ui';
import { getModels } from '@/lib/data';
import { API_BASE_URL } from '@/lib/env';
import { breadcrumbLd, faqLd, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'AI models & API pricing — every model, one key',
  description:
    'Compare per-token prices and context windows for Claude, GPT, Gemini, DeepSeek, Kimi and more. One OpenAI-compatible API key, prepaid credits and zero markup on your first $5.',
  path: '/models',
});

const FEATURES: Array<{ icon: IconName; t: string; d: string }> = [
  { icon: 'refresh', t: 'Automatic fallbacks', d: 'If a provider is down or rate-limited, the request moves to the next one — same response format.' },
  { icon: 'bolt', t: 'Route by price or speed', d: 'Sort candidates by cost, latency or quality per request, or let vigas/auto decide.' },
  { icon: 'wallet', t: 'One bill, every provider', d: 'Prepaid credits across every provider. No separate accounts, no surprise invoices.' },
  { icon: 'chart', t: 'Usage you can read', d: 'Per-key spend, tokens and daily usage — in the dashboard and in the Android app.' },
];

const FAQ = [
  { q: 'Is Vigas compatible with the OpenAI SDK?', a: `Yes. Point base_url at ${API_BASE_URL}, use your Vigas key, and pick any model ID from this page.` },
  {
    q: 'How is pricing calculated?',
    a: 'You pay each provider’s per-token price, shown above. The first $5 of credits has no markup; after that a small platform fee is shown before you pay.',
  },
  { q: 'What happens when a provider goes down?', a: 'With fallbacks on, Vigas retries the same request on the next best provider and tells you which one answered.' },
  { q: 'Can I use the same key in Vigas Chat and RetroBuild?', a: 'Yes. One account, one balance — every Vigas product draws from the same credits.' },
];

export default async function ModelsPage() {
  'use cache';
  cacheLife('content');
  cacheTag('models');
  const models = await getModels();
  const orgs = [...new Set(models.map((m) => m.org))];
  const providers = orgs.map((name) => ({ name, ...orgMark(name) }));
  const rows = models.map((m) => ({ ...m, ...orgMark(m.org) }));
  // Median blended price (3 input : 1 output) of paid models, for the "≈ tokens" estimate.
  const blended = models
    .map((m) => Math.round((m.inputPerMillionMicros * 3 + m.outputPerMillionMicros) / 4))
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const median = blended.length ? blended[Math.floor(blended.length / 2)]! : 0;
  const example = models.find((m) => m.id === 'anthropic/claude-opus-5.5')?.id ?? models[0]?.id ?? 'vigas/auto';

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: 'Home', path: '/' },
            { name: 'Models', path: '/models' },
          ]),
          faqLd(FAQ),
        ]}
      />
      <SiteHeader active="models" />
      <main id="main" className="wrap">
        <Breadcrumb items={[{ name: 'Home', href: '/' }, { name: 'Models' }]} style={{ paddingTop: 28 }} />
        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 32,
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            padding: '22px 0 40px',
            borderBottom: '1px solid var(--vg-line)',
          }}
        >
          <div style={{ flex: '1 1 560px', minWidth: 0 }}>
            <div className="lbl" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span className="led" />
              API · OpenAI-compatible
            </div>
            <h1 className="sf" style={{ fontSize: 'clamp(46px,6vw,84px)', lineHeight: 0.98, letterSpacing: '-.03em', margin: '16px 0' }}>
              Every model, <em className="hi">one price sheet.</em>
            </h1>
            <p style={{ fontSize: 18, color: 'var(--vg-ink2)', maxWidth: 600, margin: 0 }}>
              Prices per 1M tokens, passed through from each provider. Zero markup on your first $5 — then one simple fee, shown before you pay.
            </p>
          </div>
          <div style={{ flex: '0 1 auto', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, maxWidth: '100%' }}>
            <span className="lbl" id="base-url">
              Base URL
            </span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 6px 6px 16px',
                borderRadius: 12,
                background: 'var(--vg-surface)',
                border: '1px solid var(--vg-line2)',
              }}
            >
              <code className="mn" aria-labelledby="base-url" style={{ fontSize: 14, color: 'var(--vg-green)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {API_BASE_URL}
              </code>
              <CopyButton text={API_BASE_URL} label="Copy base URL" style={{ marginLeft: 'auto' }} />
            </div>
          </div>
        </header>

        <ModelsCatalogue models={rows} providers={providers} />

        <section id="quickstart" aria-labelledby="quickstart-title" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, paddingBottom: 72, scrollMarginTop: 24 }}>
          <div className="card" style={{ flex: '1.6 1 520px', minWidth: 0, borderRadius: 22, padding: 24 }}>
            <QuickstartTabs baseUrl={API_BASE_URL} exampleModel={example} />
          </div>
          <CreditsCard blendedPerMillionMicros={median} />
        </section>

        <section aria-label="Gateway features" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16, paddingBottom: 72 }}>
          {FEATURES.map((f) => (
            <div key={f.t} className="card" style={{ padding: 22 }}>
              <span style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--vg-orange-soft)', color: 'var(--vg-orange)' }}>
                <Icon name={f.icon} size={20} />
              </span>
              <h3 className="sf" style={{ fontSize: 24, margin: '16px 0 6px', fontWeight: 400, letterSpacing: '-.01em' }}>
                {f.t}
              </h3>
              <p style={{ margin: 0, color: 'var(--vg-ink2)', fontSize: 14 }}>{f.d}</p>
            </div>
          ))}
        </section>

        <section aria-labelledby="faq" style={{ display: 'flex', flexWrap: 'wrap', gap: 40, paddingBottom: 96 }}>
          <div style={{ flex: '1 1 320px' }}>
            <div className="lbl">§ FAQ</div>
            <h2 id="faq" className="sf" style={{ fontSize: 'clamp(34px,3.6vw,48px)', lineHeight: 1.04, margin: '12px 0 0', letterSpacing: '-.02em' }}>
              Questions developers <em className="hi">actually ask.</em>
            </h2>
          </div>
          <div style={{ flex: '2 1 560px', minWidth: 0 }}>
            {FAQ.map((f) => (
              <details key={f.q} style={{ borderTop: '1px solid rgba(239,234,225,.1)', padding: '4px 0' }}>
                <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', fontSize: 17, fontWeight: 500 }}>
                  <h3 style={{ margin: 0, font: 'inherit' }}>{f.q}</h3>
                  <Icon name="plus" size={20} className="pm" style={{ color: 'var(--vg-orange)' }} />
                </summary>
                <p style={{ margin: '0 0 18px', color: 'var(--vg-ink2)', maxWidth: 680 }}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
