import type { NextRequest } from 'next/server';

const SUPABASE_URL = (
  process.env.CHAT_SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://jasgepmskcsyvqoesocc.supabase.co'
).replace(/\/+$/, '');

export async function GET(_request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  if (!/^[a-z0-9]{6,40}$/.test(code)) {
    return new Response('<!doctype html><title>Not found</title><p>That link is not valid.</p>', {
      status: 404,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  try {
    const upstream = await fetch(`${SUPABASE_URL}/functions/v1/share-page/${code}`, {
      headers: { accept: 'text/html' },
      cache: 'no-store',
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch {
    return new Response('<!doctype html><title>Unavailable</title><p>This shared app could not be loaded. Try again shortly.</p>', {
      status: 502,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }
}
