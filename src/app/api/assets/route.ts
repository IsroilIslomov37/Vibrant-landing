import { NextResponse } from 'next/server';
import { badRequest, requireAdmin, serverError, storageError } from '@/lib/api';
import { putAsset } from '@/lib/store';
import { createId } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']);

/**
 * Stores an admin-uploaded image and returns a stable URL.
 *
 * Images used to be inlined into the content document as data URLs, which meant
 * every page render parsed megabytes of base64. They now live beside the content
 * and are referenced by URL instead.
 */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get('file');
    if (value instanceof File) file = value;
  } catch {
    return badRequest('Expected multipart/form-data with a "file" field.');
  }

  if (!file) return badRequest('No file was uploaded.');
  if (!ALLOWED.has(file.type)) {
    return badRequest(`Unsupported image type "${file.type}". Use PNG, JPEG, WebP, GIF or SVG.`);
  }
  if (file.size > MAX_BYTES) {
    return badRequest('The image is larger than 2 MB. Compress it and try again.');
  }

  try {
    const id = createId('img');
    const bytes = new Uint8Array(await file.arrayBuffer());
    await putAsset(id, { mime: file.type, bytes });
    return NextResponse.json({ id, url: `/api/assets/${id}` }, { status: 201 });
  } catch (error) {
    const unavailable = storageError(error);
    if (unavailable) return unavailable;
    console.error('[api/assets] POST failed', error);
    return serverError('Could not store the image.');
  }
}
