import { clearSessionCookies, getRequestAuth, readToken, toPublicUser } from '@/lib/auth';
import { apiError, privateJson } from '@/lib/http';

export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) {
    const res = apiError(401, 'unauthorized', 'Not signed in.');
    // Drop a stale cookie so the site stops showing signed-in navigation.
    if (readToken(req)?.via === 'cookie' || req.headers.get('cookie')?.includes('vigas_signed_in')) clearSessionCookies(res);
    return res;
  }
  return privateJson({ user: toPublicUser(auth.user) });
}
