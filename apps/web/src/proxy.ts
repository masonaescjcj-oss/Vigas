import { NextResponse, type NextRequest } from 'next/server';
import { LEADERBOARD_CATEGORIES } from '@vigas/core';
import { parseNewsCategorySlug, parseToolCategorySlug, parseToolCollectionSlug } from '@/lib/seo-catalog';

const LANG_COOKIE = 'vg_lang';
const LANG_COOKIE_OPTS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
};

function parsePositivePage(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 && n <= 1000 ? n : null;
}

function isPrefetch(request: NextRequest): boolean {
  const h = request.headers;
  return (
    h.get('next-router-prefetch') === '1' ||
    h.get('purpose') === 'prefetch' ||
    h.get('sec-purpose') === 'prefetch' ||
    h.get('x-nextjs-prefetch') === '1'
  );
}

function withVaryCookie(res: NextResponse): NextResponse {
  const existing = res.headers.get('Vary');
  if (!existing) {
    res.headers.set('Vary', 'Cookie');
  } else if (!existing.toLowerCase().split(',').map((s) => s.trim()).includes('cookie')) {
    res.headers.set('Vary', `${existing}, Cookie`);
  }
  return res;
}

function withLang(res: NextResponse, lang: 'en' | 'fa'): NextResponse {
  res.headers.set('Content-Language', lang);
  return res;
}

function redirect308(request: NextRequest, pathname: string, search = ''): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  return NextResponse.redirect(url, 308);
}

function redirect307(request: NextRequest, pathname: string, search = ''): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  const res = NextResponse.redirect(url, 307);
  res.headers.set('Cache-Control', 'private, no-store');
  return withVaryCookie(res);
}

function rewriteToFaApp(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = `/fa-app${url.pathname}`;
  const res = NextResponse.rewrite(url);
  res.headers.set('Cache-Control', 'private, no-store');
  return withLang(withVaryCookie(res), 'fa');
}

const STATIC_EXT_RE = /\.(?:webp|png|jpe?g|gif|svg|ico|css|js|mjs|woff2?|ttf|map|txt|xml|json|webmanifest)$/i;

function isSharedBilingualPath(pathname: string): boolean {
  if (pathname.startsWith('/tools/icons/')) return false;
  return (
    pathname === '/models' ||
    pathname === '/leaderboard' ||
    pathname.startsWith('/leaderboard/') ||
    pathname === '/tools' ||
    pathname.startsWith('/tools/') ||
    pathname === '/signup' ||
    pathname === '/signin' ||
    pathname === '/privacy' ||
    pathname === '/terms'
  );
}

/**
 * Enforces canonical URLs with HTTP 308 redirects and preserves user-selected language
 * persistence via the `vg_lang` cookie across shared bilingual routes via internal rewrites.
 * Crawler/anonymous traffic without `vg_lang=fa` sees canonical English routes untouched.
 */
export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (STATIC_EXT_RE.test(pathname)) {
    return NextResponse.next();
  }
  const prefetch = isPrefetch(request);
  const cookieLang = request.cookies.get(LANG_COOKIE)?.value === 'fa' ? 'fa' : 'en';
  const qLang = searchParams.get('lang');

  if (pathname === '/chat') {
    return redirect308(request, '/models');
  }

  // Root home: `/` -> `/fa` when user has selected Persian
  if (pathname === '/') {
    if (qLang === 'en') {
      const sp = new URLSearchParams(searchParams);
      sp.delete('lang');
      const qs = sp.toString();
      const res = redirect307(request, '/', qs ? `?${qs}` : '');
      if (!prefetch) res.cookies.set(LANG_COOKIE, 'en', LANG_COOKIE_OPTS);
      return res;
    }
    if (cookieLang === 'fa') {
      return redirect307(request, '/fa');
    }
    return withLang(withVaryCookie(NextResponse.next()), 'en');
  }

  // Explicit Persian home sets cookie on non-prefetch visits
  if (pathname === '/fa') {
    const res = NextResponse.next();
    if (!prefetch && cookieLang !== 'fa' && qLang !== 'en') {
      res.cookies.set(LANG_COOKIE, 'fa', LANG_COOKIE_OPTS);
    }
    return withLang(res, 'fa');
  }

  // Legacy `/news?lang=fa|en&category=Models&page=2` -> canonical `/news` or `/news/fa` routes
  if (pathname === '/news') {
    const rawCat = searchParams.get('category');
    const cat = rawCat ? parseNewsCategorySlug(rawCat) : null;
    const page = parsePositivePage(searchParams.get('page'));

    if (qLang === 'fa') {
      const target = cat ? `/news/fa/category/${cat.toLowerCase()}` : '/news/fa';
      const res = redirect308(request, target, page && page > 1 ? `?page=${page}` : '');
      if (!prefetch) res.cookies.set(LANG_COOKIE, 'fa', LANG_COOKIE_OPTS);
      return res;
    }

    if (qLang === 'en' || rawCat) {
      const target = cat
        ? page && page > 1
          ? `/news/category/${cat.toLowerCase()}/page/${page}`
          : `/news/category/${cat.toLowerCase()}`
        : '/news';
      const qs = !cat && page && page > 1 ? `?page=${page}` : '';
      const res = redirect308(request, target, qs);
      if (qLang === 'en' && !prefetch) res.cookies.set(LANG_COOKIE, 'en', LANG_COOKIE_OPTS);
      return res;
    }

    if (searchParams.get('page') === '1') {
      const sp = new URLSearchParams(searchParams);
      sp.delete('page');
      const qs = sp.toString();
      return redirect308(request, '/news', qs ? `?${qs}` : '');
    }

    if (cookieLang === 'fa') {
      return redirect307(request, '/news/fa', page && page > 1 ? `?page=${page}` : '');
    }
    return withLang(withVaryCookie(NextResponse.next()), 'en');
  }

  if (pathname === '/news/fa') {
    if (searchParams.get('page') === '1' || searchParams.has('lang')) {
      const page = parsePositivePage(searchParams.get('page'));
      const res = redirect308(request, '/news/fa', page && page > 1 ? `?page=${page}` : '');
      if (!prefetch && cookieLang !== 'fa' && qLang !== 'en') res.cookies.set(LANG_COOKIE, 'fa', LANG_COOKIE_OPTS);
      return res;
    }
    const res = NextResponse.next();
    if (!prefetch && cookieLang !== 'fa') res.cookies.set(LANG_COOKIE, 'fa', LANG_COOKIE_OPTS);
    return withLang(res, 'fa');
  }

  // `/news/category/[category]` & `/news/category/[category]/page/[page]`
  if (pathname.startsWith('/news/category/')) {
    const rest = pathname.slice('/news/category/'.length).split('/');
    const rawCat = rest[0] ?? '';
    const cat = parseNewsCategorySlug(rawCat);
    if (!cat) return NextResponse.next();

    const lower = cat.toLowerCase();
    const qPage = parsePositivePage(searchParams.get('page'));
    if (qLang === 'fa') {
      const res = redirect308(request, `/news/fa/category/${lower}`, qPage && qPage > 1 ? `?page=${qPage}` : '');
      if (!prefetch) res.cookies.set(LANG_COOKIE, 'fa', LANG_COOKIE_OPTS);
      return res;
    }
    if (rest.length === 1) {
      if (qPage && qPage > 1) {
        const res = redirect308(request, `/news/category/${lower}/page/${qPage}`);
        if (qLang === 'en' && !prefetch) res.cookies.set(LANG_COOKIE, 'en', LANG_COOKIE_OPTS);
        return res;
      }
      if (rawCat !== lower || searchParams.has('page') || qLang === 'en') {
        const res = redirect308(request, `/news/category/${lower}`);
        if (qLang === 'en' && !prefetch) res.cookies.set(LANG_COOKIE, 'en', LANG_COOKIE_OPTS);
        return res;
      }
    } else if (rest.length === 3 && rest[1] === 'page') {
      if (rest[2] === '1') {
        const res = redirect308(request, `/news/category/${lower}`);
        if (qLang === 'en' && !prefetch) res.cookies.set(LANG_COOKIE, 'en', LANG_COOKIE_OPTS);
        return res;
      }
      if (rawCat !== lower || qLang === 'en') {
        const res = redirect308(request, `/news/category/${lower}/page/${rest[2]}`);
        if (qLang === 'en' && !prefetch) res.cookies.set(LANG_COOKIE, 'en', LANG_COOKIE_OPTS);
        return res;
      }
    }
    if (cookieLang === 'fa') {
      const pathPage = rest.length === 3 && rest[1] === 'page' ? parsePositivePage(rest[2] ?? null) : qPage;
      return redirect307(request, `/news/fa/category/${lower}`, pathPage && pathPage > 1 ? `?page=${pathPage}` : '');
    }
    return withLang(withVaryCookie(NextResponse.next()), 'en');
  }

  if (pathname.startsWith('/news/fa/category/')) {
    const rawCat = pathname.slice('/news/fa/category/'.length);
    if (!rawCat.includes('/')) {
      const cat = parseNewsCategorySlug(rawCat);
      if (cat) {
        const lower = cat.toLowerCase();
        const page = parsePositivePage(searchParams.get('page'));
        if (rawCat !== lower || searchParams.get('page') === '1' || searchParams.has('lang')) {
          const res = redirect308(request, `/news/fa/category/${lower}`, page && page > 1 ? `?page=${page}` : '');
          if (!prefetch && cookieLang !== 'fa' && qLang !== 'en') res.cookies.set(LANG_COOKIE, 'fa', LANG_COOKIE_OPTS);
          return res;
        }
      }
    }
    const res = NextResponse.next();
    if (!prefetch && cookieLang !== 'fa') res.cookies.set(LANG_COOKIE, 'fa', LANG_COOKIE_OPTS);
    return withLang(res, 'fa');
  }

  // Legacy `/tools?category=Coding` -> `/tools/category/coding`
  if (pathname === '/tools') {
    const rawCat = searchParams.get('category');
    if (
      rawCat &&
      !searchParams.get('q') &&
      !searchParams.get('pricing') &&
      !searchParams.get('vigas') &&
      !searchParams.get('sort')
    ) {
      const cat = parseToolCategorySlug(rawCat);
      return redirect308(request, cat ? `/tools/category/${cat.toLowerCase()}` : '/tools');
    }
  }

  if (pathname.startsWith('/tools/category/')) {
    const raw = pathname.slice('/tools/category/'.length);
    if (!raw.includes('/')) {
      const cat = parseToolCategorySlug(raw);
      if (cat && raw !== cat.toLowerCase()) return redirect308(request, `/tools/category/${cat.toLowerCase()}`);
    }
  }

  if (pathname.startsWith('/tools/collection/')) {
    const raw = pathname.slice('/tools/collection/'.length);
    if (!raw.includes('/')) {
      const slug = parseToolCollectionSlug(raw);
      if (slug && raw !== slug) return redirect308(request, `/tools/collection/${slug}`);
    }
  }

  if (pathname.startsWith('/leaderboard/')) {
    const raw = pathname.slice('/leaderboard/'.length);
    if (!raw.includes('/')) {
      const lower = raw.toLowerCase();
      if (lower === 'overall') return redirect308(request, '/leaderboard');
      if (raw !== lower && LEADERBOARD_CATEGORIES.some((c) => c.id === lower)) {
        return redirect308(request, `/leaderboard/${lower}`);
      }
    }
  }

  // Shared bilingual routes: preserve EN for anonymous visitors, rewrite to `/fa-app/*` when `vg_lang=fa`
  if (isSharedBilingualPath(pathname)) {
    if (qLang === 'en') {
      const res = withLang(withVaryCookie(NextResponse.next()), 'en');
      if (!prefetch) res.cookies.set(LANG_COOKIE, 'en', LANG_COOKIE_OPTS);
      return res;
    }
    if (cookieLang === 'fa') {
      return rewriteToFaApp(request);
    }
    return withLang(withVaryCookie(NextResponse.next()), 'en');
  }

  if (pathname.startsWith('/news/fa-')) {
    return withLang(NextResponse.next(), 'fa');
  }
  if (pathname.startsWith('/news/')) {
    return withLang(NextResponse.next(), 'en');
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/fa',
    '/chat',
    '/models',
    '/leaderboard',
    '/leaderboard/:path*',
    '/tools',
    '/tools/:path*',
    '/signup',
    '/signin',
    '/privacy',
    '/terms',
    '/news',
    '/news/:path*',
  ],
};
