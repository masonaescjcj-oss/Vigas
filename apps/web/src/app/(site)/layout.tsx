import { Suspense, type ReactNode } from 'react';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';

/** Marketing and account pages: each page renders its own header and localized footer. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <MobileBottomNav />
      </Suspense>
    </>
  );
}
