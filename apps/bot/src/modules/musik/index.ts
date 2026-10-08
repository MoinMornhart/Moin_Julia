import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type Guild,
  type GuildMember,
  type Message,
  type MessageActionRowComponentBuilder,
  type SendableChannels,
} from 'discord.js';
import { formatClock, LOOP_MODES, parseMusicConfig, t, titleFromUrl, type Locale, type LoopMode, type MusicConfig, type TranslationKey } from '@moin/shared';
import type { BotContext, BotModule, CommandContext, SlashCommand } from '../../core/types.js';
import { GuildMusic } from './player.js';
import type { Track } from './queue.js';
import { getStation, searchStations, vetUrl } from './source.js';

/**
 * Musik wie Euphony – mit regelkonformen Quellen: Internet-Radio (radio-browser.info) und direkte
 * Audio-Links. Steuerung per /musik, Steuer-Panel mit Knöpfen und aus dem Dashboard.
 */

function musicConfig(bot: BotContext, guildId: string): Promise<MusicConfig> {
  return bot.modules.config(guildId, 'musik', parseMusicConfig);
}

const players = new Map<string, GuildMusic>();
const panels = new Map<string, Message>();
const panelTimers = new Map<string, NodeJS.Timeout>();

function d(key: TranslationKey) {
  return { de: t('de', key), loc: { 'en-US': t('en', key), 'en-GB': t('en', key) } };
}
const en = (name: string) => ({ 'en-US': name, 'en-GB': name });

/** Steuern dürfen: „Server verwalten“, DJ-Rolle – oder (ohne DJ-Rollen) alle im selben Sprachkanal */
export function canControl(member: GuildMember, config: Pick<MusicConfig, 'djRoleIds'>, botChannelId: string | null): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  if (config.djRoleIds.length) return config.djRoleIds.some((r) => member.roles.cache.has(r));
  return !botChannelId || member.voice.channelId === botChannelId;
}

async function getPlayer(bot: BotContext, guild: Guild, locale: Locale): Promise<GuildMusic> {
  let gm = players.get(guild.id);
  if (!gm) {
    const config = await musicConfig(bot, guild.id);
    gm = new GuildMusic(bot, guild, config.defaultVolume, config.leaveAfterSeconds * 1000, (kind, track) => {
      const panel = panels.get(guild.id);
      const channel = panel?.channel;
      if (!channel?.isSendable()) return;
      const text = kind === 'left' ? t(locale, 'music.left') : t(locale, 'music.error', { title: track?.title ?? '?' });
      void channel.send({ content: text, allowedMentions: { parse: [] } }).catch(() => undefined);
    });
    gm.setListener(() => schedulePanelUpdate(guild.id, locale));
    players.set(guild.id, gm);
  }
  return gm;
}

// ── Steuer-Panel ────────────────────────────────────────────────────────────
function panelPayload(gm: GuildMusic, locale: Locale) {
  const s = gm.state();
  const embed = new EmbedBuilder().setColor(0x2fd1b8);
  if (!s.current) {
    embed.setDescription(t(locale, 'music.nothing'));
  } else {
    embed
      .setAuthor({ name: `${t(locale, 'music.nowPlaying')} · ${t(locale, s.current.kind === 'radio' ? 'music.radio' : 'music.file')}` })
      .setTitle(s.current.title.slice(0, 256))
      .addFields(
        { name: t(locale, 'music.requestedBy'), value: `<@${s.current.requestedBy}>`, inline: true },
        { name: t(locale, 'music.volume'), value: `${s.volume} %`, inline: true },
        { name: t(locale, 'music.loop'), value: t(locale, `music.loop.${s.loop}` as TranslationKey), inline: true },
      );
    if (s.current.kind === 'file' && s.current.startedAt) embed.setFooter({ text: `⏱ ${formatClock(Date.now() - s.current.startedAt)}${s.paused ? ' · ⏸' : ''}` });
    else if (s.paused) embed.setFooter({ text: '⏸' });
    if (s.queue.length) {
      embed.addFields({
        name: `${t(locale, 'music.upNext')} (${s.queue.length})`,
        value: s.queue
          .slice(0, 5)
          .map((q, i) => `${i + 1}. ${q.title.slice(0, 60)}`)
          .join('\n'),
      });
    }
  }
  const btn = (id: string, emoji: string, style = ButtonStyle.Secondary, disabled = false) => new ButtonBuilder().setCustomId(`musik:btn:${id}`).setEmoji(emoji).setStyle(style).setDisabled(disabled);
  const idle = !s.current;
  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    btn('pause', s.paused ? '▶️' : '⏸️', ButtonStyle.Primary, idle),
    btn('skip', '⏭️', ButtonStyle.Secondary, idle),
    btn('stop', '⏹️', ButtonStyle.Danger, idle && !s.channelId),
    btn('loop', '🔁', s.loop === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success, idle),
    btn('voldown', '🔉', ButtonStyle.Secondary, idle),
  );
  const row2 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(btn('volup', '🔊', ButtonStyle.Secondary, idle));
  return { embeds: [embed], components: [row, row2], allowedMentions: { parse: [] as const } };
}

function schedulePanelUpdate(guildId: string, locale: Locale): void {
  if (panelTimers.has(guildId)) return;
  panelTimers.set(
    guildId,
    setTimeout(() => {
      panelTimers.delete(guildId);
      const panel = panels.get(guildId);
      const gm = players.get(guildId);
      if (panel && gm) void panel.edit(panelPayload(gm, locale)).catch(() => panels.delete(guildId));
    }, 1200),
  );
}

async function postPanel(channel: SendableChannels, gm: GuildMusic, locale: Locale): Promise<void> {
  const old = panels.get(gm.guild.id);
  if (old) await old.delete().catch(() => undefined);
  const msg = await channel.send(panelPayload(gm, locale)).catch(() => null);
  if (msg) panels.set(gm.guild.id, msg);
}

const nextLoop = (mode: LoopMode): LoopMode => LOOP_MODES[(LOOP_MODES.indexOf(mode) + 1) % LOOP_MODES.length]!;

// ── Abspielen ───────────────────────────────────────────────────────────────
type PlayResult = { ok: true; message: string } | { ok: false; message: string };

/** Eingabe → Titel: Favorit (fav:N), Radiosender (radio:UUID) oder Link */
async function resolveInput(input: string, config: MusicConfig, member: GuildMember, locale: Locale): Promise<Track | PlayResult> {
  const value = input.trim();
  if (value.startsWith('fav:')) {
    const preset = config.presets[Number(value.slice(4))];
    if (!preset) return { ok: false, message: t(locale, 'music.notFound', { query: value }) };
    const vetted = await vetUrl(preset.url, config.allowPrivateUrls);
    if (!vetted.ok) return { ok: false, message: vetted.reason === 'private' ? t(locale, 'music.privateUrl') : t(locale, 'music.badUrl', { error: vetted.error ?? '' }) };
    return { allowPrivate: config.allowPrivateUrls, title: preset.name, url: vetted.url, kind: /\.(mp3|ogg|opus|m4a|aac|flac|wav|webm)(\?|$)/i.test(vetted.url) ? 'file' : 'radio', requestedBy: member.id };
  }
  if (value.startsWith('radio:')) {
    const station = await getStation(value.slice(6)).catch(() => null);
    if (!station) return { ok: false, message: t(locale, 'music.notFound', { query: value }) };
    const vetted = await vetUrl(station.url, false);
    if (!vetted.ok) return { ok: false, message: t(locale, 'music.notFound', { query: station.name }) };
    return { title: station.name, url: vetted.url, kind: 'radio', requestedBy: member.id };
  }
  if (/^https?:\/\//i.test(value)) {
    const vetted = await vetUrl(value, config.allowPrivateUrls);
    if (!vetted.ok) return { ok: false, message: vetted.reason === 'private' ? t(locale, 'music.privateUrl') : t(locale, 'music.badUrl', { error: vetted.error ?? '' }) };
    const isFile = /\.(mp3|ogg|opus|m4a|aac|flac|wav|webm)(\?|$)/i.test(vetted.url);
    return { allowPrivate: config.allowPrivateUrls, title: titleFromUrl(vetted.url), url: vetted.url, kind: isFile ? 'file' : 'radio', requestedBy: member.id };
  }
  // Freier Text ohne Auswahl: bester Radio-Treffer
  const [best] = await searchStations(value, fetch, 1).catch(() => []);
  if (!best) return { ok: false, message: t(locale, 'music.notFound', { query: value.slice(0, 60) }) };
  // Auch Treffer aus dem Verzeichnis prüfen – dort kann jeder Sender mit beliebiger Adresse eintragen
  const vetted = await vetUrl(best.url, false);
  if (!vetted.ok) return { ok: false, message: t(locale, 'music.notFound', { query: best.name }) };
  return { title: best.name, url: vetted.url, kind: 'radio', requestedBy: member.id };
}

export async function play(bot: BotContext, member: GuildMember, input: string, locale: Locale, panelChannel: SendableChannels | null): Promise<PlayResult> {
  const config = await musicConfig(bot, member.guild.id);
  const voice = member.voice.channel;
  if (!voice) return { ok: false, message: t(locale, 'music.notInVoice') };
  const gm = await getPlayer(bot, member.guild, locale);
  if (gm.channelId && gm.channelId !== voice.id && gm.queue.current) return { ok: false, message: t(locale, 'music.otherChannel', { channel: `<#${gm.channelId}>` }) };
  if (!canControl(member, config, gm.queue.current ? gm.channelId : null)) return { ok: false, message: t(locale, 'music.noPermission') };
  const me = member.guild.members.me;
  const perms = me ? voice.permissionsFor(me) : null;
  if (!perms?.has([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) return { ok: false, message: t(locale, 'music.cannotJoin', { channel: `<#${voice.id}>` }) };

  const track = await resolveInput(input, config, member, locale);
  if ('ok' in track) return track;
  await gm.join(voice);
  const position = await gm.enqueue(track, config.maxQueue);
  if (position === 'full') return { ok: false, message: t(locale, 'music.queueFull', { max: String(config.maxQueue) }) };
  if (panelChannel && (!panels.has(member.guild.id) || position === 1)) await postPanel(panelChannel, gm, locale);
  return { ok: true, message: position === 1 ? `🎵 **${track.title}**` : t(locale, 'music.queued', { position: String(position), title: track.title }) };
}

/** Steuer-Befehle (Knopf, /musik oder Dashboard) */
export async function control(bot: BotContext, guild: Guild, action: string, locale: Locale): Promise<string> {
  const gm = players.get(guild.id);
  if (!gm || (!gm.queue.current && action !== 'stop')) return t(locale, 'music.nothing');
  if (action === 'skip') {
    gm.skip();
    return t(locale, 'music.skipped');
  }
  if (action === 'stop') {
    gm.destroy();
    players.delete(guild.id);
    const panel = panels.get(guild.id);
    panels.delete(guild.id);
    await panel?.edit({ ...panelPayload(gm, locale), components: [] }).catch(() => undefined);
    return t(locale, 'music.stopped');
  }
  if (action === 'pause') return t(locale, gm.togglePause() ? 'music.paused' : 'music.resumed');
  if (action === 'loop') {
    gm.setLoop(nextLoop(gm.queue.loop));
    return t(locale, 'music.loopSet', { mode: t(locale, `music.loop.${gm.queue.loop}` as TranslationKey) });
  }
  if (action.startsWith('loop:')) {
    const mode = action.slice(5) as LoopMode;
    if (LOOP_MODES.includes(mode)) gm.setLoop(mode);
    return t(locale, 'music.loopSet', { mode: t(locale, `music.loop.${gm.queue.loop}` as TranslationKey) });
  }
  if (action === 'volup' || action === 'voldown' || action.startsWith('volume:')) {
    const target = action === 'volup' ? gm.volume + 10 : action === 'voldown' ? gm.volume - 10 : Number(action.slice(7));
    if (Number.isFinite(target)) await gm.setVolume(target);
    return t(locale, 'music.volumeSet', { volume: String(gm.volume) });
  }
  return t(locale, 'music.nothing');
}

// ── /musik ──────────────────────────────────────────────────────────────────
const musicCommand: SlashCommand = {
  data: (() => {
    const x = d;
    return new SlashCommandBuilder()
      .setName('musik')
      .setNameLocalizations(en('music'))
      .setDescription(x('music.cmd.root').de)
      .setDescriptionLocalizations(x('music.cmd.root').loc)
      .setContexts(InteractionContextType.Guild)
      .addSubcommand((s) =>
        s
          .setName('play')
          .setDescription(x('music.cmd.play').de)
          .setDescriptionLocalizations(x('music.cmd.play').loc)
          .addStringOption((o) => o.setName('suche').setNameLocalizations(en('query')).setDescription(x('music.cmd.query').de).setDescriptionLocalizations(x('music.cmd.query').loc).setRequired(true).setMaxLength(500).setAutocomplete(true)),
      )
      .addSubcommand((s) => s.setName('skip').setDescription(x('music.cmd.skip').de).setDescriptionLocalizations(x('music.cmd.skip').loc))
      .addSubcommand((s) => s.setName('stop').setDescription(x('music.cmd.stop').de).setDescriptionLocalizations(x('music.cmd.stop').loc))
      .addSubcommand((s) => s.setName('pause').setDescription(x('music.cmd.pause').de).setDescriptionLocalizations(x('music.cmd.pause').loc))
      .addSubcommand((s) =>
        s
          .setName('lautstaerke')
          .setNameLocalizations(en('volume'))
          .setDescription(x('music.cmd.volume').de)
          .setDescriptionLocalizations(x('music.cmd.volume').loc)
          .addIntegerOption((o) => o.setName('prozent').setNameLocalizations(en('percent')).setDescription(x('music.cmd.volumeValue').de).setDescriptionLocalizations(x('music.cmd.volumeValue').loc).setRequired(true).setMinValue(1).setMaxValue(100)),
      )
      .addSubcommand((s) =>
        s
          .setName('loop')
          .setDescription(x('music.cmd.loop').de)
          .setDescriptionLocalizations(x('music.cmd.loop').loc)
          .addStringOption((o) =>
            o
              .setName('modus')
              .setNameLocalizations(en('mode'))
              .setDescription(x('music.cmd.loopMode').de)
              .setDescriptionLocalizations(x('music.cmd.loopMode').loc)
              .setRequired(true)
              .addChoices(
                { name: 'aus', name_localizations: en('off'), value: 'off' },
                { name: 'Titel', name_localizations: en('track'), value: 'track' },
                { name: 'Warteschlange', name_localizations: en('queue'), value: 'queue' },
              ),
          ),
      )
      .addSubcommand((s) => s.setName('warteschlange').setNameLocalizations(en('queue')).setDescription(x('music.cmd.queue').de).setDescriptionLocalizations(x('music.cmd.queue').loc))
      .addSubcommand((s) => s.setName('panel').setDescription(x('music.cmd.panel').de).setDescriptionLocalizations(x('music.cmd.panel').loc))
      .toJSON();
  })(),
  async autocomplete({ interaction, bot }) {
    if (!interaction.inCachedGuild()) return;
    const config = await musicConfig(bot, interaction.guildId);
    const typed = interaction.options.getFocused().trim();
    const favs = config.presets
      .map((p, i) => ({ name: `⭐ ${p.name}`.slice(0, 100), value: `fav:${i}` }))
      .filter((c) => !typed || c.name.toLowerCase().includes(typed.toLowerCase()));
    if (/^https?:\/\//i.test(typed)) return void (await interaction.respond(typed.length <= 100 ? [{ name: typed.slice(0, 100), value: typed }] : []));
    const stations = typed.length >= 2 ? await searchStations(typed, fetch, 15).catch(() => []) : [];
    const choices = [
      ...favs,
      ...stations.map((s) => ({ name: `📻 ${s.name}${s.country ? ` · ${s.country}` : ''}${s.bitrate ? ` · ${s.bitrate} kbit/s` : ''}`.slice(0, 100), value: `radio:${s.uuid}` })),
    ].slice(0, 25);
    await interaction.respond(choices);
  },
  async execute({ interaction, locale, bot }: CommandContext) {
    if (!interaction.inCachedGuild()) return;
    const sub = interaction.options.getSubcommand();
    const member = interaction.member;
    const config = await musicConfig(bot, interaction.guildId);
    if (sub === 'play') {
      await interaction.deferReply();
      const result = await play(bot, member, interaction.options.getString('suche', true), locale, interaction.channel?.isSendable() ? interaction.channel : null);
      await interaction.editReply({ content: result.message, allowedMentions: { parse: [] } });
      return;
    }
    const gm = players.get(interaction.guildId);
    if (sub === 'warteschlange') {
      const s = gm?.state();
      const lines = s?.current ? [`▶️ **${s.current.title}**`, ...s.queue.map((q, i) => `${i + 1}. ${q.title}`)] : [];
      return void (await interaction.reply({ content: (lines.join('\n') || t(locale, 'music.queueEmpty')).slice(0, 2000), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }));
    }
    if (sub === 'panel') {
      if (!gm || !interaction.channel?.isSendable()) return void (await interaction.reply({ content: t(locale, 'music.nothing'), flags: MessageFlags.Ephemeral }));
      await postPanel(interaction.channel, gm, locale);
      return void (await interaction.reply({ content: '👍', flags: MessageFlags.Ephemeral }));
    }
    if (!canControl(member, config, gm?.channelId ?? null)) return void (await interaction.reply({ content: t(locale, 'music.noPermission'), flags: MessageFlags.Ephemeral }));
    const action = sub === 'lautstaerke' ? `volume:${interaction.options.getInteger('prozent', true)}` : sub === 'loop' ? `loop:${interaction.options.getString('modus', true)}` : sub;
    await interaction.reply({ content: await control(bot, interaction.guild, action, locale), allowedMentions: { parse: [] } });
  },
};

export const musikModule: BotModule = {
  id: 'musik',
  commands: [musicCommand],
  setup({ bot, on }) {
    // Allein im Kanal → nach der Wartezeit gehen; Bot aus dem Kanal geworfen → aufräumen
    on(
      'voiceStateUpdate',
      (_old, now) => now.guild.id,
      (old, now) => {
        const gm = players.get(now.guild.id);
        if (!gm) return;
        if (now.id === bot.client.user?.id && old.channelId && !now.channelId) {
          gm.destroy();
          players.delete(now.guild.id);
          return;
        }
        if (now.id === bot.client.user?.id && now.channelId) gm.channelId = now.channelId;
        gm.checkAlone();
      },
    );
  },
  async onComponent({ interaction, action, args, locale, bot }) {
    if (action !== 'btn' || !interaction.isButton()) return;
    const config = await musicConfig(bot, interaction.guildId);
    const gm = players.get(interaction.guildId);
    if (!canControl(interaction.member, config, gm?.channelId ?? null)) return void (await interaction.reply({ content: t(locale, 'music.noPermission'), flags: MessageFlags.Ephemeral }));
    const message = await control(bot, interaction.guild, args[0] ?? '', locale);
    const fresh = players.get(interaction.guildId);
    if (fresh) await interaction.update(panelPayload(fresh, locale)).catch(() => undefined);
    else await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => undefined);
  },
  async onAction(bot, guildId, action) {
    const guild = bot.client.guilds.cache.get(guildId);
    if (!guild) return;
    const locale = await bot.modules.locale(guildId);
    await control(bot, guild, action, locale);
  },
  async onConfigChange(bot, guildId) {
    // Modul ausgeschaltet → Musik stoppen
    if (!(await bot.modules.isEnabled(guildId, 'musik'))) {
      players.get(guildId)?.destroy();
      players.delete(guildId);
    }
  },
};
