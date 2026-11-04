import { NextResponse } from 'next/server';

// UX convenience only: send visitors without a login cookie to /login.
// This is NOT the security boundary - the backend verifies the token and the role on every API call.
export function middleware(req) {
  const { pathname } = req.nextUrl;
  if (pathname === '/login') return NextResponse.next();
  if (!req.cookies.get('token')) return NextResponse.redirect(new URL('/login', req.url));
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'] };
