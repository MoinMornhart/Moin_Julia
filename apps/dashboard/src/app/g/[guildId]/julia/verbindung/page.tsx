import { loadGuildSecrets } from '@moin/db';
import { parseJuliaConfig, parseOllamaEndpoints, publicOllamaEndpoint } from '@moin/shared';
import { ClaudeConnection } from '@/components/JuliaConnections';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { OllamaEndpoints } from '@/components/OllamaEndpoints';
import { ServerKeys } from '@/components/ServerKeys';
import { requireGuildAccess } from '@/lib/access';
import { appSettings } from '@/lib/config';
import { db } from '@/lib/db';
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
  const config = parseJuliaConfig(row.config);
  // Server-Schlüssel nur maskiert an den Browser
  const own = await loadGuildSecrets(db(), guildId).catch(() => null);
  const masked = Object.fromEntries(
    Object.entries(own ?? {})
      .filter(([, v]) => !!v)
      .map(([k, v]) => [k.replace(/ApiKey$/, ''), `••••${v!.slice(-4)}`]),
  );
  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <ModuleTabs active="connection" tabs={juliaTabs(guildId)} />
      <div className="grid max-w-4xl gap-6">
        <ClaudeConnection guildId={guildId} isAdmin={isAdmin} masked={s.anthropicApiKey ? `••••${s.anthropicApiKey.slice(-4)}` : null} />
        <OllamaEndpoints guildId={guildId} isAdmin={isAdmin} endpoints={parseOllamaEndpoints(s.ollamaEndpoints, { url: s.ollamaUrl, model: s.ollamaModel }).map(publicOllamaEndpoint)} />
        <p className="text-xs text-fog-500">Claude und Ollama oben gelten für alle Server dieser Moin_Julia-Instanz; welchen Ollama-Endpunkt ein Server nutzt, stellst du unter „Einstellungen“ ein. Schlüssel liegen verschlüsselt in deiner Datenbank und werden nirgends angezeigt.</p>
        <ServerKeys guildId={guildId} canEdit={canEdit} isAdmin={isAdmin} masked={masked} customBaseUrl={config.customBaseUrl} />
      </div>
    </>
  );
}
