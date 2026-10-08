import { NextResponse, type NextRequest } from 'next/server';
import { sniffImageType, UPLOAD_GUILD_QUOTA_BYTES, UPLOAD_MAX_BYTES, UPLOAD_PREFIX } from '@moin/shared';
import { accessLevel } from '@/lib/access';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

/** Bild vom PC hochladen (PNG, JPG, GIF, WebP · max. 8 MB · 100 MB pro Server). Antwort: { ok, ref: "upload:<id>" } */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return fail(401, 'Bitte neu anmelden.');
  const form = await request.formData().catch(() => null);
  const guildId = form?.get('guildId');
  const file = form?.get('file');
  if (typeof guildId !== 'string' || !(file instanceof File)) return fail(400, 'Keine Datei erhalten.');

  const guild = await db().guild.findUnique({ where: { id: guildId } });
  const level = guild?.botPresent ? await accessLevel(session, guild) : null;
  if (!level || level === 'mod') return fail(403, 'Nur Owner und Admins dürfen Bilder hochladen.');
  if (file.size > UPLOAD_MAX_BYTES) return fail(413, 'Das Bild ist zu groß (max. 8 MB).');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImageType(bytes);
  if (!mime) return fail(415, 'Nur PNG, JPG, GIF oder WebP.');

  const used = await db().upload.aggregate({ where: { guildId }, _sum: { size: true } });
  if ((used._sum.size ?? 0) + bytes.length > UPLOAD_GUILD_QUOTA_BYTES) {
    return fail(413, 'Der Speicher für Bilder dieses Servers ist voll (100 MB). Lösche alte Bilder unter „Vorlagen → Bilder“.');
  }
  const upload = await db().upload.create({
    data: { guildId, name: file.name.slice(0, 120) || 'bild', mime, size: bytes.length, data: bytes, createdBy: session.userId },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, ref: `${UPLOAD_PREFIX}${upload.id}` });
}
