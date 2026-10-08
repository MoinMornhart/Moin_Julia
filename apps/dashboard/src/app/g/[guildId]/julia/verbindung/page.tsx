import { ClaudeConnection, OllamaConnection } from '@/components/JuliaConnections';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { requireGuildAccess } from '@/lib/access';
import { appSettings } from '@/lib/config';
import { getModuleRow } from '@/lib/modules';
import { juliaTabs } from '@/lib/tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Julia – Verbindung' };

export default async function JuliaConnectionPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { session, canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'julia');
  const s = await appSettings();
  const isAdmin = !!s.instanceOwnerId && s.instanceOwnerId === session.userId;
  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <ModuleTabs active="connection" tabs={juliaTabs(guildId)} />
      <div className="grid max-w-4xl gap-6">
        <ClaudeConnection guildId={guildId} isAdmin={isAdmin} masked={s.anthropicApiKey ? `••••${s.anthropicApiKey.slice(-4)}` : null} />
        <OllamaConnection guildId={guildId} isAdmin={isAdmin} url={s.ollamaUrl} model={s.ollamaModel} />
        <p className="text-xs text-fog-500">Die Verbindung gilt für alle Server dieser Moin_Julia-Instanz. Der Schlüssel liegt verschlüsselt in deiner Datenbank und wird nirgends angezeigt.</p>
      </div>
    </>
  );
}
