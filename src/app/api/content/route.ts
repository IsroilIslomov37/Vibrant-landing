import { NextResponse } from 'next/server';
import { badRequest, requireAdmin, serverError, storageError } from '@/lib/api';
import { getContent, resetContent, saveContent } from '@/lib/store';
import type { SiteContent } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await getContent());
  } catch (error) {
    console.error('[api/content] GET failed', error);
    return serverError();
  }
}

/** Shape check before a write — a malformed save would break the public page. */
function isSiteContent(value: unknown): value is SiteContent {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<SiteContent>;
  return (
    typeof candidate.brand === 'object' &&
    typeof candidate.hero === 'object' &&
    Array.isArray(candidate.hero?.stages) &&
    typeof candidate.courses === 'object' &&
    Array.isArray(candidate.courses?.items) &&
    Array.isArray(candidate.courses?.categories) &&
    typeof candidate.mentors === 'object' &&
    Array.isArray(candidate.mentors?.items) &&
    typeof candidate.reviews === 'object' &&
    Array.isArray(candidate.reviews?.items) &&
    typeof candidate.footer === 'object'
  );
}

export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return badRequest('Malformed JSON body.');
  }

  if (!isSiteContent(payload)) {
    return badRequest('Payload does not match the expected site content shape.');
  }

  try {
    return NextResponse.json(await saveContent(payload));
  } catch (error) {
    const unavailable = storageError(error);
    if (unavailable) return unavailable;
    console.error('[api/content] PUT failed', error);
    return serverError('Could not persist content.');
  }
}

/** Restores the shipped seed content. */
export async function DELETE() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    return NextResponse.json(await resetContent());
  } catch (error) {
    const unavailable = storageError(error);
    if (unavailable) return unavailable;
    console.error('[api/content] DELETE failed', error);
    return serverError('Could not reset content.');
  }
}
