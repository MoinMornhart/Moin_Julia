import { NextResponse, type NextRequest } from 'next/server';
import { sniffImageType, UPLOAD_MAX_BYTES, UPLOAD_PREFIX } from '@moin/shared';
import { applyGuild } from '@/lib/applications';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

/**
 * Bild-Upload für Bewerbungen (Datei-Fragen). Nur angemeldet, nur Mitglieder des Servers,
 * nur echte Bilder bis 8 MB, höchstens 20 Uploads bzw. 40 MB pro Person und Tag und 60 MB pro Person insgesamt.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return fail(401, 'Bitte zuerst mit Discord anmelden.');
  // Zu große Anfragen gar nicht erst einlesen (Schutz vor Speicher-Überlauf)
  if (Number(request.headers.get('content-length') ?? 0) > UPLOAD_MAX_BYTES + 64 * 1024) return fail(413, 'Das Bild ist zu groß (max. 8 MB).');
  const form = await request.formData().catch(() => null);
  const guildId = form?.get('guildId');
  const file = form?.get('file');
  if (typeof guildId !== 'string' || !(file instanceof File)) return fail(400, 'Keine Datei erhalten.');
  const target = await applyGuild(guildId);
  if (!target?.enabled) return fail(404, 'Bewerbungen sind hier geschlossen.');
  if (!session.demo && !session.guilds.some((g) => g.id === guildId)) return fail(403, 'Nur Mitglieder des Servers können sich bewerben.');
  if (file.size > UPLOAD_MAX_BYTES) return fail(413, 'Das Bild ist zu groß (max. 8 MB).');
  const mine = { guildId, createdBy: session.userId };
  const [today, total] = await Promise.all([
    db().upload.aggregate({ where: { ...mine, createdAt: { gte: new Date(Date.now() - 86_400_000) } }, _count: true, _sum: { size: true } }),
    db().upload.aggregate({ where: mine, _sum: { size: true } }),
  ]);
  if (today._count >= 20 || (today._sum.size ?? 0) + file.size > 40 * 1024 * 1024) return fail(429, 'Für heute hast du genug hochgeladen.');
  if ((total._sum.size ?? 0) + file.size > 60 * 1024 * 1024) return fail(413, 'Du hast hier schon sehr viele Bilder hochgeladen (60 MB).');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImageType(bytes);
  if (!mime) return fail(415, 'Nur Bilder (PNG, JPG, GIF, WebP).');
  const upload = await db().upload.create({
    data: { guildId, name: file.name.slice(0, 120) || 'bild', mime, size: bytes.length, data: bytes, createdBy: session.userId },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, ref: `${UPLOAD_PREFIX}${upload.id}`, url: `/api/uploads/${upload.id}` });
}
