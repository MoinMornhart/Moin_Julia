import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { imagePath } from '@/lib/docs';

export const dynamic = 'force-dynamic';

const TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const file = imagePath(parts);
  const type = file ? TYPES[path.extname(file).toLowerCase()] : undefined;
  if (!file || !type) return new NextResponse('Not found', { status: 404 });
  try {
    const data = await readFile(/*turbopackIgnore: true*/ file);
    return new NextResponse(new Uint8Array(data), {
      headers: { 'content-type': type, 'cache-control': 'public, max-age=300' },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
