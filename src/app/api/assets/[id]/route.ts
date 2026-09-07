import { NextResponse } from 'next/server';
import { getAsset } from '@/lib/store';

export const runtime = 'nodejs';

/** Public: uploaded images are referenced from the landing page. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: 'Bad asset id.' }, { status: 400 });
  }

  const asset = await getAsset(id);
  if (!asset) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  // Ids are content-addressed by creation, so a URL never changes meaning.
  return new NextResponse(Buffer.from(asset.bytes), {
    headers: {
      'Content-Type': asset.mime,
      'Content-Length': String(asset.bytes.byteLength),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
