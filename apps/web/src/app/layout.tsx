import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, Inter, JetBrains_Mono, Vazirmatn } from 'next/font/google';
import { colors, cssVariables } from '@vigas/tokens';
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
  alternates: { types: { 'application/rss+xml': [{ url: '/feed.xml', title: `${SITE_NAME} AI News RSS` }] } },
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
    locale: 'en_US',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Vigas — One key for every AI model' }],
  },
  twitter: { card: 'summary_large_image', images: ['/opengraph-image'] },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: colors.bg,
  colorScheme: 'dark',
};

const tokenCss = cssVariables();
const SHOW_PREVIEW_BANNER = process.env.VIGAS_PREVIEW_BANNER === '1';

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" dir="ltr" className={`${serif.variable} ${sans.variable} ${mono.variable} ${fa.variable}`}>
      <head>
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
            style={{ background: 'var(--vg-sand)', color: 'var(--vg-on-orange)', fontSize: 12, padding: '6px 16px', textAlign: 'center', letterSpacing: '.04em' }}
          >
            PREVIEW · sample data · {PREVIEW_MESSAGE}
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
