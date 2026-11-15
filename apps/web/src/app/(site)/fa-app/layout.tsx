import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/** Internal Persian rewrite targets — never indexed directly; canonical English URLs live at /models, /leaderboard, /tools, etc. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function FaAppLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
