import { NextResponse } from 'next/server';
import { clearAttempts, createSession, getAdminPassword, registerAttempt, safeEqual, SESSION_COOKIE } from '@/lib/auth';
import { badRequest, clientKey } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let password: unknown;
  try {
    ({ password } = await request.json());
  } catch {
    return badRequest('Malformed request body.');
  }

  if (typeof password !== 'string' || password.length === 0) {
    return badRequest('Password is required.');
  }

  const key = clientKey(request);
  const attempt = registerAttempt(key);
  if (!attempt.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.', retryAfter: attempt.retryAfter },
      { status: 429, headers: { 'Retry-After': String(attempt.retryAfter) } },
    );
  }

  if (!safeEqual(password, getAdminPassword())) {
    // Deliberately vague: the form only ever needs to know that it failed.
    return NextResponse.json({ error: 'Invalid password.' }, { status: 401 });
  }

  clearAttempts(key);
  const { token, maxAge } = await createSession();

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });
  return response;
}
