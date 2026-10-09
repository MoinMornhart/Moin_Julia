import { notFound } from 'next/navigation';
import { parseOwnerConfig } from '@moin/shared';
import { ActionButton } from '@/components/ActionButton';
import { ModuleHeader } from '@/components/ModuleHeader';
import { AddOwnerChannel, CreateAdminRole, OwnerSettings, ReplaceAdminButton } from '@/components/OwnerTools';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { DEMO_GUILD_ID } from '@/lib/demo';
import { botApi, fetchGuildChannels, fetchGuildRoles, type ChannelOption, type DiscordRole } from '@/lib/discord';
import { getModuleRow } from '@/lib/modules';
import { checkOwnerArea, restoreRoleBackup, setupOwnerArea } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Owner-Bereich' };

const ADMINISTRATOR = 8n;
const when = (d: Date) => d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' });

/** Nur für den Server-Owner – Admins bekommen 404 (sie sollen nicht einmal wissen, dass es den Bereich gibt) */
export default async function OwnerPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { level } = await requireGuildAccess(guildId);
  if (level !== 'owner') notFound();
  const row = await getModuleRow(guildId, 'owner');
  const config = parseOwnerConfig(row.config);
  let channels: ChannelOption[] = [];
  let roles: DiscordRole[] = [];
  try {
    // Rollen frisch (ohne Zwischenspeicher), damit Änderungen sofort sichtbar sind
    [channels, roles] = await Promise.all([fetchGuildChannels(guildId), guildId === DEMO_GUILD_ID ? fetchGuildRoles(guildId) : botApi<DiscordRole[]>(`/guilds/${guildId}/roles`)]);
  } catch {
    // leer
  }
  const category = channels.find((c) => c.id === config.categoryId);
  const inArea = channels.filter((c) => c.group && category && c.group === category.name);
  const adminRoles = roles.filter((r) => r.id !== guildId && !r.managed && (BigInt(r.permissions ?? '0') & ADMINISTRATOR) === ADMINISTRATOR).sort((a, b) => b.position - a.position);
  const backups = await db().ownerRoleBackup.findMany({ where: { guildId }, orderBy: { createdAt: 'desc' }, take: 20 });

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit />
      <p className="mb-6 max-w-3xl rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-fog-300">
        🔒 Diese Seite siehst nur du als Server-Owner. Admins und Moderator:innen sehen sie im Dashboard nicht.
      </p>

      <div className="grid max-w-4xl gap-6">
        <section className="card grid gap-4 p-6 text-sm">
          <h2 className="font-display text-lg font-semibold">Dein Bereich</h2>
          {!category ? (
            <>
              <p className="text-fog-300">
                Moin_Julia legt eine Kategorie <b>„🔒 Owner-Bereich“</b> mit einem Kanal „owner-notizen“ an. Sehen dürfen sie nur du und die Bots – <b>@everyone und jede einzelne Rolle</b> werden
                ausdrücklich gesperrt. Ändert jemand die Rechte, stellt Moin_Julia sie sofort zurück und schreibt dir eine DM.
              </p>
              <div>
                <ActionButton label="🔒 Owner-Bereich anlegen" run={setupOwnerArea.bind(null, guildId)} />
              </div>
            </>
          ) : (
            <>
              <p className="text-fog-300">
                Kategorie <b>{category.name}</b> · {inArea.length} Kanal/Kanäle: {inArea.map((c) => `${c.type === 2 || c.type === 13 ? '🔊' : '#'}${c.name}`).join(', ') || '–'}
              </p>
              <AddOwnerChannel guildId={guildId} />
              <div>
                <ActionButton label="Rechte jetzt prüfen" run={checkOwnerArea.bind(null, guildId)} />
              </div>
            </>
          )}
        </section>

        <section className="card grid gap-4 p-6 text-sm">
          <div>
            <h2 className="font-display text-lg font-semibold">Wer sieht trotzdem alles?</h2>
            <p className="text-fog-300">
              Discord-Regel: Rollen mit <b>„Administrator“</b> sehen <b>jeden</b> Kanal – Sperren gelten für sie nicht. Willst du den Bereich wirklich für dich allein, ersetze bei diesen Rollen
              „Administrator“ durch Einzelrechte.
            </p>
          </div>
          {adminRoles.length === 0 ? (
            <p className="rounded-lg border border-sea-500/40 bg-sea-500/10 px-3 py-2">✅ Keine Rolle hat „Administrator“ – dein Bereich ist wirklich privat (Bots ausgenommen).</p>
          ) : (
            <ul className="grid gap-2">
              {adminRoles.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-ink-700 px-4 py-3">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="size-3 rounded-full" style={{ background: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : '#8c96ba' }} />@ {r.name}
                    <span className="chip bg-sun-400/15 text-sun-400">Administrator</span>
                  </span>
                  <ReplaceAdminButton guildId={guildId} roleId={r.id} roleName={r.name} />
                </li>
              ))}
            </ul>
          )}
          {backups.length > 0 && (
            <div className="grid gap-2">
              <p className="font-semibold">Sicherungen</p>
              <ul className="grid gap-2">
                {backups.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-ink-850 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      @ {b.roleName} · {when(b.createdAt)} ·{' '}
                      {b.status === 'applied' ? 'umgestellt' : b.status === 'restored' ? `wiederhergestellt ${b.restoredAt ? when(b.restoredAt) : ''}` : <span className="text-danger-500">fehlgeschlagen: {b.error}</span>}
                    </span>
                    {b.status === 'applied' && <ActionButton label="Wiederherstellen" run={restoreRoleBackup.bind(null, guildId, b.id)} />}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="card grid gap-3 p-6">
          <h2 className="font-display text-lg font-semibold">Neue Admin-Rolle</h2>
          <CreateAdminRole guildId={guildId} />
        </section>

        <section className="card grid gap-3 p-6">
          <h2 className="font-display text-lg font-semibold">Einstellungen</h2>
          <OwnerSettings guildId={guildId} allowBots={config.allowBots} notifyOwner={config.notifyOwner} autoReplaceAdmin={config.autoReplaceAdmin} />
        </section>
      </div>
    </>
  );
}
