import { ChannelType, type Guild } from 'discord.js';
import { fillStatTemplate, parseStatsConfig, statDay, statRenameAllowed, STAT_RENAME_WINDOW_MS, type StatsConfig, type StatValues } from '@moin/shared';
import type { BotContext, BotModule } from '../../core/types.js';

/**
 * Server-Statistiken. Zähler laufen im Speicher und werden jede Sekunde gebündelt gespeichert
 * (ein Upsert pro Server/Kanal/Mitglied statt einer DB-Anfrage pro Nachricht).
 * Statistik-Kanäle: alle 5 Sekunden geprüft und umbenannt, sobald Discord es erlaubt
 * (2 Umbenennungen pro Kanal in 10 Minuten – mehr blockiert Discord für längere Zeit).
 */

function statsConfig(bot: BotContext, guildId: string): Promise<StatsConfig> {
  return bot.modules.config(guildId, 'statistiken', parseStatsConfig);
}

interface GuildBucket {
  joins: number;
  leaves: number;
  messages: number;
  voiceMinutes: number;
  channels: Map<string, number>;
  members: Map<string, { tag: string; messages: number; voiceMinutes: number }>;
}

/** Puffer: guildId → Tag → Zähler */
export class StatsBuffer {
  private data = new Map<string, Map<string, GuildBucket>>();

  private bucket(guildId: string, day: string): GuildBucket {
    let days = this.data.get(guildId);
    if (!days) this.data.set(guildId, (days = new Map()));
    let b = days.get(day);
    if (!b) days.set(day, (b = { joins: 0, leaves: 0, messages: 0, voiceMinutes: 0, channels: new Map(), members: new Map() }));
    return b;
  }

  message(guildId: string, channelId: string, userId: string, tag: string, now = new Date()): void {
    const b = this.bucket(guildId, statDay(now));
    b.messages++;
    b.channels.set(channelId, (b.channels.get(channelId) ?? 0) + 1);
    const m = b.members.get(userId) ?? { tag, messages: 0, voiceMinutes: 0 };
    m.messages++;
    m.tag = tag;
    b.members.set(userId, m);
  }

  voice(guildId: string, userId: string, tag: string, now = new Date()): void {
    const b = this.bucket(guildId, statDay(now));
    b.voiceMinutes++;
    const m = b.members.get(userId) ?? { tag, messages: 0, voiceMinutes: 0 };
    m.voiceMinutes++;
    b.members.set(userId, m);
  }

  /** Tag anlegen, damit die Mitgliederzahl auch ohne Aktivität gespeichert wird */
  touch(guildId: string, now = new Date()): void {
    this.bucket(guildId, statDay(now));
  }

  member(guildId: string, kind: 'join' | 'leave', now = new Date()): void {
    const b = this.bucket(guildId, statDay(now));
    if (kind === 'join') b.joins++;
    else b.leaves++;
  }

  /** Alles herausnehmen (danach ist der Puffer leer) */
  drain(): [string, Map<string, GuildBucket>][] {
    const out = [...this.data];
    this.data = new Map();
    return out;
  }
}

export const buffer = new StatsBuffer();

let flushing = false;

/** Gepufferte Zahlen schreiben. Eine Runde nach der anderen; ein einzelner DB-Fehler kostet nicht den ganzen Puffer */
export async function flush(bot: BotContext): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  try {
    return await flushNow(bot);
  } finally {
    flushing = false;
  }
}

async function safeWrite(bot: BotContext, write: () => Promise<unknown>): Promise<number> {
  try {
    await write();
    return 1;
  } catch (error) {
    bot.logger.warn({ err: error }, 'Statistik: ein Eintrag konnte nicht gespeichert werden');
    return 0;
  }
}

async function flushNow(bot: BotContext): Promise<number> {
  let writes = 0;
  for (const [guildId, days] of buffer.drain()) {
    const guild = bot.client.guilds.cache.get(guildId);
    for (const [day, b] of days) {
      const memberCount = guild?.memberCount ?? 0;
      writes += await safeWrite(bot, () =>
        bot.prisma.guildStatDay.upsert({
          where: { guildId_day: { guildId, day } },
          create: { guildId, day, joins: b.joins, leaves: b.leaves, messages: b.messages, voiceMinutes: b.voiceMinutes, memberCount },
          update: { joins: { increment: b.joins }, leaves: { increment: b.leaves }, messages: { increment: b.messages }, voiceMinutes: { increment: b.voiceMinutes }, ...(memberCount ? { memberCount } : {}) },
        }),
      );
      for (const [channelId, messages] of b.channels) {
        writes += await safeWrite(bot, () =>
          bot.prisma.channelStatDay.upsert({
            where: { guildId_channelId_day: { guildId, channelId, day } },
            create: { guildId, channelId, day, messages },
            update: { messages: { increment: messages } },
          }),
        );
      }
      for (const [userId, m] of b.members) {
        writes += await safeWrite(bot, () =>
          bot.prisma.memberStatDay.upsert({
            where: { guildId_userId_day: { guildId, userId, day } },
            create: { guildId, userId, day, userTag: m.tag, messages: m.messages, voiceMinutes: m.voiceMinutes },
            update: { userTag: m.tag, messages: { increment: m.messages }, voiceMinutes: { increment: m.voiceMinutes } },
          }),
        );
      }
    }
  }
  return writes;
}

/** Jede Minute: Mitgliederzahl festhalten (auch ohne Aktivität) und Sprachminuten zählen */
export async function voiceTick(bot: BotContext, now = new Date()): Promise<void> {
  for (const guild of bot.client.guilds.cache.values()) {
    if (!(await bot.modules.isEnabled(guild.id, 'statistiken'))) continue;
    const config = await statsConfig(bot, guild.id);
    for (const state of guild.voiceStates.cache.values()) {
      const member = state.member;
      if (!member || member.user.bot || !state.channelId || state.channelId === guild.afkChannelId) continue;
      if (config.ignoredChannelIds.includes(state.channelId)) continue;
      buffer.voice(guild.id, member.id, member.user.username, now);
    }
    buffer.touch(guild.id, now);
  }
}

export function statValues(guild: Guild): StatValues {
  const members = guild.memberCount;
  const bots = guild.members.cache.filter((m) => m.user.bot).size;
  return {
    members,
    bots,
    humans: Math.max(0, members - bots),
    boosts: guild.premiumSubscriptionCount ?? 0,
    channels: guild.channels.cache.filter((c) => c.type !== ChannelType.GuildCategory && !c.isThread()).size,
    roles: Math.max(0, guild.roles.cache.size - 1),
    voice: guild.voiceStates.cache.filter((s) => !!s.channelId && !s.member?.user.bot).size,
  };
}

const lastNames = new Map<string, string>();
/** Zeitpunkte der letzten Umbenennungen pro Kanal (für Discords Limit) */
const renameHistory = new Map<string, number[]>();
let renaming = false;

/** Statistik-Kanäle umbenennen – nur wenn sich der Name ändert */
export async function updateStatChannels(bot: BotContext, now = Date.now): Promise<number> {
  // Nie zwei Runden gleichzeitig (eine Umbenennung kann dauern)
  if (renaming) return 0;
  renaming = true;
  try {
    return await renameRound(bot, now);
  } finally {
    renaming = false;
  }
}

async function renameRound(bot: BotContext, now: () => number): Promise<number> {
  let renamed = 0;
  for (const guild of bot.client.guilds.cache.values()) {
    if (!(await bot.modules.isEnabled(guild.id, 'statistiken'))) continue;
    const config = await statsConfig(bot, guild.id);
    if (!config.statChannels.length) continue;
    const values = statValues(guild);
    for (const sc of config.statChannels) {
      const channel = guild.channels.cache.get(sc.channelId);
      if (!channel || channel.isThread() || !('setName' in channel)) continue;
      const name = fillStatTemplate(sc.template, values);
      if (channel.name === name || lastNames.get(channel.id) === name) continue;
      const history = (renameHistory.get(channel.id) ?? []).filter((at) => now() - at < STAT_RENAME_WINDOW_MS);
      renameHistory.set(channel.id, history);
      // Limit erreicht → beim nächsten freien Platz (spätestens ~10 min) mit dem dann aktuellen Wert
      if (!statRenameAllowed(history, now())) continue;
      history.push(now());
      await channel
        .setName(name, 'Statistik-Kanal')
        .then(() => {
          lastNames.set(channel.id, name);
          renamed++;
        })
        .catch((error: unknown) => bot.logger.warn({ err: error, channelId: channel.id }, 'Statistik-Kanal umbenennen fehlgeschlagen'));
    }
  }
  return renamed;
}

/** Alte Tageswerte pro Kanal/Mitglied löschen (Server-Tageswerte bleiben) */
async function cleanup(bot: BotContext): Promise<void> {
  for (const guild of bot.client.guilds.cache.values()) {
    const config = await statsConfig(bot, guild.id);
    const cutoff = statDay(new Date(Date.now() - config.retentionDays * 86_400_000));
    await bot.prisma.memberStatDay.deleteMany({ where: { guildId: guild.id, day: { lt: cutoff } } });
    await bot.prisma.channelStatDay.deleteMany({ where: { guildId: guild.id, day: { lt: cutoff } } });
  }
}

export const statistikenModule: BotModule = {
  id: 'statistiken',
  setup({ bot, on }) {
    on(
      'messageCreate',
      (m) => m.guildId,
      (m) => {
        if (!m.inGuild() || m.author.bot || m.webhookId || m.system) return;
        const channelId = m.channel.isThread() ? (m.channel.parentId ?? m.channelId) : m.channelId;
        void statsConfig(bot, m.guildId)
          .then((c) => {
            if (!c.ignoredChannelIds.includes(channelId)) buffer.message(m.guildId, channelId, m.author.id, m.author.username);
          })
          .catch((error: unknown) => bot.logger.warn({ err: error }, 'Statistik: Nachricht nicht gezählt'));
      },
    );
    on('guildMemberAdd', (m) => m.guild.id, (m) => buffer.member(m.guild.id, 'join'));
    on('guildMemberRemove', (m) => m.guild.id, (m) => buffer.member(m.guild.id, 'leave'));
  },
  onReady(bot) {
    const safe = (name: string, run: () => Promise<unknown>) => () => void run().catch((error: unknown) => bot.logger.warn({ err: error }, `Statistiken: ${name} fehlgeschlagen`));
    setInterval(safe('Sprachminuten', () => voiceTick(bot)), 60_000).unref();
    // Zähler jede Sekunde speichern – das Dashboard zeigt so fast sofort neue Nachrichten/Beitritte
    setInterval(safe('Speichern', () => flush(bot)), 1_000).unref();
    setInterval(safe('Statistik-Kanäle', () => updateStatChannels(bot)), 5_000).unref();
    setInterval(safe('Aufräumen', () => cleanup(bot)), 24 * 3_600_000).unref();
  },
  async onAction(bot, guildId, action) {
    const guild = bot.client.guilds.cache.get(guildId);
    if (!guild) return;
    if (action === 'refresh') {
      lastNames.clear();
      await updateStatChannels(bot);
    }
  },
};
