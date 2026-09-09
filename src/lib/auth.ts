/**
 * Stateless session tokens for the admin panel.
 *
 * A token is `base64url(payload).base64url(HMAC-SHA256(payload))`. Everything
 * here uses Web Crypto, so the exact same verification runs in the Edge
 * middleware and in Node route handlers — no second implementation to drift.
 *
 * For a multi-admin deployment, swap this module for NextAuth or Supabase Auth;
 * the route handlers only depend on `verifySession` / `createSession`.
 */

export const SESSION_COOKIE = 'vs_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
}

function getSecret(): string {
  const secret = process.env.ADMIN_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_SECRET must be set to a value of at least 16 characters in production.');
  }
  // Development-only fallback so `npm run dev` works with zero configuration.
  return 'vibrant-school-dev-secret-change-me';
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || 'admin123';
}

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function createSession(sub = 'admin'): Promise<{ token: string; maxAge: number }> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { sub, iat: now, exp: now + SESSION_TTL_SECONDS };
  const payloadPart = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const key = await getKey();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadPart));
  return {
    token: `${payloadPart}.${base64UrlEncode(new Uint8Array(signature))}`,
    maxAge: SESSION_TTL_SECONDS,
  };
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const [payloadPart, signaturePart] = token.split('.');
  if (!payloadPart || !signaturePart) return null;

  try {
    const key = await getKey();
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(signaturePart) as unknown as BufferSource,
      encoder.encode(payloadPart),
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadPart))) as SessionPayload;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Constant-time string comparison so login timing cannot leak the password. */
export function safeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  // Compare a fixed number of bytes regardless of input length.
  const length = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

/* --------------------------------------------------------- login throttling */

const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

export function registerAttempt(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfter: 0 };
}

export function clearAttempts(key: string) {
  attempts.delete(key);
}
