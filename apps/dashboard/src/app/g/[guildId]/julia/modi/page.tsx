import { DEFAULT_MODE_NAME, parseJuliaConfig } from '@moin/shared';
import { ActionButton } from '@/components/ActionButton';
import { JuliaModesEditor } from '@/components/JuliaModesEditor';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { fetchGuildChannels, type ChannelOption } from '@/lib/discord';
import { getModuleRow } from '@/lib/modules';
import { juliaTabs } from '@/lib/tabs';
import { resetChannelMode } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Julia – Modi' };

export default async function JuliaModesPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'julia');
  const config = parseJuliaConfig(row.config);
  const active = await db().juliaChannelMode.findMany({ where: { guildId } });
  let channels: ChannelOption[] = [];
  try {
    channels = await fetchGuildChannels(guildId);
  } catch {
    // Kanalnamen fehlen dann nur
  }

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <ModuleTabs active="modes" tabs={juliaTabs(guildId)} />
      {active.length > 0 && (
        <div className="card mb-6 grid max-w-4xl gap-2 p-5 text-sm">
          <p className="font-semibold">Gerade aktiv</p>
          <ul className="grid gap-2">
            {active.map((a) => (
              <li key={a.channelId} className="flex flex-wrap items-center gap-3">
                <span>#{channels.find((c) => c.id === a.channelId)?.name ?? a.channelId}</span>
                <span className="chip bg-coral-500/15 text-coral-400">{config.modes.find((m) => m.id === a.modeId)?.name ?? DEFAULT_MODE_NAME}</span>
                {canEdit && <ActionButton label="Zurück auf Standard" run={resetChannelMode.bind(null, guildId, a.channelId)} />}
              </li>
            ))}
          </ul>
        </div>
      )}
      <JuliaModesEditor guildId={guildId} canEdit={canEdit} initial={config.modes} provider={config.provider} />
    </>
  );
}
