import { NextResponse } from 'next/server';
import { appSettings } from '@/lib/config';
import { getSession } from '@/lib/session';
import { checkLatest } from '@/lib/update';

export const dynamic = 'force-dynamic';

/**
 * Aktuelle und neueste Version (für die Anzeige unten auf jeder Seite). Änderungsliste nur angemeldet.
 * `canUpdate`: Nur der Instanz-Admin darf aufs System → Update (alle anderen bekämen dort sonst eine 404).
 */
export async function GET() {
  const [info, session, settings] = await Promise.all([checkLatest(), getSession(), appSettings()]);
  const canUpdate = !!session && !!settings.instanceOwnerId && session.userId === settings.instanceOwnerId;
  return NextResponse.json(session ? { ...info, canUpdate } : { ...info, changes: [], canUpdate: false });
}
