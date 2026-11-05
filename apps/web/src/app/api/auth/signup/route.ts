import { NextResponse } from 'next/server';
import type { AuthResponse } from '@vigas/core';
import { hashPassword } from '@vigas/core/server';
import { createSession, createUser, findUserByEmail, getDb } from '@vigas/db';
import { setSessionCookies, toPublicUser } from '@/lib/auth';
import { apiError, clientIp, originMismatch, rateLimit, readJson } from '@/lib/http';
import { signupSchema } from '@/lib/schemas';

export async function POST(req: Request) {
  const bad = originMismatch(req);
  if (bad) return bad;
  const limited = rateLimit(`signup:${clientIp(req)}`, 5, 60_000);
  if (limited) return limited;

  const body = await readJson(req, signupSchema);
  if (!body.ok) return body.res;
  const { email, password, name } = body.data;

  const db = getDb();
  if (await findUserByEmail(db, email)) {
    return apiError(409, 'email_taken', 'An account with this email already exists. Sign in instead.');
  }
  let user;
  try {
    user = await createUser(db, { email, name: name || null, passwordHash: await hashPassword(password) });
  } catch {
    // Unique violation from a concurrent signup with the same email.
    return apiError(409, 'email_taken', 'An account with this email already exists. Sign in instead.');
  }
  const token = await createSession(db, user.id, req.headers.get('user-agent'));
  const payload: AuthResponse = { user: toPublicUser(user), token };
  const res = NextResponse.json(payload, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  setSessionCookies(res, token);
  return res;
}
