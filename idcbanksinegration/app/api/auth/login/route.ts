import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { encrypt } from '../../../lib/auth';
import { User } from '../../../models/internal/User';
import { ensureDefaultAdmin } from '../../../lib/initDefaultAdmin';

export async function POST(request: NextRequest) {
  await ensureDefaultAdmin();
  const body = await request.json();
  const username = String(body?.username ?? '').trim();
  const password = String(body?.password ?? '');

  if (!username || !password) {
    return NextResponse.json(
      { error: 'Username and password are required.' },
      { status: 400 }
    );
  }

  const user = await User.findOne({ where: { username } });

  if (!user || !(await user.validatePassword(password))) {
    return NextResponse.json(
      { error: 'Invalid username or password.' },
      { status: 401 }
    );
  }

  const token = await encrypt({
    sub: String(user.id),
    username: user.username,
    role: user.role,
  });

  const response = NextResponse.json({
    success: true,
    user: {
      id: user.id,
      username: user.username
    },
  });

  response.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60,
  });

  return response;
}
