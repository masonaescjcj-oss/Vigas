'use client';

import Link from 'next/link';
import { useSignedInHint } from '@/lib/client/session';

export function HeaderAccount({ lang = 'en' }: { lang?: 'en' | 'fa' }) {
  const signedIn = useSignedInHint();
  const isFa = lang === 'fa';
  return (
    <>
      {signedIn ? (
        <Link href="/dashboard" className="hdr-signin">
          {isFa ? 'داشبورد' : 'Dashboard'}
        </Link>
      ) : (
        <Link href="/signin" className="hdr-signin">
          {isFa ? 'ورود' : 'Sign in'}
        </Link>
      )}
      <Link href={signedIn ? '/dashboard#keys' : '/signup?next=/dashboard%23keys'} className="btn key hdr-cta">
        {isFa ? (
          <span>
            دریافت کلید <span className="long">API</span>
          </span>
        ) : (
          <span>
            Get <span className="long">API </span>key
          </span>
        )}
      </Link>
    </>
  );
}
