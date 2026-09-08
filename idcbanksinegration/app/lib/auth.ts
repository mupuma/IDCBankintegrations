import { SignJWT, jwtVerify } from 'jose';

const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET must be defined in environment variables.');
  }
  return new TextEncoder().encode(secret);
}

export function getSessionMaxAgeSeconds() {
  const raw = process.env.SESSION_MAX_AGE_SECONDS;
  const parsed = raw ? Number(raw) : DEFAULT_SESSION_MAX_AGE_SECONDS;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SESSION_MAX_AGE_SECONDS;
}

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${getSessionMaxAgeSeconds()}s`)
    .sign(getJwtSecret());
}

export async function decrypt(input: string): Promise<any> {
  const { payload } = await jwtVerify(input, getJwtSecret(), {
    algorithms: ['HS256'],
  });
  return payload;
}
