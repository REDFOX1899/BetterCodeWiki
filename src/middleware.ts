import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from 'next/server';

const PLATFORMS = new Set(['github', 'gitlab', 'bitbucket']);

// Reserved paths that should NOT be treated as platform prefixes
const RESERVED_PATHS = new Set(['api', 'wiki', '_next', 'favicon.ico', 'embed']);

// Check whether Clerk is configured with a valid publishable key
const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const isClerkEnabled = clerkPubKey.startsWith("pk_");

// Define public routes that don't require authentication
const isPublicRoute = isClerkEnabled
  ? createRouteMatcher([
      "/",                    // Landing page
      "/wiki/projects",       // Cached project browser
      "/api/(.*)",            // API rewrites to backend
      "/webhooks/(.*)",       // Webhook endpoints
      "/_next/(.*)",          // Next.js internals
      "/favicon.ico",         // Favicon
      "/.*\\..*",             // Static assets (files with extensions)
    ])
  : null;

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

// When Clerk is enabled, wrap platform rewriting inside clerkMiddleware so
// auth info is attached to every request.
const clerkHandler = isClerkEnabled
  ? clerkMiddleware(async (auth, request) => {
      // Public routes pass through without auth checks.
      // All other routes (e.g. /[owner]/[repo]) go through Clerk's auth
      // middleware which attaches auth info but does not block access.
      // Feature gating is handled at the component level.
      if (isPublicRoute && !isPublicRoute(request)) {
        // Don't call auth.protect() — we just let Clerk attach auth info.
        // The wiki viewer components will check auth status themselves.
      }

      return handlePlatformRewrite(request) ?? NextResponse.next();
    })
  : null;

// When Clerk is NOT available (e.g. during Docker build or when key is not
// configured), use a plain middleware that only handles platform rewrites.
function plainMiddleware(request: NextRequest) {
  return handlePlatformRewrite(request) ?? NextResponse.next();
}

export default isClerkEnabled ? clerkHandler! : plainMiddleware;

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
