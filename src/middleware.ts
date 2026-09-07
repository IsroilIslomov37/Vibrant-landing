import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';

/**
 * Gate for the admin panel.
 *
 * The same HMAC verification runs here (Edge) and in the route handlers (Node),
 * so a forged or expired cookie can never reach a page or an API write. The
 * route handlers still re-check independently — the middleware is a redirect
 * convenience, not the only line of defence.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  if (pathname === '/admin/login') {
    if (session) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL('/admin/login', request.url);
    if (pathname !== '/admin') loginUrl.searchParams.set('from', pathname);
    const response = NextResponse.redirect(loginUrl);
    // Clear an expired cookie so the login page does not bounce back.
    if (token) response.cookies.set({ name: SESSION_COOKIE, value: '', path: '/', maxAge: 0 });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
