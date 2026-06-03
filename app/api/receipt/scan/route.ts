import { NextRequest, NextResponse } from 'next/server';
import { parseReceiptImage } from '@/lib/claude';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

function isAllowedType(t: string): t is AllowedType {
  return (ALLOWED_TYPES as readonly string[]).includes(t);
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const image = formData.get('image') as File | null;

  if (!image) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }

  const mediaType = image.type;
  if (!isAllowedType(mediaType)) {
    return NextResponse.json(
      { error: 'Unsupported image format. Use JPEG, PNG, GIF, or WebP.' },
      { status: 400 }
    );
  }

  const bytes = await image.arrayBuffer();
  const base64 = Buffer.from(bytes).toString('base64');

  const items = await parseReceiptImage(base64, mediaType);
  return NextResponse.json({ items });
}
