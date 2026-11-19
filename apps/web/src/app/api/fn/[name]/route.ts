import { NextResponse } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/client/supabase-config';

const ALLOWED_FUNCTIONS = new Set(['usage-check', 'checkout-create']);

async function forward(req: Request, name: string): Promise<Response> {
  if (!ALLOWED_FUNCTIONS.has(name)) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Unknown function.' } }, { status: 404 });
  }
  const auth = req.headers.get('authorization');
  if (!auth || !/^Bearer\s+\S+$/i.test(auth)) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required.' } }, { status: 401 });
  }

  const target = `${SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/${name}`;
  const init: RequestInit = {
    method: req.method,
    headers: {
      Authorization: auth,
      apikey: SUPABASE_ANON_KEY,
      Accept: 'application/json',
      ...(req.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    cache: 'no-store',
  };
  if (req.method === 'POST') {
    init.body = await req.text();
  }

  try {
    const upstream = await fetch(target, init);
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Could not reach Vigas backend.' } },
      { status: 502, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}

export async function GET(req: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  return forward(req, name);
}

export async function POST(req: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  return forward(req, name);
}
