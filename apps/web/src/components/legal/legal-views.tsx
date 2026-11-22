import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { Breadcrumb, JsonLd } from '@/components/ui';
import { breadcrumbLd } from '@/lib/seo';

const EN_PRIVACY: Array<{ title: string; body: string }> = [
  {
    title: '1. What we collect',
    body: 'When you create an account, sign in with GitHub or Google, or purchase prepaid credits, we store only the account details required to authenticate your session, meter your token spend, and display your credit balance.',
  },
  {
    title: '2. Gateway prompts & telemetry',
    body: 'API requests routed through Vigas are forwarded to your selected upstream model provider solely to fulfill your completion request. Public leaderboard win shares and latency statistics are published strictly as aggregated, non-identifying rankings.',
  },
  {
    title: '3. Cookies & local storage',
    body: 'Vigas uses strictly necessary session cookies for authentication and minimal local storage state (such as theme preference, selected display language, and composer drafts). We do not run third-party advertising trackers.',
  },
  {
    title: '4. Your choices & contact',
    body: 'You may revoke API keys, inspect transaction ledgers in your dashboard, or request deletion of your account data at any time by writing to privacy@vigas.ai.',
  },
];

const FA_PRIVACY: Array<{ title: string; body: string }> = [
  {
    title: '۱. داده‌هایی که جمع‌آوری می‌کنیم',
    body: 'هنگام ساخت حساب، ورود یا شارژ اعتبار پیش‌پرداخت، تنها اطلاعات ضروری برای احراز هویت نشست، محاسبه مصرف توکن و نمایش موجودی کیف‌پول ذخیره می‌شود.',
  },
  {
    title: '۲. درخواست‌های API و آمار لیدربورد',
    body: 'درخواست‌های ارسالی از طریق گیت‌وی ویگاس صرفاً برای تولید پاسخ به ارائه‌دهنده مدل انتخاب‌شده شما ارسال می‌شوند. سهم برد لیدربورد عمومی و آمارهای تأخیر به‌شکل کاملاً تجمیع‌شده و بدون هویت شخصی منتشر می‌گردند.',
  },
  {
    title: '۳. کوکی‌ها و حافظه محلی مرورگر',
    body: 'ویگاس از کوکی‌های ضروری برای حفظ نشست کاربری، انتخاب زبان نمایش و حالت روشن/تیره استفاده می‌کند. ما از هیچ ردیاب تبلیغاتی شخص ثالث استفاده نمی‌کنیم.',
  },
  {
    title: '۴. کنترل داده‌ها و تماس',
    body: 'هر زمان می‌توانید کلیدهای API را لغو کنید، سوابق تراکنش را در داشبورد ببینید یا با ارسال ایمیل به privacy@vigas.ai درخواست حذف اطلاعات حساب خود را ثبت نمایید.',
  },
];

const EN_TERMS: Array<{ title: string; body: string }> = [
  {
    title: '1. Using Vigas',
    body: 'Vigas provides public model benchmarks, editorial news reporting, a community tools directory, and an OpenAI-compatible API gateway backed by prepaid credits. By using Vigas, you agree to comply with applicable laws and upstream provider acceptable-use policies.',
  },
  {
    title: '2. Prepaid credits & pricing',
    body: 'API and chat requests deduct per-token charges based on the published pricing sheet on the Models page. Credits are denominated in USD. After your first $5 in lifetime top-ups, any displayed platform fee is shown transparently before payment.',
  },
  {
    title: '3. Public directory & leaderboard data',
    body: 'Community upvotes, leaderboard scores, and curated listings are provided for informational comparison. You may embed the public Vigas leaderboard widget on external websites provided attribution remains intact.',
  },
  {
    title: '4. Contact',
    body: 'Questions about these terms or tool listings can be sent to legal@vigas.ai.',
  },
];

const FA_TERMS: Array<{ title: string; body: string }> = [
  {
    title: '۱. استفاده از ویگاس',
    body: 'ویگاس بنچمارک‌های عمومی مدل‌ها، تحریریه اخبار هوش مصنوعی، دایرکتوری ابزارها و گیت‌وی API سازگار با OpenAI مبتنی بر اعتبار پیش‌پرداخت را ارائه می‌دهد. با استفاده از ویگاس، متعهد به رعایت قوانین جاری و ضوابط استفاده ارائه‌دهندگان اصلی می‌شوید.',
  },
  {
    title: '۲. اعتبار پیش‌پرداخت و قیمت‌گذاری',
    body: 'هزینه درخواست‌های API بر اساس جدول تعرفه منتشرشده در صفحه مدل‌ها به دلار محاسبه و کسر می‌شود. تا ۵ دلار اول شارژ حساب، کارمزد پلتفرم صفر است و پس از آن کارمزد به‌صورت شفاف پیش از پرداخت نمایش داده می‌شود.',
  },
  {
    title: '۳. داده‌های دایرکتوری و لیدربورد عمومی',
    body: 'آرای کاربران، امتیازهای لیدربورد و فهرست ابزارها با هدف مقایسه شفاف منتشر می‌شوند. می‌توانید ویجت لیدربورد ویگاس را با حفظ نام و پیوند منبع در وب‌سایت خود جای‌گذاری کنید.',
  },
  {
    title: '۴. ارتباط با ما',
    body: 'پرسش‌های مربوط به قوانین استفاده یا ثبت ابزار را می‌توانید به آدرس legal@vigas.ai ارسال کنید.',
  },
];

export function PrivacyView({ lang = 'en' }: { lang?: 'en' | 'fa' }) {
  const isFa = lang === 'fa';
  const homeHref = isFa ? '/fa' : '/';
  const homeLabel = isFa ? 'خانه' : 'Home';
  const pageTitle = isFa ? 'حریم خصوصی' : 'Privacy Policy';
  const sections = isFa ? FA_PRIVACY : EN_PRIVACY;

  const tree = (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: homeLabel, path: homeHref },
          { name: pageTitle, path: '/privacy' },
        ])}
      />
      <SiteHeader lang={lang} />
      <main id="main" className="wrap" style={{ maxWidth: 880, paddingBottom: 96 }}>
        <Breadcrumb lang={lang} items={[{ name: homeLabel, href: homeHref }, { name: pageTitle }]} style={{ paddingTop: 28 }} />
        <header style={{ padding: '24px 0 36px', borderBottom: '1px solid var(--vg-line)' }}>
          <div className="lbl">{isFa ? '§ حقوقی · نسخه ۲۰۲۶' : '§ Legal · Effective 2026'}</div>
          <h1
            className="sf"
            style={{
              fontSize: isFa ? 'clamp(34px,4.6vw,54px)' : 'clamp(40px,5.4vw,68px)',
              lineHeight: isFa ? 1.15 : 0.98,
              letterSpacing: isFa ? 0 : '-.03em',
              fontWeight: isFa ? 700 : 400,
              margin: '14px 0 12px',
            }}
          >
            {isFa ? (
              <>
                سیاست <em className="hi">حریم خصوصی</em>
              </>
            ) : (
              <>
                Privacy <em className="hi">Policy</em>
              </>
            )}
          </h1>
          <p style={{ margin: 0, color: 'var(--vg-ink2)', fontSize: isFa ? 16 : 17, maxWidth: 620, lineHeight: isFa ? 1.8 : undefined }}>
            {isFa
              ? 'توضیح روشن درباره داده‌هایی که ویگاس جمع‌آوری می‌کند، نحوه عبور درخواست‌ها از روتر و چگونگی تجمیع آمارهای لیدربورد.'
              : 'Plain language on what data Vigas collects, how requests move through the model router, and how leaderboard statistics are aggregated.'}
          </p>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, paddingTop: 36 }}>
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="sf" style={{ fontSize: isFa ? 22 : 28, fontWeight: isFa ? 600 : 400, margin: '0 0 8px' }}>
                {s.title}
              </h2>
              <p style={{ margin: 0, color: 'var(--vg-ink2)', fontSize: 16, lineHeight: isFa ? 1.85 : 1.65 }}>{s.body}</p>
            </section>
          ))}
        </div>

        <nav aria-label={isFa ? 'صفحات مرتبط' : 'Related pages'} style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--vg-line)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/terms" className="tag">
            {isFa ? 'قوانین استفاده' : 'Terms of Service'}
          </Link>
          <Link href="/leaderboard#method" className="tag">
            {isFa ? 'روش‌شناسی لیدربورد' : 'Leaderboard methodology'}
          </Link>
          <Link href="/models" className="tag">
            {isFa ? 'مدل‌ها و تعرفه‌ها' : 'Models & Pricing'}
          </Link>
        </nav>
      </main>
      <SiteFooter lang={lang} />
    </>
  );

  if (isFa) {
    return (
      <div dir="rtl" lang="fa" className="fa-ui">
        {tree}
      </div>
    );
  }
  return tree;
}

export function TermsView({ lang = 'en' }: { lang?: 'en' | 'fa' }) {
  const isFa = lang === 'fa';
  const homeHref = isFa ? '/fa' : '/';
  const homeLabel = isFa ? 'خانه' : 'Home';
  const pageTitle = isFa ? 'قوانین استفاده' : 'Terms of Service';
  const sections = isFa ? FA_TERMS : EN_TERMS;

  const tree = (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: homeLabel, path: homeHref },
          { name: pageTitle, path: '/terms' },
        ])}
      />
      <SiteHeader lang={lang} />
      <main id="main" className="wrap" style={{ maxWidth: 880, paddingBottom: 96 }}>
        <Breadcrumb lang={lang} items={[{ name: homeLabel, href: homeHref }, { name: pageTitle }]} style={{ paddingTop: 28 }} />
        <header style={{ padding: '24px 0 36px', borderBottom: '1px solid var(--vg-line)' }}>
          <div className="lbl">{isFa ? '§ حقوقی · نسخه ۲۰۲۶' : '§ Legal · Effective 2026'}</div>
          <h1
            className="sf"
            style={{
              fontSize: isFa ? 'clamp(34px,4.6vw,54px)' : 'clamp(40px,5.4vw,68px)',
              lineHeight: isFa ? 1.15 : 0.98,
              letterSpacing: isFa ? 0 : '-.03em',
              fontWeight: isFa ? 700 : 400,
              margin: '14px 0 12px',
            }}
          >
            {isFa ? (
              <>
                شرایط و <em className="hi">قوانین استفاده</em>
              </>
            ) : (
              <>
                Terms of <em className="hi">Service</em>
              </>
            )}
          </h1>
          <p style={{ margin: 0, color: 'var(--vg-ink2)', fontSize: isFa ? 16 : 17, maxWidth: 620, lineHeight: isFa ? 1.8 : undefined }}>
            {isFa
              ? 'قوانین شفاف درباره اعتبار پیش‌پرداخت گیت‌وی، ثبت ابزارها و استفاده از رتبه‌بندی‌های عمومی ویگاس.'
              : 'Clear rules covering prepaid gateway credits, directory submissions, and embedding public Vigas rankings.'}
          </p>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, paddingTop: 36 }}>
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="sf" style={{ fontSize: isFa ? 22 : 28, fontWeight: isFa ? 600 : 400, margin: '0 0 8px' }}>
                {s.title}
              </h2>
              <p style={{ margin: 0, color: 'var(--vg-ink2)', fontSize: 16, lineHeight: isFa ? 1.85 : 1.65 }}>{s.body}</p>
            </section>
          ))}
        </div>

        <nav aria-label={isFa ? 'صفحات مرتبط' : 'Related pages'} style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--vg-line)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/privacy" className="tag">
            {isFa ? 'حریم خصوصی' : 'Privacy Policy'}
          </Link>
          <Link href="/tools" className="tag">
            {isFa ? 'دایرکتوری ابزارهای AI' : 'AI Tools directory'}
          </Link>
          <Link href="/leaderboard" className="tag">
            {isFa ? 'لیدربورد' : 'Leaderboard'}
          </Link>
        </nav>
      </main>
      <SiteFooter lang={lang} />
    </>
  );

  if (isFa) {
    return (
      <div dir="rtl" lang="fa" className="fa-ui">
        {tree}
      </div>
    );
  }
  return tree;
}
