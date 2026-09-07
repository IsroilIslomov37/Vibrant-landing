import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from './auth';
import { StorageUnavailableError } from './store';

/** Returns a 401 response when the caller has no valid admin session. */
export async function requireAdmin(): Promise<NextResponse | null> {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function serverError(message = 'Internal server error') {
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * Turns a persistence failure into a 503 the UI can explain, rather than an
 * opaque 500. Returns null for every other error so the caller can fall through
 * to its own handling.
 */
export function storageError(error: unknown): NextResponse | null {
  if (error instanceof StorageUnavailableError) {
    console.error('[storage] write rejected:', error.message);
    return NextResponse.json(
      { error: error.message, code: 'storage_unavailable' },
      { status: 503 },
    );
  }
  return null;
}

/** Best-effort client identity for login throttling. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'local';
}
