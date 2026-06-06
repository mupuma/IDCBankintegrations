import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

function useSecureCookies(): boolean {
  // Production builds default to secure cookies, but HTTP deployments must opt out.
  if (process.env.SESSION_COOKIE_SECURE === 'true') {
    return true;
  }
  if (process.env.SESSION_COOKIE_SECURE === 'false') {
    return false;
  }
  return process.env.NODE_ENV === 'production';
}

export function sessionCookieOptions(maxAge: number): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure: useSecureCookies(),
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}

export function clearSessionCookieOptions(): Partial<ResponseCookie> {
  return sessionCookieOptions(0);
}
