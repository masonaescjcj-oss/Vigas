'use client';

import Link from 'next/link';
import { useSignedInHint } from '@/lib/client/session';

export function HeaderAccount() {
  const signedIn = useSignedInHint();
  return (
    <>
      {signedIn ? (
        <Link href="/dashboard" className="hdr-signin">
          Dashboard
        </Link>
      ) : (
        <Link href="/signin" className="hdr-signin">
          Sign in
        </Link>
      )}
      <Link href={signedIn ? '/dashboard#keys' : '/signup?next=/dashboard%23keys'} className="btn key hdr-cta">
        Get <span className="long">API&nbsp;</span>key
      </Link>
    </>
  );
}
