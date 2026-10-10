import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  InteractionContextType,
  SlashCommandBuilder,
  type Guild,
  type GuildMember,
  type Message,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import { loadSettings } from '@moin/db';
import { boostPercent, fillLevelText, levelFromXp, parseLevelConfig, rewardRoles, t, type LevelConfig, type Locale, type TranslationKey } from '@moin/shared';
import type { BotContext, BotModule, CommandContext, SlashCommand } from '../../core/types.js';
import { fetchImage } from '../willkommen/card.js';
import { renderRankCard } from './card.js';
import { applyBoost, rollTextXp, textXpAllowed, voiceXpAllowed } from './logic.js';
import { SELF_SERVICE_FORBIDDEN, safeRoleIds } from '../../core/role-safety.js';

/**
 * Level & XP: Nachrichten (mit Abklingzeit) und Minuten im Sprachkanal geben XP. Beim Aufstieg
 * gibt es eine Meldung und ggf. Belohnungsrollen (geben und – bei „ersetzen“ – entziehen).
 */

function levelConfig(bot: BotContext, guildId: string): Promise<LevelConfig> {
  return bot.modules.config(guildId, 'level', parseLevelConfig);
}

/** Kanal + Kategorie (+ Elternkanal bei Threads) für die Ignorier-Liste */
function channelChain(channel: { id: string; parentId: string | null; parent?: { parentId: string | null } | null } | null): string[] {
  if (!channel) return [];
  return [channel.id, channel.parentId, channel.parent?.parentId].filter((id): id is string => !!id);
}

async function applyRewards(member: GuildMember, config: LevelConfig, level: number, locale: Locale): Promise<void> {
  if (!config.rewards.length) return;
  const { give, take } = rewardRoles(config, level);
  const usable = (id: string) => member.guild.roles.cache.get(id)?.editable ?? false;
  const add = safeRoleIds(member.guild, give.filter((id) => usable(id) && !member.roles.cache.has(id)), SELF_SERVICE_FORBIDDEN, undefined, 'Level-Belohnung');
  const remove = take.filter((id) => usable(id) && member.roles.cache.has(id));
  const reason = t(locale, 'level.reason.reward');
  if (add.length) await member.roles.add(add, reason).catch(() => undefined);
  if (remove.length) await member.roles.remove(remove, reason).catch(() => undefined);
}

async function announce(bot: BotContext, member: GuildMember, config: LevelConfig, level: number, source: Message | null): Promise<void> {
  if (config.levelUpMode === 'off' || !config.levelUpText.trim()) return;
  const text = fillLevelText(config.levelUpText, { user: `<@${member.id}>`, name: member.displayName, level, server: member.guild.name });
  const payload = { content: text, allowedMentions: { users: [member.id] } };
  if (config.levelUpMode === 'dm') {
    await member.send({ content: text.replaceAll(`<@${member.id}>`, member.displayName) }).catch(() => undefined);
    return;
  }
  const channel =
    config.levelUpMode === 'channel' && config.levelUpChannelId ? member.guild.channels.cache.get(config.levelUpChannelId) : source?.channel.isSendable() ? source.channel : null;
  if (channel?.isSendable()) await channel.send(payload).catch(() => undefined);
}

/** XP gutschreiben; bei Aufstieg Rollen + Meldung */
export async function awardXp(bot: BotContext, member: GuildMember, amount: number, kind: 'text' | 'voice', source: Message | null = null): Promise<{ level: number; leveledUp: boolean }> {
  const now = new Date();
  const row = await bot.prisma.memberXp.upsert({
    where: { guildId_userId: { guildId: member.guild.id, userId: member.id } },
    create: {
      guildId: member.guild.id,
      userId: member.id,
      userTag: member.user.username,
      avatar: member.user.avatar,
      xp: amount,
      messages: kind === 'text' ? 1 : 0,
      voiceMinutes: kind === 'voice' ? 1 : 0,
      lastXpAt: kind === 'text' ? now : null,
    },
    update: {
      xp: { increment: amount },
      userTag: member.user.username,
      avatar: member.user.avatar,
      ...(kind === 'text' ? { messages: { increment: 1 }, lastXpAt: now } : { voiceMinutes: { increment: 1 } }),
    },
  });
  const { level } = levelFromXp(row.xp);
  if (level === row.level) return { level, leveledUp: false };
  // Nur wer den Level-Wechsel tatsächlich schreibt, meldet ihn – laufen Text- und Sprach-XP gleichzeitig,
  // käme die Level-up-Nachricht sonst doppelt
  const changed = await bot.prisma.memberXp.updateMany({ where: { id: row.id, level: row.level }, data: { level } });
  if (!changed.count) return { level, leveledUp: false };
  const config = await levelConfig(bot, member.guild.id);
  const locale = await bot.modules.locale(member.guild.id);
  await applyRewards(member, config, level, locale);
  if (level > row.level) await announce(bot, member, config, level, source);
  return { level, leveledUp: level > row.level };
}

// Abklingzeit im Speicher (spart einen DB-Zugriff pro Nachricht)
const lastText = new Map<string, number>();

async function onMessage(bot: BotContext, message: Message): Promise<void> {
  if (!message.inGuild() || message.author.bot || message.webhookId || message.system) return;
  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  if (!member) return;
  const config = await levelConfig(bot, message.guildId);
  const key = `${message.guildId}:${member.id}`;
  const now = new Date();
  const last = lastText.get(key);
  const channel = message.channel as unknown as { id: string; parentId: string | null; parent?: { parentId: string | null } | null };
  const allowed = textXpAllowed(config, { channelIds: channelChain(channel), roleIds: [...member.roles.cache.keys()], lastXpAt: last ? new Date(last) : null, now });
  if (!allowed) return;
  lastText.set(key, now.getTime());
  if (lastText.size > 50_000) lastText.clear();
  const xp = rollTextXp(config, boostPercent(config, [...member.roles.cache.keys()]));
  if (xp > 0) await awardXp(bot, member, xp, 'text', message);
}

/** Jede Minute: XP für alle, die in einem Sprachkanal sind */
export async function voiceRound(bot: BotContext): Promise<number> {
  let awarded = 0;
  for (const guild of bot.client.guilds.cache.values()) {
    if (!(await bot.modules.isEnabled(guild.id, 'level'))) continue;
    const config = await levelConfig(bot, guild.id);
    if (!config.voiceXp || config.voiceXpPerMinute <= 0) continue;
    for (const channel of guild.channels.cache.values()) {
      if (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice) continue;
      const members = [...channel.members.values()];
      const humans = members.filter((m) => !m.user.bot).length;
      for (const member of members) {
        const ok = voiceXpAllowed(config, {
          channelIds: channelChain(channel),
          roleIds: [...member.roles.cache.keys()],
          isBot: member.user.bot,
          deaf: !!member.voice.deaf,
          afkChannel: guild.afkChannelId === channel.id,
          humansInChannel: humans,
        });
        if (!ok) continue;
        await awardXp(bot, member, applyBoost(config.voiceXpPerMinute, boostPercent(config, [...member.roles.cache.keys()])), 'voice');
        awarded++;
      }
    }
  }
  return awarded;
}

async function place(bot: BotContext, guildId: string, xp: number): Promise<number> {
  return (await bot.prisma.memberXp.count({ where: { guildId, xp: { gt: xp } } })) + 1;
}

async function leaderboardUrl(bot: BotContext, guild: Guild, config: LevelConfig): Promise<string | null> {
  const s = await loadSettings(bot.prisma).catch(() => null);
  const base = s?.dashboardUrl?.replace(/\/+$/, '');
  if (!base || !/^https?:\/\//.test(base)) return null;
  return config.publicLeaderboard ? `${base}/rangliste/${guild.id}` : `${base}/g/${guild.id}/level`;
}

function d(key: TranslationKey) {
  return { de: t('de', key), loc: { 'en-US': t('en', key), 'en-GB': t('en', key) } };
}

const rankCommand: SlashCommand = {
  data: (() => {
    const desc = d('level.cmd.rank');
    const user = d('level.cmd.user');
    return new SlashCommandBuilder()
      .setName('rang')
      .setNameLocalizations({ 'en-US': 'rank', 'en-GB': 'rank' })
      .setDescription(desc.de)
      .setDescriptionLocalizations(desc.loc)
      .setContexts(InteractionContextType.Guild)
      .addUserOption((o) => o.setName('mitglied').setNameLocalizations({ 'en-US': 'member', 'en-GB': 'member' }).setDescription(user.de).setDescriptionLocalizations(user.loc))
      .toJSON();
  })(),
  async execute({ interaction, locale, bot }: CommandContext) {
    if (!interaction.inCachedGuild()) return;
    const user = interaction.options.getUser('mitglied') ?? interaction.user;
    const row = await bot.prisma.memberXp.findUnique({ where: { guildId_userId: { guildId: interaction.guildId, userId: user.id } } });
    if (!row || row.xp <= 0) return void (await interaction.reply({ content: t(locale, 'level.rank.none', { user: `**${user.displayName}**` }), allowedMentions: { parse: [] } }));
    await interaction.deferReply();
    const config = await levelConfig(bot, interaction.guildId);
    const progress = levelFromXp(row.xp);
    const rank = await place(bot, interaction.guildId, row.xp);
    const member = interaction.guild.members.cache.get(user.id);
    const png = await renderRankCard({
      style: config.cardStyle,
      name: member?.displayName ?? user.displayName,
      avatar: await fetchImage(user.displayAvatarURL({ extension: 'png', size: 256 })),
      level: progress.level,
      place: rank,
      current: progress.current,
      needed: progress.needed,
      totalXp: row.xp,
      labels: {
        level: t(locale, 'level.rank.headline', { level: String(progress.level) }),
        place: t(locale, 'level.rank.place', { place: String(rank) }),
        xp: t(locale, 'level.rank.xp', { current: progress.current.toLocaleString('de-DE'), needed: progress.needed.toLocaleString('de-DE') }),
      },
    });
    await interaction.editReply({ files: [new AttachmentBuilder(png, { name: 'rang.png' })] });
  },
};

const leaderboardCommand: SlashCommand = {
  data: (() => {
    const desc = d('level.cmd.leaderboard');
    return new SlashCommandBuilder()
      .setName('bestenliste')
      .setNameLocalizations({ 'en-US': 'leaderboard', 'en-GB': 'leaderboard' })
      .setDescription(desc.de)
      .setDescriptionLocalizations(desc.loc)
      .setContexts(InteractionContextType.Guild)
      .toJSON();
  })(),
  async execute({ interaction, locale, bot }: CommandContext) {
    if (!interaction.inCachedGuild()) return;
    const config = await levelConfig(bot, interaction.guildId);
    const top = await bot.prisma.memberXp.findMany({ where: { guildId: interaction.guildId, xp: { gt: 0 } }, orderBy: { xp: 'desc' }, take: 10 });
    const lines = top.map((r, i) => t(locale, 'level.board.line', { place: String(i + 1), user: `<@${r.userId}>`, level: String(levelFromXp(r.xp).level), xp: r.xp.toLocaleString('de-DE') }));
    const embed = new EmbedBuilder()
      .setColor(0xffc857)
      .setTitle(t(locale, 'level.board.title', { server: interaction.guild.name }))
      .setDescription(lines.join('\n') || t(locale, 'level.board.empty'));
    const url = await leaderboardUrl(bot, interaction.guild, config);
    const components = url
      ? [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(t(locale, 'level.board.more')).setURL(url))]
      : [];
    await interaction.reply({ embeds: [embed], components, allowedMentions: { parse: [] } });
  },
};

/** Rollen aller Mitglieder mit XP an die aktuellen Belohnungen anpassen (nach Änderung im Dashboard) */
async function syncRoles(bot: BotContext, guild: Guild): Promise<void> {
  const config = await levelConfig(bot, guild.id);
  const locale = await bot.modules.locale(guild.id);
  const rows = await bot.prisma.memberXp.findMany({ where: { guildId: guild.id }, orderBy: { xp: 'desc' }, take: 2000 });
  for (const row of rows) {
    const member = guild.members.cache.get(row.userId) ?? (await guild.members.fetch(row.userId).catch(() => null));
    if (member) await applyRewards(member, config, levelFromXp(row.xp).level, locale);
  }
}

export const levelModule: BotModule = {
  id: 'level',
  commands: [rankCommand, leaderboardCommand],
  setup({ bot, on }) {
    on(
      'messageCreate',
      (m) => m.guildId,
      (m) => void onMessage(bot, m).catch((error: unknown) => bot.logger.warn({ err: error }, 'Level: XP für Nachricht fehlgeschlagen')),
    );
  },
  onReady(bot) {
    // Eine Runde nach der anderen: Auf großen Servern kann eine Runde länger als 60 s dauern (sonst doppelte XP)
    let running = false;
    setInterval(() => {
      if (running) return;
      running = true;
      void voiceRound(bot)
        .catch((error: unknown) => bot.logger.warn({ err: error }, 'Level: Voice-Runde fehlgeschlagen'))
        .finally(() => (running = false));
    }, 60_000).unref();
  },
  async onAction(bot, guildId, action) {
    const guild = bot.client.guilds.cache.get(guildId);
    if (guild && action === 'sync-roles') await syncRoles(bot, guild);
  },
};
