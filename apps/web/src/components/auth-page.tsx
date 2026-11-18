import type { ReactNode } from 'react';
import { absoluteUrl } from '@/lib/env';
import { breadcrumbLd } from '@/lib/seo';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';
import { Breadcrumb, Icon, JsonLd } from './ui';

const EN_BULLETS = [
  'One OpenAI-compatible API key for 25+ frontier models',
  'Lowest pass-through token rates with automatic failover',
  'Zero markup on your first $5 of prepaid credits',
  'Compatible with Cursor, OpenCode, Cline & your apps',
];

const FA_BULLETS = [
  'یک کلید API سازگار با OpenAI برای دسترسی به ۲۵+ مدل پیشتاز',
  'کمترین تعرفه مستقیم توکن بدون کارمزد اضافه و Failover خودکار',
  'کارمزد صفر درصد روی ۵ دلار اول شارژ اعتبار حساب',
  'سازگار با Cursor، OpenCode، Cline و اپلیکیشن‌های شما',
];

/** Shared layout for the sign-in and sign-up pages. */
export function AuthPage({
  title,
  intro,
  crumb,
  path = '/signup',
  lang = 'en',
  children,
}: {
  title: ReactNode;
  intro: string;
  crumb: string;
  path?: string;
  lang?: 'en' | 'fa';
  children: ReactNode;
}) {
  const isFa = lang === 'fa';
  const bullets = isFa ? FA_BULLETS : EN_BULLETS;
  const homeHref = isFa ? '/fa' : '/';
  const content = (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: isFa ? 'خانه' : 'Home', path: homeHref },
            { name: crumb, path },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: crumb,
            description: intro,
            url: absoluteUrl(path),
            inLanguage: lang,
          },
        ]}
      />
      <SiteHeader ticker={false} lang={lang} />
      <main id="main" className="wrap" style={{ paddingBottom: 96 }}>
        <Breadcrumb lang={lang} items={[{ name: isFa ? 'خانه' : 'Home', href: homeHref }, { name: crumb }]} style={{ paddingTop: 28 }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 56, alignItems: 'center', paddingTop: 40 }}>
          <div style={{ flex: '1 1 420px', minWidth: 0 }}>
            <div className="lbl" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span className="led" />
              {isFa ? 'یک حساب · یک کیف‌پول اعتباری' : 'One account · one balance'}
            </div>
            <h1
              className="sf"
              style={{
                fontSize: isFa ? 'clamp(34px,4.6vw,58px)' : 'clamp(44px,5.4vw,76px)',
                lineHeight: isFa ? 1.15 : 0.98,
                letterSpacing: isFa ? 0 : '-.03em',
                fontWeight: isFa ? 700 : 400,
                margin: '16px 0',
              }}
            >
              {title}
            </h1>
            <p style={{ fontSize: isFa ? 16.5 : 18, color: 'var(--vg-ink2)', maxWidth: 520, margin: 0, lineHeight: isFa ? 1.8 : undefined }}>{intro}</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '28px 0 0', display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--vg-ink2)' }}>
              {bullets.map((t) => (
                <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name="check" size={16} style={{ color: 'var(--vg-green)' }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="card" style={{ flex: '1 1 380px', minWidth: 0, maxWidth: 480, borderRadius: 22, padding: 'clamp(20px,3vw,32px)' }}>
            {children}
          </div>
        </div>
      </main>
      <SiteFooter lang={lang} />
    </>
  );

  if (isFa) {
    return (
      <div dir="rtl" lang="fa" className="fa-ui">
        {content}
      </div>
    );
  }
  return content;
}
