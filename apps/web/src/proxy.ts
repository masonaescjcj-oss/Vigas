import { NextResponse, type NextRequest } from 'next/server';
import { LEADERBOARD_CATEGORIES } from '@vigas/core';
import { parseNewsCategorySlug, parseToolCategorySlug, parseToolCollectionSlug } from '@/lib/seo-catalog';

function parsePositivePage(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 && n <= 1000 ? n : null;
}

function redirect308(request: NextRequest, pathname: string, search = ''): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  return NextResponse.redirect(url, 308);
}

/**
 * Enforces canonical, lowercase, clean URLs with true HTTP 308 redirects before page streaming starts.
 */
export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Legacy `/news?category=Models&page=2` -> `/news/category/models(/page/2)`
  if (pathname === '/news') {
    const rawCat = searchParams.get('category');
    if (rawCat) {
      const cat = parseNewsCategorySlug(rawCat);
      const page = parsePositivePage(searchParams.get('page'));
      if (cat) {
        const target = page && page > 1 ? `/news/category/${cat.toLowerCase()}/page/${page}` : `/news/category/${cat.toLowerCase()}`;
        return redirect308(request, target);
      }
      return redirect308(request, '/news', page && page > 1 ? `?page=${page}` : '');
    }
    if (searchParams.get('page') === '1') {
      const sp = new URLSearchParams(searchParams);
      sp.delete('page');
      const qs = sp.toString();
      return redirect308(request, '/news', qs ? `?${qs}` : '');
    }
    return NextResponse.next();
  }

  // `/news/category/[category]` & `/news/category/[category]/page/[page]`
  if (pathname.startsWith('/news/category/')) {
    const rest = pathname.slice('/news/category/'.length).split('/');
    const rawCat = rest[0] ?? '';
    const cat = parseNewsCategorySlug(rawCat);
    if (!cat) return NextResponse.next();

    const lower = cat.toLowerCase();
    const qPage = parsePositivePage(searchParams.get('page'));
    if (rest.length === 1) {
      if (qPage && qPage > 1) return redirect308(request, `/news/category/${lower}/page/${qPage}`);
      if (rawCat !== lower || searchParams.has('page')) return redirect308(request, `/news/category/${lower}`);
    } else if (rest.length === 3 && rest[1] === 'page') {
      if (rest[2] === '1') return redirect308(request, `/news/category/${lower}`);
      if (rawCat !== lower) return redirect308(request, `/news/category/${lower}/page/${rest[2]}`);
    }
    return NextResponse.next();
  }

  // Legacy `/tools?category=Coding` (without interactive search/pricing/sort/vigas filters) -> `/tools/category/coding`
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
    return NextResponse.next();
  }

  if (pathname.startsWith('/tools/category/')) {
    const raw = pathname.slice('/tools/category/'.length);
    if (!raw.includes('/')) {
      const cat = parseToolCategorySlug(raw);
      if (cat && raw !== cat.toLowerCase()) return redirect308(request, `/tools/category/${cat.toLowerCase()}`);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/tools/collection/')) {
    const raw = pathname.slice('/tools/collection/'.length);
    if (!raw.includes('/')) {
      const slug = parseToolCollectionSlug(raw);
      if (slug && raw !== slug) return redirect308(request, `/tools/collection/${slug}`);
    }
    return NextResponse.next();
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
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/news', '/news/category/:path*', '/tools', '/tools/category/:path*', '/tools/collection/:path*', '/leaderboard/:path*'],
};
