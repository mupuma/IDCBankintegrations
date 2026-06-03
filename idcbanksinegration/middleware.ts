import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from './app/lib/auth';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/bank_details')) {
    const token = request.cookies.get('session')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      await decrypt(token);
    } catch (error) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.set('session', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      });
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/bank_details/:path*'],
};
