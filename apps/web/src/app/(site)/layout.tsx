import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site-footer';

/** Marketing and account pages: each page renders its own header (active tab, ticker on/off). */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
