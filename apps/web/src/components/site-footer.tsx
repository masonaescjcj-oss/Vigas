import Link from 'next/link';
import { LanguageSwitch } from './language-switch';
import { Icon, LogoMark } from './ui';

const EN_COLS: Array<{ title: string; links: Array<[string, string]> }> = [
  {
    title: 'Models & API',
    links: [
      ['AI Chat & App Builder', '/chat'],
      ['All models & pricing', '/models'],
      ['API quickstart', '/models#quickstart'],
      ['Free AI models', '/models?tag=free'],
      ['Vigas API apps', '/tools/collection/vigas-api'],
      ['New AI tools', '/tools/collection/new'],
      ['Create API account', '/signup'],
    ],
  },
  {
    title: 'Leaderboards',
    links: [
      ['Best overall agents', '/leaderboard'],
      ['Best coding agents', '/leaderboard/coding'],
      ['Best WebDev models', '/leaderboard/webdev'],
      ['Best text models', '/leaderboard/text'],
      ['Best vision models', '/leaderboard/vision'],
      ['Best image edit', '/leaderboard/image-edit'],
      ['Aligned & safe AI', '/leaderboard/aligned'],
      ['Knowledge work AI', '/leaderboard/work'],
    ],
  },
  {
    title: 'Newsroom',
    links: [
      ...(['Models', 'Agents', 'Analysis', 'Policy', 'Hardware', 'Funding', 'Tools'].map(
        (c) => [c, `/news/category/${c.toLowerCase()}`] as [string, string],
      )),
      ['اخبار هوش مصنوعی (FA)', '/news/fa'],
    ],
  },
  {
    title: 'Tools Directory',
    links: [
      ['AI agent tools', '/tools/category/agents'],
      ['AI coding tools', '/tools/category/coding'],
      ['AI research tools', '/tools/category/research'],
      ['AI image generators', '/tools/category/image'],
      ['AI video tools', '/tools/category/video'],
      ['AI voice & audio', '/tools/category/audio'],
      ['AI productivity', '/tools/category/productivity'],
      ['Free AI tools', '/tools/collection/free'],
    ],
  },
];

const FA_COLS: Array<{ title: string; links: Array<[string, string]> }> = [
  {
    title: 'مدل‌ها و گیت‌وی API',
    links: [
      ['چت و اپ‌ساز هوش مصنوعی', '/chat'],
      ['همه مدل‌ها و تعرفه‌ها', '/models'],
      ['مستندات سریع API', '/models#quickstart'],
      ['مدل‌های رایگان AI', '/models?tag=free'],
      ['اپ‌های سازگار با Vigas API', '/tools/collection/vigas-api'],
      ['ابزارهای تازه AI', '/tools/collection/new'],
      ['ساخت حساب و کلید API', '/signup'],
    ],
  },
  {
    title: 'لیدربورد مدل‌ها',
    links: [
      ['بهترین ایجنت‌های کل', '/leaderboard'],
      ['برترین مدل‌های کدنویسی', '/leaderboard/coding'],
      ['برترین مدل‌های WebDev', '/leaderboard/webdev'],
      ['بهترین مدل‌های متن', '/leaderboard/text'],
      ['بهترین مدل‌های بینایی', '/leaderboard/vision'],
      ['بهترین ویرایش تصویر', '/leaderboard/image-edit'],
      ['هوش مصنوعی ایمن', '/leaderboard/aligned'],
      ['کارهای تخصصی و پژوهش', '/leaderboard/work'],
    ],
  },
  {
    title: 'تحریریه اخبار AI',
    links: [
      ['مدل‌ها', '/news/fa/category/models'],
      ['ایجنت‌ها', '/news/fa/category/agents'],
      ['تحلیل‌های تخصصی', '/news/fa/category/analysis'],
      ['سیاست‌گذاری', '/news/fa/category/policy'],
      ['سخت‌افزار و تراشه', '/news/fa/category/hardware'],
      ['سرمایه‌گذاری', '/news/fa/category/funding'],
      ['ابزارهای جدید', '/news/fa/category/tools'],
      ['تمام اخبار فارسی', '/news/fa'],
    ],
  },
  {
    title: 'دایرکتوری ابزارها',
    links: [
      ['ابزارهای ایجنتی', '/tools/category/agents'],
      ['ابزارهای کدنویسی', '/tools/category/coding'],
      ['پژوهش و جستجو', '/tools/category/research'],
      ['تولید تصویر AI', '/tools/category/image'],
      ['ساخت ویدیو AI', '/tools/category/video'],
      ['صوت و گفتار AI', '/tools/category/audio'],
      ['بهره‌وری و کار', '/tools/category/productivity'],
      ['ابزارهای رایگان', '/tools/collection/free'],
    ],
  },
];

export function SiteFooter({ lang = 'en', altHref }: { lang?: 'en' | 'fa'; altHref?: string }) {
  const isFa = lang === 'fa';
  const cols = isFa ? FA_COLS : EN_COLS;
  return (
    <footer className="site-footer" dir={isFa ? 'rtl' : 'ltr'} lang={lang}>
      <div className="wrap" style={{ paddingTop: 64, paddingBottom: 28 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '36px 28px' }}>
          <div style={{ flex: '2 1 300px', minWidth: 0 }}>
            <Link href={isFa ? '/fa' : '/'} aria-label={isFa ? 'صفحه اصلی ویگاس' : 'Vigas home'} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <LogoMark size={28} />
              <span className="dsp" dir="ltr" style={{ fontSize: 25, lineHeight: 1 }}>
                vigas
              </span>
            </Link>
            <p style={{ color: 'var(--vg-ink2)', maxWidth: 320, margin: '16px 0 18px', fontSize: 14, lineHeight: isFa ? 1.8 : 1.6 }}>
              {isFa
                ? 'سریع‌ترین و ارزان‌ترین دروازه API هوش مصنوعی — یک کلید، قیمت مستقیم آزمایشگاه‌ها، رتبه‌بندی زنده مدل‌ها و اخبار دوزبانه.'
                : 'The fastest, lowest-cost AI API gateway — one key, pass-through pricing, live rankings, and bilingual AI news.'}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span
                className="mn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 30,
                  padding: '0 10px',
                  borderRadius: 8,
                  background: 'var(--vg-surface)',
                  boxShadow: 'inset 0 0 0 1px var(--vg-line)',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--vg-green)',
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--vg-green)', display: 'inline-block' }} />
                {isFa ? 'API سازگار با OpenAI' : 'OpenAI-compatible API'}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 30,
                  padding: '0 10px',
                  borderRadius: 8,
                  background: 'var(--vg-surface)',
                  boxShadow: 'inset 0 0 0 1px var(--vg-line2)',
                  fontSize: 12,
                  color: 'var(--vg-ink)',
                }}
              >
                <Icon name="phone" size={14} />
                {isFa ? 'اپ اندروید · به‌زودی' : 'Android app · coming soon'}
              </span>
            </div>
          </div>
          {cols.map((col) => (
            <nav key={col.title} aria-label={col.title} style={{ flex: '1 1 150px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
              <span className="lbl" style={{ marginBottom: 4 }}>
                {col.title}
              </span>
              {col.links.map(([label, href]) =>
                href === '/chat' ? (
                  <a key={label} href={href}>
                    {label}
                  </a>
                ) : (
                  <Link key={label} href={href} prefetch={false}>
                    {label}
                  </Link>
                ),
              )}
            </nav>
          ))}
        </div>
        <div aria-hidden="true" className="dsp footer-wordmark" dir="ltr">
          vigas
        </div>
        <div
          className="mn"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            fontSize: 12,
            color: 'var(--vg-ink3)',
            borderTop: '1px solid var(--vg-line)',
            paddingTop: 18,
          }}
        >
          <span>{isFa ? '© ۲۰۲۶ آزمایشگاه ویگاس · ساخته شده با سیگنال و دقت' : '© 2026 Vigas Labs · Made with sand & signal'}</span>
          <span className="footer-bottom-links">
            <LanguageSwitch
              variant="link"
              lang={lang}
              targetLang="en"
              altHref={isFa ? (altHref ?? '/') : '/'}
              dir="ltr"
              langAttr="en"
              style={{ color: !isFa ? 'var(--vg-ink)' : 'var(--vg-ink2)' }}
            >
              English
            </LanguageSwitch>
            <LanguageSwitch
              variant="link"
              lang={lang}
              targetLang="fa"
              altHref={!isFa ? (altHref ?? '/fa') : '/fa'}
              className="fa-ui"
              langAttr="fa"
              dir="rtl"
              style={{ color: 'var(--vg-sand)' }}
            >
              فارسی
            </LanguageSwitch>
            <LanguageSwitch
              variant="link"
              lang={lang}
              targetLang="fa"
              altHref="/news/fa"
              className="fa-ui"
              langAttr="fa"
              dir="rtl"
              style={{ color: 'var(--vg-ink2)' }}
            >
              اخبار فارسی
            </LanguageSwitch>
            <Link href="/privacy" style={{ color: 'var(--vg-ink3)' }}>
              {isFa ? 'حریم خصوصی' : 'Privacy'}
            </Link>
            <Link href="/terms" style={{ color: 'var(--vg-ink3)' }}>
              {isFa ? 'قوانین استفاده' : 'Terms'}
            </Link>
            <a href="/feed.xml" style={{ color: 'var(--vg-ink3)' }}>
              RSS
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
