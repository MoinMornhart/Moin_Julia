import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appVersion } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await db().$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', version: appVersion() });
  } catch {
    return NextResponse.json({ status: 'error', database: false, version: appVersion() }, { status: 503 });
  }
}
