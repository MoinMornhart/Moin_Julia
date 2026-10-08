import { parseLoggingConfig } from '@moin/shared';
import { LoggingForm } from '@/components/LoggingForm';
import { ModuleHeader } from '@/components/ModuleHeader';
import { requireGuildAccess } from '@/lib/access';
import { fetchGuildChannels, type ChannelOption } from '@/lib/discord';
import { getModuleRow } from '@/lib/modules';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Logging' };

export default async function LoggingPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'logging');

  let channels: ChannelOption[] = [];
  let channelsError = false;
  try {
    channels = await fetchGuildChannels(guildId);
  } catch {
    channelsError = true;
  }

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      {!row.enabled && (
        <p className="mb-6 rounded-xl border border-sun-400/40 bg-sun-400/10 px-4 py-3 text-sm">
          Das Modul ist aus. Du kannst alles schon einstellen – geloggt wird erst, wenn du es oben einschaltest.
        </p>
      )}
      {channelsError && (
        <p className="mb-6 rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm">
          Die Kanäle konnten nicht geladen werden. Ist der Bot auf dem Server und der Bot-Token korrekt?
        </p>
      )}
      <LoggingForm guildId={guildId} canEdit={canEdit} config={parseLoggingConfig(row.config)} channels={channels} />
    </>
  );
}
