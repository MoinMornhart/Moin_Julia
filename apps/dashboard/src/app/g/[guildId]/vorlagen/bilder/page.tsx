import { UPLOAD_GUILD_QUOTA_BYTES } from '@moin/shared';
import { ActionButton } from '@/components/ActionButton';
import { ModuleTabs } from '@/components/ModuleTabs';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { vorlagenTabs } from '@/lib/tabs';
import { deleteUpload } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bilder' };

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;

export default async function ImagesPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { canEdit } = await requireGuildAccess(guildId);
  const uploads = await db().upload.findMany({
    where: { guildId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, size: true, createdAt: true },
  });
  const used = uploads.reduce((sum, u) => sum + u.size, 0);

  return (
    <>
      <div className="mb-8">
        <p className="text-xs font-bold tracking-[0.2em] text-fog-500 uppercase">Vorlagen</p>
        <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">Bilder</h1>
        <p className="mt-2 max-w-2xl text-fog-300">
          Bilder, die du vom PC hochgeladen hast (Embed-Bilder, Hintergrund des Willkommensbilds). Hochladen geht direkt dort, wo ein Bild gebraucht wird – hier
          siehst und löschst du sie.
        </p>
      </div>
      <ModuleTabs active="images" tabs={vorlagenTabs(guildId)} />
      <p className="mb-4 text-sm text-fog-500">
        {uploads.length === 1 ? '1 Bild' : `${uploads.length} Bilder`} · {mb(used)} von {mb(UPLOAD_GUILD_QUOTA_BYTES)} belegt
      </p>
      {uploads.length === 0 ? (
        <div className="card max-w-4xl p-8 text-fog-300">Noch keine Bilder hochgeladen.</div>
      ) : (
        <ul className="grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {uploads.map((u) => (
            <li key={u.id} className="card overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element -- geschützte Bilder aus der eigenen API */}
              <img src={`/api/uploads/${u.id}`} alt={u.name} className="aspect-video w-full bg-ink-900 object-contain" loading="lazy" />
              <div className="grid gap-2 p-4">
                <p className="truncate text-sm font-semibold" title={u.name}>
                  {u.name}
                </p>
                <p className="text-xs text-fog-500 tabular-nums">
                  {mb(u.size)} · {u.createdAt.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' })}
                </p>
                <ActionButton label="Löschen" disabled={!canEdit} run={deleteUpload.bind(null, guildId, u.id)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
