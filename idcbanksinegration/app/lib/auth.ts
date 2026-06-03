import { SignJWT, jwtVerify } from 'jose';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET must be defined in environment variables.');
  }
  return new TextEncoder().encode(secret);
}

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN || '1h')
    .sign(getJwtSecret());
}

export async function decrypt(input: string): Promise<any> {
  const { payload } = await jwtVerify(input, getJwtSecret(), {
    algorithms: ['HS256'],
  });
  return payload;
}