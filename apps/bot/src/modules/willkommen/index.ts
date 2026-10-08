import { AttachmentBuilder, MessageFlags, PermissionFlagsBits, type APIEmbed, type Guild, type GuildMember, type PartialGuildMember } from 'discord.js';
import {
  fillVariables,
  parseWillkommenConfig,
  renderTemplate,
  rolePanelSchema,
  type MessageTemplate,
  type RenderedEmbed,
  type TemplateContext,
  type WillkommenConfig,
} from '@moin/shared';
import type { BotContext, BotModule, ComponentContext } from '../../core/types.js';
import { fetchImage, renderWelcomeCard } from './card.js';
import { attachEmbedUpload, loadUpload } from '../../core/uploads.js';
import { buildPanelMessage, roleChanges } from './panels.js';
import { SELF_SERVICE_FORBIDDEN, safeRoleIds } from '../../core/role-safety.js';

function willkommenConfig(bot: BotContext, guildId: string): Promise<WillkommenConfig> {
  return bot.modules.config(guildId, 'willkommen', parseWillkommenConfig);
}

export function memberContext(member: GuildMember | PartialGuildMember, guild: Guild): TemplateContext {
  const user = member.user;
  return {
    userId: user.id,
    userName: member.displayName ?? user.globalName ?? user.username,
    userTag: user.tag,
    userAvatarUrl: user.displayAvatarURL({ size: 256, extension: 'png' }),
    serverName: guild.name,
    serverIconUrl: guild.iconURL({ size: 256 }),
    memberCount: guild.memberCount,
    ...botCounts(guild),
  };
}

/** Bots aus dem Mitglieder-Cache (für {humanCount}/{botCount}, entspricht GalaxyBots %USERCOUNT%/%BOTCOUNT%) */
function botCounts(guild: Guild): { botCount?: number; humanCount?: number } {
  const cache = guild.members?.cache;
  if (!cache) return {};
  const bots = cache.filter((m) => m.user.bot).size;
  return { botCount: bots, humanCount: Math.max(0, guild.memberCount - bots) };
}

function canSend(guild: Guild, channelId: string | null) {
  if (!channelId) return null;
  const channel = guild.channels.cache.get(channelId);
  const me = guild.members.me;
  if (!channel?.isTextBased() || !me) return null;
  return channel.permissionsFor(me)?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]) ? channel : null;
}

/** Vorlage senden; bei Willkommen mit Bild unten im Embed. Erwähnt nur das neue Mitglied. */
async function sendTemplate(
  bot: BotContext,
  guild: Guild,
  channelId: string | null,
  template: MessageTemplate,
  ctx: TemplateContext,
  card?: Buffer | null,
): Promise<void> {
  const channel = canSend(guild, channelId);
  if (!channel) {
    if (channelId) bot.logger.warn({ guildId: guild.id, channelId }, 'Willkommen: Kanal fehlt oder Bot darf dort nicht schreiben');
    return;
  }
  const rendered = renderTemplate(template, ctx);
  const content = rendered.content;
  // Willkommensbild ersetzt ein eigenes Embed-Bild; sonst wird ein hochgeladenes Bild angehängt
  const { embed, files } = card ? { embed: rendered.embed as APIEmbed | null, files: [] } : await attachEmbedUpload(bot.prisma, guild.id, rendered.embed);
  if (card) files.push(new AttachmentBuilder(card, { name: 'willkommen.png' }));
  let embeds: APIEmbed[] = embed ? [embed] : [];
  if (card) embeds = embeds.length ? [{ ...embeds[0], image: { url: 'attachment://willkommen.png' } }] : [];
  await channel.send({ content: content || undefined, embeds, files, allowedMentions: { users: [ctx.userId] } });
}

async function onJoin(bot: BotContext, member: GuildMember): Promise<void> {
  const config = await willkommenConfig(bot, member.guild.id);
  const ctx = memberContext(member, member.guild);

  // Auto-Rollen
  const roles = safeRoleIds(member.guild, (member.user.bot ? config.autoRoles.bots : config.autoRoles.humans).filter((id) => member.guild.roles.cache.has(id)), SELF_SERVICE_FORBIDDEN, bot.logger, 'Auto-Rollen');
  if (roles.length) {
    await member.roles.add(roles, 'Auto-Rollen').catch((error: unknown) => bot.logger.warn({ err: error, guildId: member.guild.id }, 'Auto-Rollen fehlgeschlagen'));
  }
  if (member.user.bot) return;

  if (config.welcome.enabled) {
    let card: Buffer | null = null;
    if (config.welcome.card.enabled) {
      const bg = config.welcome.card.backgroundUrl;
      const [avatar, background] = await Promise.all([
        fetchImage(ctx.userAvatarUrl),
        bg.startsWith('upload:') ? loadUpload(bot.prisma, member.guild.id, bg).then((u) => u?.data ?? null) : fetchImage(bg || null),
      ]);
      card = await renderWelcomeCard({
        style: config.welcome.card.style,
        headline: fillVariables(config.welcome.card.headline, ctx),
        name: ctx.userName,
        subline: fillVariables(config.welcome.card.subline, ctx),
        avatar,
        background,
      }).catch((error: unknown) => {
        bot.logger.warn({ err: error }, 'Willkommensbild fehlgeschlagen');
        return null;
      });
    }
    await sendTemplate(bot, member.guild, config.welcome.channelId, config.welcome.template, ctx, card).catch((error: unknown) =>
      bot.logger.warn({ err: error }, 'Willkommensnachricht fehlgeschlagen'),
    );
  }

  if (config.dm.enabled) {
    const rendered = renderTemplate(config.dm.template, ctx);
    const { embed, files } = await attachEmbedUpload(bot.prisma, member.guild.id, rendered.embed);
    await member.send({ content: rendered.content || undefined, embeds: embed ? [embed] : [], files }).catch(() => undefined);
  }
}

async function onLeave(bot: BotContext, member: GuildMember | PartialGuildMember): Promise<void> {
  if (member.user.bot) return;
  const config = await willkommenConfig(bot, member.guild.id);
  if (!config.leave.enabled) return;
  await sendTemplate(bot, member.guild, config.leave.channelId, config.leave.template, memberContext(member, member.guild)).catch((error: unknown) =>
    bot.logger.warn({ err: error }, 'Abschiedsnachricht fehlgeschlagen'),
  );
}

// ── Rollen-Panels ───────────────────────────────────────────────────────────

async function loadPanel(bot: BotContext, guildId: string, panelId: string) {
  const panel = await bot.prisma.rolePanel.findFirst({ where: { id: panelId, guildId } });
  if (!panel) return null;
  const data = rolePanelSchema.safeParse(panel.data);
  return data.success ? { panel, data: data.data } : null;
}

async function onComponent(ctx: ComponentContext): Promise<void> {
  const { interaction, action, args, bot, locale } = ctx;
  const panelId = args[0];
  if (!panelId || (action !== 'role' && action !== 'select')) return;
  const loaded = await loadPanel(bot, interaction.guildId, panelId);
  if (!loaded) {
    await interaction.reply({ content: locale === 'de' ? 'Dieses Panel gibt es nicht mehr.' : 'This panel no longer exists.', flags: MessageFlags.Ephemeral });
    return;
  }
  const current = [...interaction.member.roles.cache.keys()];
  const changes =
    action === 'role' && interaction.isButton()
      ? roleChanges(loaded.data, current, { kind: 'button', roleId: args[1] ?? '' })
      : interaction.isStringSelectMenu()
        ? roleChanges(loaded.data, current, { kind: 'select', values: interaction.values })
        : { add: [], remove: [] };
  try {
    if (changes.remove.length) await interaction.member.roles.remove(changes.remove, 'Rollen-Panel');
    const add = safeRoleIds(interaction.guild, changes.add, SELF_SERVICE_FORBIDDEN, bot.logger, 'Rollen-Panel');
    if (add.length) await interaction.member.roles.add(add, 'Rollen-Panel');
  } catch {
    await interaction.reply({
      content: locale === 'de' ? '❌ Ich konnte die Rolle nicht ändern – meine Rolle steht wohl zu weit unten.' : '❌ I couldn’t change the role – my role is probably too low.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const lines = [...changes.add.map((r) => `➕ <@&${r}>`), ...changes.remove.map((r) => `➖ <@&${r}>`)];
  await interaction.reply({
    content: lines.length ? lines.join('\n') : locale === 'de' ? 'Keine Änderung.' : 'No change.',
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
}

/** Dashboard-Auftrag „panel:<id>“: Panel senden bzw. vorhandene Nachricht aktualisieren */
async function onAction(bot: BotContext, guildId: string, action: string): Promise<void> {
  const [kind, panelId] = action.split(':');
  if (kind !== 'panel' || !panelId) return;
  const guild = bot.client.guilds.cache.get(guildId);
  const loaded = guild ? await loadPanel(bot, guildId, panelId) : null;
  if (!guild || !loaded?.panel.channelId) return;
  const channel = canSend(guild, loaded.panel.channelId);
  if (!channel) {
    bot.logger.warn({ guildId, panelId }, 'Rollen-Panel: Kanal fehlt oder nicht beschreibbar');
    return;
  }
  const me = guild.members.me!;
  const built = buildPanelMessage(panelId, loaded.data, {
    userId: me.id,
    userName: me.displayName,
    userTag: me.user.tag,
    userAvatarUrl: me.user.displayAvatarURL(),
    serverName: guild.name,
    serverIconUrl: guild.iconURL(),
    memberCount: guild.memberCount,
  });
  const { embed, files } = await attachEmbedUpload(bot.prisma, guildId, (built.embeds[0] as RenderedEmbed | undefined) ?? null);
  const message = { ...built, embeds: embed ? [embed] : [], files };
  if (loaded.panel.messageId) {
    const existing = await channel.messages.fetch(loaded.panel.messageId).catch(() => null);
    if (existing) {
      await existing.edit({ ...message, attachments: [] });
      return;
    }
  }
  const sent = await channel.send(message);
  await bot.prisma.rolePanel.update({ where: { id: panelId }, data: { messageId: sent.id } });
}

export const willkommenModule: BotModule = {
  id: 'willkommen',
  setup({ bot, on }) {
    on('guildMemberAdd', (m) => m.guild.id, (member) => onJoin(bot, member));
    on('guildMemberRemove', (m) => m.guild.id, (member) => onLeave(bot, member));
  },
  onComponent,
  onAction: (bot, guildId, action) => onAction(bot, guildId, action),
};
