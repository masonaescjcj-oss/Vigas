import { cacheLife, cacheTag } from 'next/cache';
import { formatContext, formatPricePerMillion } from '@vigas/core';
import { orgMark } from '@vigas/tokens';
import { CreditsCard } from '@/components/credits-card';
import { ModelsCatalogue } from '@/components/models-catalogue';
import { TokenCalculatorCard } from '@/components/models/token-calculator';
import { QuickstartTabs } from '@/components/quickstart-tabs';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { Breadcrumb, Icon, JsonLd, type IconName } from '@/components/ui';
import { getModels } from '@/lib/data';
import { absoluteUrl, API_BASE_URL } from '@/lib/env';
import { breadcrumbLd, faqLd } from '@/lib/seo';

const EN_FEATURES: Array<{ icon: IconName; t: string; d: string }> = [
  { icon: 'refresh', t: 'Automatic fallbacks', d: 'If a provider is down or rate-limited, the request moves to the next one — same response format.' },
  { icon: 'bolt', t: 'Fastest edge routing', d: 'Route requests by latency, lowest price or live quality score, or let vigas/auto pick the fastest healthy endpoint.' },
  { icon: 'wallet', t: 'Lowest pass-through prices', d: 'Prepaid credits across every provider with $0 markup on your first $5 and zero hidden surcharges.' },
  { icon: 'chart', t: 'Usage you can read', d: 'Per-key spend, tokens and daily usage — in your dashboard with optional monthly caps.' },
];

const FA_FEATURES: Array<{ icon: IconName; t: string; d: string }> = [
  { icon: 'refresh', t: 'Failover خودکار', d: 'اگر یکی از ارائه‌دهندگان با خطا یا محدودیت مواجه شود، درخواست بدون تغییر فرمت به گره جایگزین منتقل می‌شود.' },
  { icon: 'bolt', t: 'مسیریابی سریع از لبه', d: 'مسیریابی هوشمند بر اساس تأخیر، کمترین قیمت یا امتیاز کیفیت زنده؛ یا سپردن انتخاب به vigas/auto.' },
  { icon: 'wallet', t: 'کمترین تعرفه مستقیم', d: 'انتقال نرخ اصلی توکن‌های آزمایشگاه‌ها بدون کارمزد روی ۵ دلار اول و بدون هزینه پنهان.' },
  { icon: 'chart', t: 'گزارش مصرف شفاف', d: 'ردیابی هزینه، توکن و مصرف روزانه برای هر کلید در داشبورد با امکان تعیین سقف ماهانه.' },
];

const EN_FAQ = [
  { q: 'Is Vigas compatible with the OpenAI SDK?', a: `Yes. Point base_url at ${API_BASE_URL}, use your Vigas key, and pick any model ID from this page.` },
  {
    q: 'How is pricing calculated?',
    a: 'You pay each provider’s per-token price, shown above. The first $5 of credits has no markup; after that a small platform fee is shown before you pay.',
  },
  { q: 'What happens when a provider goes down?', a: 'With fallbacks on, Vigas retries the same request on the next best provider and tells you which one answered.' },
  { q: 'Which tools and SDKs work with a Vigas API key?', a: 'Any client supporting OpenAI-compatible endpoints works out of the box — including the official Python and TypeScript SDKs, Cursor, Cline, OpenCode, and production backends.' },
];

const FA_FAQ = [
  { q: 'آیا ویگاس با SDK رسمی OpenAI سازگار است؟', a: `بله. کافی است base_url را روی ${API_BASE_URL} تنظیم کنید، کلید ویگاس را قرار دهید و هر شناسه مدلی را از همین صفحه انتخاب کنید.` },
  {
    q: 'محاسبه قیمت توکن‌ها چگونه انجام می‌شود؟',
    a: 'دقیقاً نرخ پایه هر ارائه‌دهنده که در جدول بالا نمایش داده می‌شود را می‌پردازید. تا ۵ دلار اول کارمزد ویگاس صفر است و پس از آن کارمزد ناچیز پیش از پرداخت شفاف نمایش داده می‌شود.',
  },
  { q: 'اگر یک ارائه‌دهنده از دسترس خارج شود چه اتفاقی می‌افتد؟', a: 'با فعال بودن Failover خودکار، ویگاس بلافاصله همان درخواست را روی بهترین ارائه‌دهنده جایگزین اجرا کرده و پاسخ می‌دهد.' },
  { q: 'کدام ابزارها و کلاینت‌ها با کلید ویگاس کار می‌کنند؟', a: 'هر ابزار یا کد سازگار با استاندارد OpenAI، از جمله SDKهای Python و TypeScript، Cursor، Cline، OpenCode و سرویس‌های سرور شما.' },
];

export async function ModelsView({ lang = 'en' }: { lang?: 'en' | 'fa' }) {
  'use cache';
  cacheLife('content');
  cacheTag('models');

  const isFa = lang === 'fa';
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

  const features = isFa ? FA_FEATURES : EN_FEATURES;
  const faq = isFa ? FA_FAQ : EN_FAQ;

  const modelsListLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: isFa ? 'مدل‌های هوش مصنوعی و تعرفه زنده API' : 'AI Models & Live API Token Pricing',
    description: isFa
      ? 'مقایسه قیمت توکن، پنجره متنی و سرعت مدل‌های هوش مصنوعی در گیت‌وی ویگاس.'
      : 'Live pass-through token pricing and context windows across frontier AI models on the Vigas OpenAI-compatible API gateway.',
    url: absoluteUrl('/models'),
    inLanguage: lang,
    mainEntity: {
      '@type': 'ItemList',
      name: isFa ? 'فهرست مدل‌های API هوش مصنوعی' : 'Frontier AI API models',
      numberOfItems: models.length,
      itemListElement: models.map((m, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: `${m.name} (${m.id})`,
        url: absoluteUrl(`/models?q=${encodeURIComponent(m.id)}`),
        description: `${m.org} · ${formatContext(m.contextLength)} context · ${formatPricePerMillion(m.inputPerMillionMicros)} input / ${formatPricePerMillion(m.outputPerMillionMicros)} output per 1M tokens`,
      })),
    },
  };

  const content = (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: isFa ? 'خانه' : 'Home', path: isFa ? '/fa' : '/' },
            { name: isFa ? 'مدل‌ها و تعرفه' : 'Models', path: '/models' },
          ]),
          modelsListLd,
          faqLd(faq),
        ]}
      />
      <SiteHeader active="models" lang={lang} />
      <main id="main">
        {/* Obsidian Signal 2026 Full-Bleed PageHead */}
        <section style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--vg-line)' }}>
          <div
            aria-hidden="true"
            className="dot-grid"
            style={{
              position: 'absolute',
              inset: 0,
              WebkitMaskImage: 'linear-gradient(to bottom, #000, transparent)',
              maskImage: 'linear-gradient(to bottom, #000, transparent)',
            }}
          />
          <div aria-hidden="true" className="hero-glow" />
          <div
            className="wrap"
            style={{
              position: 'relative',
              paddingTop: 28,
              paddingBottom: 48,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))',
              gap: 'clamp(28px, 4vw, 52px)',
              alignItems: 'end',
            }}
          >
            <div>
              <Breadcrumb
                lang={lang}
                items={[
                  { name: isFa ? 'خانه' : 'Home', href: isFa ? '/fa' : '/' },
                  { name: isFa ? 'مدل‌ها و API' : 'Models & API' },
                ]}
              />
              <div className="lbl" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginTop: 22 }}>
                <span className="led" />
                {isFa ? `${models.length} مدل · قیمت‌ها زنده به‌روز می‌شوند` : `${models.length} models · live pass-through prices`}
              </div>
              <h1
                className="sf"
                style={{
                  fontSize: isFa ? 'clamp(38px,5.2vw,68px)' : 'clamp(48px,6.2vw,92px)',
                  lineHeight: isFa ? 1.15 : 0.96,
                  letterSpacing: isFa ? 0 : '-.032em',
                  fontWeight: isFa ? 800 : 400,
                  margin: '16px 0',
                }}
              >
                {isFa ? (
                  <>
                    همه مدل‌ها. <em className="hi">قیمت مستقیم.</em>
                  </>
                ) : (
                  <>
                    Every model. <em className="hi">Lab price.</em>
                  </>
                )}
              </h1>
              <p style={{ fontSize: isFa ? 16.5 : 18, color: 'var(--vg-ink2)', maxWidth: 560, margin: 0, lineHeight: isFa ? 1.8 : 1.65 }}>
                {isFa
                  ? 'تعرفه مستقیم هر توکن از خود آزمایشگاه. مقایسه کنید، شناسه مدل را کپی کنید و بدون کارمزد روی ۵ دلار اول منتشر کنید.'
                  : 'Direct per-token pricing from each lab. Compare, copy the model ID, and ship with zero markup on your first $5.'}
              </p>
            </div>

            <TokenCalculatorCard models={models} lang={lang} />
          </div>
        </section>

        <div className="wrap">
          <ModelsCatalogue models={rows} providers={providers} baseUrl={API_BASE_URL} lang={lang} />

        <section id="quickstart" aria-labelledby="quickstart-title" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, paddingBottom: 72, scrollMarginTop: 24 }}>
          <div className="card" style={{ flex: '1.6 1 520px', minWidth: 0, borderRadius: 22, padding: 24 }}>
            <QuickstartTabs baseUrl={API_BASE_URL} exampleModel={example} lang={lang} />
          </div>
          <CreditsCard blendedPerMillionMicros={median} lang={lang} />
        </section>

        <section aria-label={isFa ? 'ویژگی‌های گیت‌وی' : 'Gateway features'} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16, paddingBottom: 72 }}>
          {features.map((f) => (
            <div key={f.t} className="card" style={{ padding: 22 }}>
              <span style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--vg-orange-soft)', color: 'var(--vg-orange-text)' }}>
                <Icon name={f.icon} size={20} />
              </span>
              <h3 className="sf" style={{ fontSize: isFa ? 20 : 24, margin: '16px 0 6px', fontWeight: isFa ? 600 : 400, letterSpacing: isFa ? 0 : '-.01em' }}>
                {f.t}
              </h3>
              <p style={{ margin: 0, color: 'var(--vg-ink2)', fontSize: 14, lineHeight: isFa ? 1.7 : undefined }}>{f.d}</p>
            </div>
          ))}
        </section>

        <section aria-labelledby="faq" style={{ display: 'flex', flexWrap: 'wrap', gap: 40, paddingBottom: 96 }}>
          <div style={{ flex: '1 1 320px' }}>
            <div className="lbl">{isFa ? '§ پرسش‌های متداول' : '§ FAQ'}</div>
            <h2
              id="faq"
              className="sf"
              style={{
                fontSize: isFa ? 'clamp(28px,3.2vw,42px)' : 'clamp(34px,3.6vw,48px)',
                lineHeight: isFa ? 1.25 : 1.04,
                margin: '12px 0 0',
                letterSpacing: isFa ? 0 : '-.02em',
                fontWeight: isFa ? 700 : 400,
              }}
            >
              {isFa ? (
                <>
                  پاسخ به پرسش‌های <em className="hi">رایج توسعه‌دهندگان.</em>
                </>
              ) : (
                <>
                  Questions developers <em className="hi">actually ask.</em>
                </>
              )}
            </h2>
          </div>
          <div style={{ flex: '2 1 560px', minWidth: 0 }}>
            {faq.map((f) => (
              <details key={f.q} style={{ borderTop: '1px solid var(--vg-line-faq)', padding: '4px 0' }}>
                <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', fontSize: 17, fontWeight: 500 }}>
                  <h3 style={{ margin: 0, font: 'inherit' }}>{f.q}</h3>
                  <Icon name="plus" size={20} className="pm" style={{ color: 'var(--vg-orange-text)' }} />
                </summary>
                <p style={{ margin: '0 0 18px', color: 'var(--vg-ink2)', maxWidth: 680, lineHeight: isFa ? 1.75 : undefined }}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
        </div>
      </main>
      <SiteFooter lang={lang} />
    </>
  );

  return isFa ? (
    <div dir="rtl" lang="fa" className="fa-ui">
      {content}
    </div>
  ) : (
    content
  );
}
