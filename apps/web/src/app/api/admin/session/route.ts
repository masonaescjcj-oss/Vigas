import { NextResponse } from 'next/server';
import { probeAdminDb, requireAdmin, setAdminBridgeCookies } from '@/lib/admin';
import { originMismatch } from '@/lib/http';

/**
 * Verifies whether the current caller (Postgres session cookie, Supabase Auth Bearer JWT,
 * or signed admin bridge cookie) holds admin privileges, issues/refreshes the httpOnly
 * `vigas_admin_bridge` cookie so SSR `/admin/*` opens cleanly even when Postgres is offline,
 * and reports live Postgres connectivity without throwing.
 */
async function handleAdminSession(req: Request) {
  if (req.method === 'POST') {
    const bad = originMismatch(req);
    if (bad) return bad;
  }
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const db = await probeAdminDb();
  const res = NextResponse.json(
    {
      ok: true,
      email: auth.user.email,
      role: auth.user.role,
      previewMode: db.previewMode,
      dbConnected: db.connected,
      dbCode: db.code ?? null,
      dbError: db.message ?? null,
      bridgeSet: true,
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );

  const bridgeSet = setAdminBridgeCookies(res, {
    id: auth.user.id,
    email: auth.user.email,
    name: auth.user.name,
  });

  if (!bridgeSet) {
    return NextResponse.json(
      {
        ok: true,
        email: auth.user.email,
        role: auth.user.role,
        previewMode: db.previewMode,
        dbConnected: db.connected,
        dbCode: db.code ?? null,
        dbError: db.message ?? null,
        bridgeSet: false,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  return res;
}

export async function GET(req: Request) {
  return handleAdminSession(req);
}

export async function POST(req: Request) {
  return handleAdminSession(req);
}
