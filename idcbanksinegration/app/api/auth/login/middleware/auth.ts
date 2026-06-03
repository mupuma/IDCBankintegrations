import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '../../../../lib/auth';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value;

  if (!token && request.nextUrl.pathname.startsWith('/bank_details')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token) {
    try {
      await decrypt(token);
    } catch (error) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export async function verifySessionToken(token?: string) {
  if (!token) return null;
  try {
    return await decrypt(token);
  } catch {
    return null;
  }
}
