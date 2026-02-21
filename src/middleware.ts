import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PLATFORMS = new Set(['github', 'gitlab', 'bitbucket']);

// Reserved paths that should NOT be treated as platform prefixes
const RESERVED_PATHS = new Set(['api', 'wiki', '_next', 'favicon.ico', 'embed']);

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const segments = pathname.split('/').filter(Boolean);

  // Check if first segment is a platform prefix: /github/owner/repo → /owner/repo?type=github
  if (segments.length >= 3 && PLATFORMS.has(segments[0]) && !RESERVED_PATHS.has(segments[0])) {
    const platform = segments[0];
    const rest = segments.slice(1).join('/');

    const url = request.nextUrl.clone();
    url.pathname = `/${rest}`;

    // Preserve existing params and add type
    if (!searchParams.has('type')) {
      url.searchParams.set('type', platform);
    }

    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  // Only run on paths that could be platform-prefixed wiki routes
  matcher: ['/(github|gitlab|bitbucket)/:path*'],
};
