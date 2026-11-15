import type { Metadata } from 'next';
import Link from 'next/link';
import { NotFoundLocale } from '@/components/not-found-locale';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { Icon } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'This page does not exist on Vigas.',
  robots: { index: false, follow: true },
};

const EN_LINKS: Array<[string, string, string]> = [
  ['/leaderboard', 'Leaderboard', 'Which AI models are winning this week'],
  ['/news', 'AI News', 'The stories that move the models'],
  ['/models', 'Models & prices', 'Every model behind one key'],
  ['/tools', 'Tools', 'What builders are upvoting'],
];

const FA_LINKS: Array<[string, string, string]> = [
  ['/leaderboard', 'لیدربورد', 'مدل‌هایی که این هفته در صدرند'],
  ['/news/fa', 'اخبار AI', 'خبرهای اثرگذار دنیای هوش مصنوعی'],
  ['/models', 'مدل‌ها و تعرفه', 'همه مدل‌ها با یک کلید API'],
  ['/tools', 'ابزارها', 'محبوب‌ترین اپ‌های هوش مصنوعی'],
];

function NotFoundView({ lang }: { lang: 'en' | 'fa' }) {
  const isFa = lang === 'fa';
  const links = isFa ? FA_LINKS : EN_LINKS;

  const content = (
    <>
      <SiteHeader ticker={false} lang={lang} />
      <main id="main" className="wrap" style={{ paddingTop: 72, paddingBottom: 96 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 480px', minWidth: 0 }}>
            <div className="lbl">{isFa ? '§ خطای ۴۰۴' : '§ Error 404'}</div>
            <h1
              className="sf"
              style={{
                fontSize: isFa ? 'clamp(36px,5.4vw,66px)' : 'clamp(52px,7vw,100px)',
                lineHeight: isFa ? 1.15 : 0.94,
                letterSpacing: isFa ? 0 : '-.032em',
                fontWeight: isFa ? 700 : 400,
                margin: '18px 0',
              }}
            >
              {isFa ? (
                <>
                  این مسیر در ستون‌ها <em className="hi">پیدا نشد.</em>
                </>
              ) : (
                <>
                  Lost in the <em className="hi">colonnade.</em>
                </>
              )}
            </h1>
            <p style={{ fontSize: isFa ? 16.5 : 18, color: 'var(--vg-ink2)', maxWidth: 520, margin: 0, lineHeight: isFa ? 1.8 : undefined }}>
              {isFa
                ? 'صفحه‌ای که به دنبال آن بودید جابه‌جا شده یا وجود ندارد. از مسیرهای زیر می‌توانید برگردید.'
                : 'The page you were looking for has moved, or never existed. Here are a few doors that do open.'}
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 28 }}>
              <Link href={isFa ? '/fa' : '/'} className="btn key" style={{ minHeight: 50, padding: '0 24px' }}>
                {isFa ? 'بازگشت به صفحه اصلی' : 'Back to the home page'}
                <Icon name="arrow" size={16} style={{ transform: isFa ? 'scaleX(-1)' : undefined }} />
              </Link>
              <Link href="/models" className="btn gh" style={{ minHeight: 50, padding: '0 24px' }}>
                {isFa ? 'مدل‌ها و تعرفه‌های API' : 'Models & API pricing'}
              </Link>
            </div>
          </div>
          <div
            aria-hidden="true"
            dir="ltr"
            className="sf"
            style={{
              flex: '0 1 auto',
              fontSize: 'clamp(120px,18vw,240px)',
              lineHeight: 0.8,
              letterSpacing: '-.05em',
              color: 'transparent',
              WebkitTextStroke: '1px var(--vg-notfound-stroke)',
            }}
          >
            404
          </div>
        </div>
        <nav aria-label={isFa ? 'صفحات پرمخاطب' : 'Popular pages'} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(240px,100%),1fr))', gap: 14, marginTop: 56 }}>
          {links.map(([href, t, d]) => (
            <Link key={href} href={href} className="lift card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--vg-ink)' }}>
              <span className="sf" style={{ fontSize: isFa ? 22 : 26 }}>
                {t}
              </span>
              <span style={{ fontSize: 14, color: 'var(--vg-ink2)' }}>{d}</span>
            </Link>
          ))}
        </nav>
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

export default function NotFound() {
  return <NotFoundLocale en={<NotFoundView lang="en" />} fa={<NotFoundView lang="fa" />} />;
}
