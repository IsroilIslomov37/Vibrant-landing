import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lets the admin shell confirm a session without rendering a protected page. */
export async function GET() {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  return NextResponse.json({ authenticated: Boolean(session), expiresAt: session?.exp ?? null });
}
