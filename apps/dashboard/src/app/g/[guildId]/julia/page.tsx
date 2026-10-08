import { formatUsd, parseJuliaConfig, usageMonth } from '@moin/shared';
import { JuliaForm, JuliaTest } from '@/components/JuliaForm';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { requireGuildAccess } from '@/lib/access';
import { appSettings } from '@/lib/config';
import { db } from '@/lib/db';
import { fetchGuildChannels, fetchGuildRoles, type ChannelOption, type DiscordRole } from '@/lib/discord';
import { getModuleRow } from '@/lib/modules';
import { juliaTabs } from '@/lib/tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Julia (KI-Chat)' };

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(2, 4)}`;

export default async function JuliaPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'julia');
  const config = parseJuliaConfig(row.config);
  const [settings, usage] = await Promise.all([appSettings(), db().juliaUsage.findMany({ where: { guildId }, orderBy: { month: 'desc' }, take: 6 })]);
  let channels: ChannelOption[] = [];
  let roles: DiscordRole[] = [];
  let loadError = false;
  try {
    [channels, roles] = await Promise.all([fetchGuildChannels(guildId), fetchGuildRoles(guildId)]);
  } catch {
    loadError = true;
  }
  const now = usage.find((u) => u.month === usageMonth(new Date()));
  const spent = now?.costMicroUsd ?? 0;
  const budget = config.monthlyBudgetUsd * 1_000_000;
  const percent = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const max = Math.max(1, ...usage.map((u) => u.costMicroUsd));

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <ModuleTabs active="settings" tabs={juliaTabs(guildId)} />
      {loadError && <p className="mb-6 rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm">Kanäle oder Rollen konnten nicht geladen werden.</p>}
      <div className="mb-6 grid max-w-4xl gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="card grid content-start gap-3 p-5 text-sm">
          <p className="font-display text-lg font-semibold">Verbrauch diesen Monat</p>
          {config.provider === 'ollama' ? (
            <p className="text-fog-300">
              Ollama läuft lokal – <b className="text-sea-400">kostenlos</b>. {now?.requests ?? 0} Antworten diesen Monat.
            </p>
          ) : (
            <>
              <p className="tabular-nums">
                <span className="font-display text-2xl font-bold">{formatUsd(spent)}</span> <span className="text-fog-500">von {formatUsd(budget)}</span>
              </p>
              <div className="h-2.5 overflow-hidden rounded-full bg-ink-800" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Budget">
                <div className={`h-full rounded-full ${percent >= 100 ? 'bg-danger-500' : percent >= config.warnAtPercent ? 'bg-sun-400' : 'bg-sea-500'}`} style={{ width: `${percent}%` }} />
              </div>
              <p className="text-xs text-fog-500">
                {now?.requests ?? 0} Antworten · {(now?.inputTokens ?? 0).toLocaleString('de-DE')} Tokens rein · {(now?.outputTokens ?? 0).toLocaleString('de-DE')} raus
                {now?.cacheRead ? ` · ${now.cacheRead.toLocaleString('de-DE')} aus dem Cache (90 % günstiger)` : ''}
              </p>
            </>
          )}
          {usage.length > 1 && (
            <div className="mt-1 flex h-16 items-end gap-2" aria-label="Kosten der letzten Monate">
              {[...usage].reverse().map((u) => (
                <div key={u.month} className="grid flex-1 justify-items-center gap-1">
                  <div className="w-full rounded-t bg-coral-500/70" style={{ height: `${Math.max(4, (u.costMicroUsd / max) * 44)}px` }} title={formatUsd(u.costMicroUsd)} />
                  <span className="text-[10px] text-fog-500">{monthLabel(u.month)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <JuliaTest guildId={guildId} canEdit={canEdit} />
      </div>
      <JuliaForm
        guildId={guildId}
        canEdit={canEdit}
        config={config}
        channels={channels}
        roles={roles.map(({ id, name, color }) => ({ id, name, color }))}
        connected={{ anthropic: !!settings.anthropicApiKey, ollama: settings.ollamaUrl && settings.ollamaModel ? settings.ollamaModel : null }}
      />
    </>
  );
}
