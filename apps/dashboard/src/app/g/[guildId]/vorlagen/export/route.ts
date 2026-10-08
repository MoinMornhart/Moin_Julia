import { NextResponse } from 'next/server';
import { requireGuildAccess } from '@/lib/access';
import { exportGuild } from '@/lib/templates';

export const dynamic = 'force-dynamic';

/** Vorlage als Datei herunterladen */
export async function GET(_request: Request, { params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { canEdit, guild } = await requireGuildAccess(guildId);
  if (!canEdit) return new NextResponse('Nur Owner und Admins', { status: 403 });
  const template = await exportGuild(guildId);
  const slug = guild.name.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '') || 'server';
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(template, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="moin-julia-vorlage-${encodeURIComponent(slug)}-${date}.json"`,
    },
  });
}
