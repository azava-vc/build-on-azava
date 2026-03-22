import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Inlined to avoid pulling node:crypto into the Edge runtime via auth.ts
const SESSION_COOKIE = "azava_session";

/**
 * Auth gate middleware.
 *
 * If auth env vars are configured, all routes except /auth/* require a valid
 * session cookie. Unauthenticated requests redirect to /auth/login.
 *
 * If auth is NOT configured, the middleware does nothing — all routes are public.
 */
export function middleware(request: NextRequest) {
  // Auth not configured — public tool, pass through
  if (!process.env.AZAVA_OAUTH_CLIENT_ID) {
    return NextResponse.next();
  }

  // Auth routes are always accessible
  if (request.nextUrl.pathname.startsWith("/auth/")) {
    return NextResponse.next();
  }

  // Check for session cookie (existence only — signature is verified server-side)
  const session = request.cookies.get(SESSION_COOKIE);
  if (session) {
    return NextResponse.next();
  }

  // No session — redirect to login with return URL
  const returnUrl = request.nextUrl.pathname + request.nextUrl.search;
  const loginUrl = new URL("/auth/login", request.url);
  loginUrl.searchParams.set("returnUrl", returnUrl);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Match all routes except Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
