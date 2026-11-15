import type { ReactNode } from 'react';

/** Marketing and account pages: each page renders its own header and localized footer. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
