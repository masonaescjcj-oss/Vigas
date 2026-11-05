import { NextResponse } from 'next/server';
import { deleteSession, getDb } from '@vigas/db';
import { clearSessionCookies, readToken } from '@/lib/auth';
import { originMismatch } from '@/lib/http';
import { PREVIEW_MODE } from '@/lib/preview';

export async function POST(req: Request) {
  const t = readToken(req);
  if (t?.via === 'cookie') {
    const bad = originMismatch(req);
    if (bad) return bad;
  }
  if (t && !PREVIEW_MODE) await deleteSession(getDb(), t.token);
  const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  clearSessionCookies(res);
  return res;
}
