import { NextResponse, type NextRequest } from 'next/server';
import { appSettings } from '@/lib/config';
import { getSession } from '@/lib/session';
import { checkLatest, requestUpdate, updateState } from '@/lib/update';

export const dynamic = 'force-dynamic';

/** Nur der Instanz-Admin darf Updates sehen und starten. */
async function requireOwner() {
  const session = await getSession();
  const { instanceOwnerId } = await appSettings();
  return session && instanceOwnerId && session.userId === instanceOwnerId ? session : null;
}

export async function GET(request: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: 'Nur für den Instanz-Admin.' }, { status: 403 });
  const force = request.nextUrl.searchParams.get('pruefen') === '1';
  const [state, latest] = await Promise.all([updateState(), checkLatest(force)]);
  return NextResponse.json({ ...state, latest });
}

export async function POST() {
  const session = await requireOwner();
  if (!session) return NextResponse.json({ ok: false, message: 'Nur für den Instanz-Admin.' }, { status: 403 });
  const result = await requestUpdate(session.userId);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
