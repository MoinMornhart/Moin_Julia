import { NextResponse, type NextRequest } from 'next/server';
import { accessLevel } from '@/lib/access';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Hochgeladenes Bild anzeigen – nur für Personen mit Zugriff auf den Server. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || !/^[a-z0-9]{20,40}$/.test(id)) return new NextResponse(null, { status: 404 });
  const upload = await db().upload.findUnique({ where: { id }, select: { guildId: true, mime: true, data: true } });
  const guild = upload ? await db().guild.findUnique({ where: { id: upload.guildId } }) : null;
  if (!upload || !guild || !(await accessLevel(session, guild))) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(upload.data), {
    headers: {
      'content-type': upload.mime,
      'cache-control': 'private, max-age=86400, immutable',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'",
    },
  });
}
