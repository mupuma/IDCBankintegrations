import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from './app/lib/auth';
import { clearSessionCookieOptions } from './app/lib/sessionCookie';

function loginRedirect(request: NextRequest) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!pathname.startsWith('/bank_details')) {
    return NextResponse.next();
  }

  const token = request.cookies.get('session')?.value;
  if (!token) {
    return loginRedirect(request);
  }

  try {
    await decrypt(token);
  } catch {
    const response = loginRedirect(request);
    response.cookies.set('session', '', clearSessionCookieOptions());
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/bank_details', '/bank_details/:path*'],
};
