import { NextResponse, type NextRequest } from 'next/server';

const PLATFORMS = new Set(['github', 'gitlab', 'bitbucket']);

// Reserved paths that should NOT be treated as platform prefixes
const RESERVED_PATHS = new Set(['api', 'wiki', '_next', 'favicon.ico', 'embed']);

/**
 * Shared platform-prefix rewrite logic.
 * Rewrites /github/owner/repo → /owner/repo?type=github (and likewise for gitlab/bitbucket).
 * Returns a NextResponse rewrite if applicable, otherwise null.
 */
function handlePlatformRewrite(request: NextRequest): NextResponse | null {
  const { pathname, searchParams } = request.nextUrl;
  const segments = pathname.split('/').filter(Boolean);

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

  return null;
}

export default function middleware(request: NextRequest) {
  return handlePlatformRewrite(request) ?? NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Platform-prefixed wiki routes
    "/(github|gitlab|bitbucket)/:path*",
  ],
};
