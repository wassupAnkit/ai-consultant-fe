import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

const PROTECTED_PREFIXES = ["/chat", "/api/chat", "/api/sessions", "/api/knowledge", "/api/events", "/api/feedback", "/api/integrations"];
/** Google's OAuth redirect lands here as a top-level page load, so it gets the login page, not JSON. */
const BROWSER_API_ROUTES = ["/api/integrations/google/callback"];
const HOME_AFTER_LOGIN = "/chat";

/**
 * Google sign-in only, no anonymous fallback: every protected route needs a
 * valid, unexpired Edge session cookie. When Google sign-in is not configured
 * for this deployment (`NEXT_PUBLIC_GOOGLE_CLIENT_ID` unset), the cookie can
 * never be valid, so this fails closed rather than granting access.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const user = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isProtected && !user) {
    if (pathname.startsWith("/api/") && !BROWSER_API_ROUTES.includes(pathname)) {
      return NextResponse.json({ error: { code: "unauthorized", message: "Sign in with your work Google account to use Edge." } }, { status: 401 });
    }
    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("redirectedFrom", pathname.startsWith("/api/") ? HOME_AFTER_LOGIN : pathname);
    return NextResponse.redirect(redirectUrl);
  }
  if (pathname === "/" && user) {
    return NextResponse.redirect(new URL(HOME_AFTER_LOGIN, request.url));
  }
  if (pathname.startsWith("/auth/") && user && !pathname.startsWith("/auth/error")) {
    return NextResponse.redirect(new URL(HOME_AFTER_LOGIN, request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip the dependency-free health probe, Next internals, the service worker and static assets.
  matcher: [
    "/((?!api/health|api/auth|_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*\\.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|js)$).*)",
  ],
};
