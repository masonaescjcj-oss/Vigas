import { NextResponse } from 'next/server';
import type { AuthResponse } from '@vigas/core';
import { hashPassword, verifyPassword } from '@vigas/core/server';
import { createSession, findUserByEmail, getDb } from '@vigas/db';
import { setSessionCookies, toPublicUser } from '@/lib/auth';
import { apiError, clientIp, originMismatch, rateLimit, readJson } from '@/lib/http';
import { PREVIEW_MESSAGE, PREVIEW_MODE } from '@/lib/preview';
import { loginSchema } from '@/lib/schemas';

// Verifying unknown emails against a real hash keeps their timing close to that of wrong passwords.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword('vigas-timing-equalizer'));

const INVALID = 'Invalid email or password.';

export async function POST(req: Request) {
  if (PREVIEW_MODE) return apiError(503, 'preview_mode', PREVIEW_MESSAGE);
  const bad = originMismatch(req);
  if (bad) return bad;
  const limited = rateLimit(`login:${clientIp(req)}`, 10, 60_000);
  if (limited) return limited;

  const body = await readJson(req, loginSchema);
  if (!body.ok) return apiError(401, 'invalid_credentials', INVALID);
  const { email, password } = body.data;

  const db = getDb();
  const user = await findUserByEmail(db, email);
  const ok = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash())).catch(() => false);
  if (!user || !ok) return apiError(401, 'invalid_credentials', INVALID);

  const token = await createSession(db, user.id, req.headers.get('user-agent'));
  const payload: AuthResponse = { user: toPublicUser(user), token };
  const res = NextResponse.json(payload, { headers: { 'Cache-Control': 'private, no-store' } });
  setSessionCookies(res, token);
  return res;
}
