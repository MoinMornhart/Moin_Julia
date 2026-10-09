import { NextResponse, type NextRequest } from 'next/server';
import { getModule } from '@moin/shared';
import { requireGuildAccess } from '@/lib/access';
import { exportGuild } from '@/lib/templates';

export const dynamic = 'force-dynamic';

/**
 * Vorlage als Datei herunterladen – alles oder nur einzelne Module:
 * `?modul=logging&modul=level` (mehrfach möglich), `&panels=0|1` (Rollen-Panels; Standard: bei „alles“ ja,
 * bei Auswahl nur, wenn „Willkommen & Rollen“ dabei ist).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { canEdit, guild } = await requireGuildAccess(guildId);
  if (!canEdit) return new NextResponse('Nur Owner und Admins', { status: 403 });

  const search = request.nextUrl.searchParams;
  const modules = [...new Set(search.getAll('modul'))].filter((id) => getModule(id) && !getModule(id)?.ownerOnly);
  if (search.getAll('modul').length && !modules.length) return new NextResponse('Unbekanntes Modul', { status: 400 });
  const panelsParam = search.get('panels');
  const panels = panelsParam !== null ? panelsParam === '1' : !modules.length || modules.includes('willkommen');

  const template = await exportGuild(guildId, { modules, panels });
  const slug = guild.name.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '') || 'server';
  const date = new Date().toISOString().slice(0, 10);
  const part = modules.length === 1 ? `-${modules[0]}` : modules.length ? `-${modules.length}-module` : '';
  return new NextResponse(JSON.stringify(template, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="moin-julia-vorlage-${encodeURIComponent(slug)}${part}-${date}.json"`,
    },
  });
}
