import { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, type ButtonInteraction } from 'discord.js';
import {
  parseLoggingConfig,
  SUPPORT_DURATIONS,
  supportAccessKey,
  supportBlockKey,
  supportRequestKey,
  supportScopesText,
  supportUntilText,
  type SupportAccess,
  type SupportDuration,
  type SupportRequest,
} from '@moin/shared';
import type { BotContext } from '../../core/types.js';

/**
 * Betreiber-Zugang nur mit Zustimmung (Issue #13): Der Instanz-Admin fragt im Dashboard an (mit Begründung),
 * der Bot schreibt in den Log-Kanal – gibt es keinen, per DM an den Server-Owner – mit Knöpfen:
 * freigeben (1 h / 24 h / 7 Tage / für immer), ablehnen, Betreiber sperren. Klicken dürfen nur Owner und Administratoren.
 * customId: kern:acc:<guildId>:<grant-1h|grant-24h|grant-7d|grant-immer|deny|block>
 */

const DURATION_LABELS: Record<SupportDuration, string> = { '1h': '1 Stunde', '24h': '24 Stunden', '7d': '7 Tage', immer: 'für immer' };

function buttons(guildId: string) {
  const id = (what: string) => `kern:acc:${guildId}:${what}`;
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...(Object.keys(DURATION_LABELS) as SupportDuration[]).map((d) => new ButtonBuilder().setCustomId(id(`grant-${d}`)).setStyle(ButtonStyle.Success).setLabel(`✅ ${DURATION_LABELS[d]}`)),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(id('deny')).setStyle(ButtonStyle.Secondary).setLabel('❌ Ablehnen'),
      new ButtonBuilder().setCustomId(id('block')).setStyle(ButtonStyle.Danger).setLabel('🚫 Betreiber sperren'),
    ),
  ];
}

/** Anfrage zustellen (Dashboard → module-action „access-request“) */
export async function deliverAccessRequest(bot: BotContext, guildId: string, by: string): Promise<void> {
  const raw = await bot.redis.get(supportRequestKey(guildId));
  if (!raw) return;
  const request = JSON.parse(raw) as SupportRequest;
  if (request.by !== by || (await bot.redis.exists(supportBlockKey(guildId)))) return;
  const guild = await bot.client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;
  const content = [
    `🔑 **Der Bot-Betreiber (${request.byName}) bittet um Zugang zu diesem Server.**`,
    `**Wofür:** ${supportScopesText(request)}`,
    `**Begründung:** ${request.reason}`,
    '',
    'Ohne deine Freigabe sieht er nichts von diesem Server. Du kannst den Zugang jederzeit mit `/moin support-zugang dauer:aus` oder im Dashboard unter Einstellungen wieder entziehen.',
    '-# Nur Owner und Administratoren können entscheiden.',
  ].join('\n');
  const message = { content, components: buttons(guildId), allowedMentions: { parse: [] as never[] } };
  const config = await bot.modules.config(guildId, 'logging', parseLoggingConfig).catch(() => null);
  const channel = config?.defaultChannelId ? guild.channels.cache.get(config.defaultChannelId) : null;
  if (channel?.isSendable() && (await channel.send(message).then(() => true, () => false))) return;
  // Kein Log-Kanal (oder kein Recht) → privat an den Owner
  const owner = await guild.fetchOwner().catch(() => null);
  await owner?.send({ ...message, content: `**${guild.name}**\n${content}` }).catch(() => bot.logger.warn({ guildId }, 'Zugangs-Anfrage ließ sich nicht zustellen'));
}

/** Knopf aus der Anfrage – im Server-Kanal oder in der DM des Owners */
export async function onAccessButton(bot: BotContext, interaction: ButtonInteraction, args: string[]): Promise<void> {
  const [guildId, what = ''] = args;
  const guild = guildId ? await bot.client.guilds.fetch(guildId).catch(() => null) : null;
  if (!guild) return void (await interaction.reply({ content: 'Diesen Server gibt es für den Bot nicht mehr.', ephemeral: true }));
  const member = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member || (guild.ownerId !== member.id && !member.permissions.has(PermissionFlagsBits.Administrator))) {
    return void (await interaction.reply({ content: 'Das entscheiden nur der Server-Owner und Administratoren.', ephemeral: true }));
  }
  const raw = await bot.redis.get(supportRequestKey(guild.id));
  const request = raw ? (JSON.parse(raw) as SupportRequest) : null;
  const done = (text: string) => interaction.update({ content: `${interaction.message.content}\n\n${text}`, components: [], allowedMentions: { parse: [] } });
  const tellOperator = async (text: string) => {
    if (!request) return;
    const user = await bot.client.users.fetch(request.by).catch(() => null);
    await user?.send(text).catch(() => undefined);
  };

  if (what === 'block') {
    await bot.redis.set(supportBlockKey(guild.id), JSON.stringify({ by: member.id, at: Date.now() }));
    await bot.redis.del(supportAccessKey(guild.id), supportRequestKey(guild.id));
    await done(`🚫 Gesperrt von ${member.displayName}: Der Bot-Betreiber kann keinen Zugang mehr anfragen. Aufheben: \`/moin support-zugang dauer:entsperren\`.`);
    await tellOperator(`🚫 „${guild.name}“ hat dich als Betreiber gesperrt – keine Anfragen mehr möglich.`);
    return;
  }
  if (!request) return void (await done('⌛ Diese Anfrage ist abgelaufen oder schon entschieden.'));
  if (what === 'deny') {
    await bot.redis.del(supportRequestKey(guild.id));
    await done(`❌ Abgelehnt von ${member.displayName}.`);
    await tellOperator(`❌ „${guild.name}“ hat deine Zugangs-Anfrage abgelehnt.`);
    return;
  }
  const duration = what.replace(/^grant-/, '') as SupportDuration;
  if (!what.startsWith('grant-') || !(duration in SUPPORT_DURATIONS)) return;
  const ms = SUPPORT_DURATIONS[duration];
  const access: SupportAccess = { by: member.id, byName: member.user.username, since: Date.now(), until: ms === null ? null : Date.now() + ms, scopes: request.scopes, reason: request.reason };
  if (ms === null) await bot.redis.set(supportAccessKey(guild.id), JSON.stringify(access));
  else await bot.redis.set(supportAccessKey(guild.id), JSON.stringify(access), 'PX', ms);
  await bot.redis.del(supportRequestKey(guild.id));
  await done(`✅ Freigegeben von ${member.displayName} – ${supportScopesText(access)}, ${supportUntilText(access)}. Entziehen: \`/moin support-zugang dauer:aus\` oder im Dashboard unter Einstellungen.`);
  await tellOperator(`✅ „${guild.name}“ hat dir Zugang gegeben: ${supportScopesText(access)}, ${supportUntilText(access)}.`);
}
