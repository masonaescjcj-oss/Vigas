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
          {isFa ? 'پنل API' : 'API Console'}
        </Link>
      ) : (
        <Link href="/signin" className="hdr-signin">
          {isFa ? 'ورود' : 'Sign in'}
        </Link>
      )}
      <Link href={signedIn ? '/dashboard#credits' : '/signup?next=/dashboard'} className="btn key hdr-cta">
        {signedIn ? (
          isFa ? (
            <span>خرید اعتبار</span>
          ) : (
            <span>Buy credits</span>
          )
        ) : isFa ? (
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
