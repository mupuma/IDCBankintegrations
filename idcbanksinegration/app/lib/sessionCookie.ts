import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

function useSecureCookies(): boolean {
  // Only use Secure cookies when explicitly enabled (many IDC deployments run on HTTP).
  return process.env.SESSION_COOKIE_SECURE === 'true';
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
