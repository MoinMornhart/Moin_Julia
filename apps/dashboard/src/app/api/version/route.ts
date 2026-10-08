import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { checkLatest } from '@/lib/update';

export const dynamic = 'force-dynamic';

/** Aktuelle und neueste Version (für die Anzeige unten auf jeder Seite). Änderungsliste nur angemeldet. */
export async function GET() {
  const [info, session] = await Promise.all([checkLatest(), getSession()]);
  return NextResponse.json(session ? info : { ...info, changes: [] });
}
