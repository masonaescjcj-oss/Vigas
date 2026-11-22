import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, Inter, JetBrains_Mono, Vazirmatn } from 'next/font/google';
import { colors, cssVariables } from '@vigas/tokens';
import { AuthHashBridge } from '@/components/auth-hash-bridge';
import { SITE_NAME, SITE_URL } from '@/lib/env';
import { PREVIEW_MESSAGE, PREVIEW_MODE } from '@/lib/preview';
import { DEFAULT_DESCRIPTION } from '@/lib/seo';
import './globals.css';

const serif = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});
const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
const fa = Vazirmatn({ subsets: ['arabic', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-fa', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Vigas — One key for every AI model', template: `%s | ${SITE_NAME}` },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48 32x32 16x16', type: 'image/x-icon' },
      { url: '/icons/icon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
    shortcut: ['/favicon.ico'],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  alternates: { types: { 'application/rss+xml': [{ url: '/feed.xml', title: `${SITE_NAME} AI News RSS` }] } },
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
    locale: 'en_US',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Vigas — One key for every AI model' }],
  },
  twitter: { card: 'summary_large_image', images: ['/opengraph-image'] },
  verification: { google: '2gNWri09hWdHTOaGbcc0ZWM_vBD8IhSU-1fGUqZ1ZZY' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: colors.bg },
    { media: '(prefers-color-scheme: light)', color: '#FBF8F3' },
  ],
  colorScheme: 'dark light',
};

const tokenCss = cssVariables();
const SHOW_PREVIEW_BANNER = process.env.VIGAS_PREVIEW_BANNER === '1';

const INIT_THEME_SCRIPT = `(function(){try{var d=document.documentElement;var m=document.cookie.match(/(?:^|;\\s*)vg_theme=(light|dark)(?:;|$)/);var t=m?m[1]:localStorage.getItem('vg_theme');if(t!=='light'&&t!=='dark')t='dark';d.dataset.theme=t;d.style.colorScheme=t;var p=location.pathname;var lm=document.cookie.match(/(?:^|;\\s*)vg_lang=(fa|en)(?:;|$)/);var fa=p==='/fa'||p==='/news/fa'||p.indexOf('/news/fa/')===0||p.indexOf('/news/fa-')===0||(lm&&lm[1]==='fa'&&p.indexOf('/news/')!==0&&p.indexOf('/admin')!==0&&p.indexOf('/embed')!==0&&p!=='/');if(fa){d.lang='fa';d.dir='rtl';}}catch(_){}})();`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={`${serif.variable} ${sans.variable} ${mono.variable} ${fa.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: INIT_THEME_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: tokenCss }} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {PREVIEW_MODE && SHOW_PREVIEW_BANNER && (
          <div
            role="note"
            className="mn"
            style={{ background: 'var(--vg-sand-fill)', color: 'var(--vg-on-orange)', fontSize: 12, padding: '6px 16px', textAlign: 'center', letterSpacing: '.04em' }}
          >
            PREVIEW · sample data · {PREVIEW_MESSAGE}
          </div>
        )}
        <AuthHashBridge />
        {children}
      </body>
    </html>
  );
}
