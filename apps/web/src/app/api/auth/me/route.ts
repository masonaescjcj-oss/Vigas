import { getRequestAuth, toPublicUser } from '@/lib/auth';
import { apiError, privateJson } from '@/lib/http';

export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) {
    return apiError(401, 'unauthorized', 'Not signed in.');
  }
  return privateJson({ user: toPublicUser(auth.user) });
}
