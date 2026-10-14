import { Readable } from 'node:stream';
import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  EndBehaviorType,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  StreamType,
  VoiceConnectionStatus,
  type AudioPlayer,
  type VoiceConnection,
} from '@discordjs/voice';
import type { Guild, GuildMember, SendableChannels, VoiceBasedChannel } from 'discord.js';
import OpusScript from 'opusscript';
import { loadGuildSecrets, loadSettings } from '@moin/db';
import { afterWakeWord, LISTEN_IDLE_MS, MAX_UTTERANCE_MS, MIN_UTTERANCE_MS, pcmDurationMs, pcmToWav16kMono, transcribeSpeech, type JuliaVoice, type SttFetch } from '@moin/shared';
import { pausedByMaintenance } from '../../core/maintenance.js';
import type { BotContext } from '../../core/types.js';
import { synthesize } from './voice.js';

/**
 * Mit Julia im Call reden (Wunsch Philip, 13.10.):
 * /julia gespraech start → Julia kommt in den Sprachkanal, sagt an, dass sie zuhört, und reagiert nur auf Sätze,
 * die mit „Julia …“ beginnen. Antwort per Stimme + als Text im Kanal, in dem gestartet wurde.
 * Audio wird nur im Speicher gesammelt (max. 15 s pro Satz), an die Spracherkennung geschickt und verworfen.
 * Julia geht bei /julia gespraech stop, nach 5 Minuten ohne Frage oder wenn niemand mehr im Kanal ist.
 */

/** Frage an Julia stellen (wird von index.ts gesetzt – vermeidet einen Import-Kreis) */
export type AskFn = (member: GuildMember, question: string, textChannelId: string) => Promise<string | null>;

export type StartResult = 'started' | 'already' | 'busy' | 'noVoice' | 'notConfigured' | 'failed';

const sessions = new Map<string, Conversation>();

export function conversationIn(guildId: string): Conversation | undefined {
  return sessions.get(guildId);
}

export class Conversation {
  private connection: VoiceConnection | null = null;
  private readonly player: AudioPlayer = createAudioPlayer();
  private busy = false;
  private lastActive = Date.now();
  private readonly listening = new Set<string>();
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(
    private readonly bot: BotContext,
    readonly guild: Guild,
    readonly channel: VoiceBasedChannel,
    private readonly text: SendableChannels & { id: string },
    private readonly voice: JuliaVoice,
    private readonly ask: AskFn,
    private readonly f: SttFetch = fetch as unknown as SttFetch,
  ) {}

  async start(): Promise<void> {
    sessions.set(this.guild.id, this);
    this.connection = joinVoiceChannel({ channelId: this.channel.id, guildId: this.guild.id, adapterCreator: this.guild.voiceAdapterCreator, selfDeaf: false, selfMute: false });
    // Netzwerkfehler (UDP …) dürfen den Bot nicht abstürzen lassen
    this.connection.on('error', (error) => this.bot.logger.warn({ err: error, guildId: this.guild.id }, 'Julia-Gespräch: Fehler der Sprachverbindung'));
    this.player.on('error', (error) => this.bot.logger.warn({ err: error, guildId: this.guild.id }, 'Julia-Gespräch: Wiedergabe-Fehler'));
    await entersState(this.connection, VoiceConnectionStatus.Ready, 15_000);
    this.connection.subscribe(this.player);
    this.connection.receiver.speaking.on('start', (userId) => this.onSpeaking(userId));
    this.connection.on(VoiceConnectionStatus.Disconnected, () => void this.stop('getrennt'));
    // Alle 20 s: noch jemand da? Zu lange keine Frage?
    this.timer = setInterval(() => {
      const humans = this.channel.members.filter((m) => !m.user.bot).size;
      if (pausedByMaintenance('julia', this.guild.id)) void this.stop('Wartung');
      else if (!humans) void this.stop('niemand mehr im Kanal');
      else if (Date.now() - this.lastActive > LISTEN_IDLE_MS) void this.stop('5 Minuten keine Frage');
    }, 20_000);
    this.timer.unref();
    await this.say('Hallo! Ich bin Julia und höre jetzt zu. Sagt „Julia“ und dann eure Frage.');
  }

  /** Stimme abspielen (gleiche Verbindung, kein erneutes Beitreten) */
  private async say(text: string): Promise<void> {
    if (this.stopped) return;
    const audio = await synthesize(this.bot, this.guild.id, this.voice, text);
    this.player.play(createAudioResource(Readable.from(audio), { inputType: StreamType.Arbitrary }));
    await entersState(this.player, AudioPlayerStatus.Playing, 15_000).catch(() => undefined);
    await entersState(this.player, AudioPlayerStatus.Idle, 90_000).catch(() => undefined);
  }

  private onSpeaking(userId: string): void {
    if (this.stopped || this.busy || this.listening.has(userId) || !this.connection) return;
    const member = this.channel.members.get(userId);
    if (!member || member.user.bot) return;
    this.listening.add(userId);
    const stream = this.connection.receiver.subscribe(userId, { end: { behavior: EndBehaviorType.AfterSilence, duration: 900 } });
    const decoder = new OpusScript(48_000, 2, OpusScript.Application.AUDIO);
    const chunks: Buffer[] = [];
    let bytes = 0;
    const maxBytes = (MAX_UTTERANCE_MS / 1000) * 48_000 * 4;
    stream.on('data', (packet: Buffer) => {
      if (bytes >= maxBytes) return;
      try {
        const pcm = decoder.decode(packet);
        chunks.push(pcm);
        bytes += pcm.length;
      } catch {
        // kaputtes Paket – überspringen
      }
    });
    let freed = false;
    const free = () => {
      this.listening.delete(userId);
      if (freed) return;
      freed = true;
      decoder.delete();
    };
    const done = () => {
      free();
      void this.onUtterance(member, Buffer.concat(chunks)).catch((error: unknown) => this.bot.logger.warn({ err: error, guildId: this.guild.id }, 'Julia-Gespräch: Satz fehlgeschlagen'));
    };
    stream.once('end', done);
    stream.once('error', free);
  }

  /** Ein Satz ist fertig: erkennen, Weckwort prüfen, Julia fragen, antworten */
  async onUtterance(member: GuildMember, pcm: Buffer): Promise<void> {
    if (this.stopped || this.busy || pcmDurationMs(pcm.length) < MIN_UTTERANCE_MS) return;
    this.busy = true;
    try {
      await this.handle(member, pcm);
    } finally {
      this.busy = false;
    }
  }

  private async handle(member: GuildMember, pcm: Buffer): Promise<void> {
    const [settings, secrets] = await Promise.all([loadSettings(this.bot.prisma).catch(() => null), loadGuildSecrets(this.bot.prisma, this.guild.id).catch(() => null)]);
    const heard = await transcribeSpeech({ wav: pcmToWav16kMono(pcm), provider: this.voice.stt, sttUrl: settings?.sttUrl || process.env.STT_URL, openaiKey: secrets?.openaiApiKey }, this.f, () => AbortSignal.timeout(30_000));
    const question = afterWakeWord(heard);
    if (!question || this.stopped) return; // nicht an Julia gerichtet – nichts merken, nichts schreiben
    this.lastActive = Date.now();
    try {
      const answer = (await this.ask(member, question, this.text.id)) ?? 'Dazu kann ich gerade nichts sagen.';
      await this.text.send({ content: `🎙️ **${member.displayName}:** ${question.slice(0, 500)}\n**Julia:** ${answer.slice(0, 1400)}`, allowedMentions: { parse: [] } }).catch(() => undefined);
      await this.say(answer);
    } finally {
      this.lastActive = Date.now();
    }
  }

  async stop(reason: string): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    sessions.delete(this.guild.id);
    this.player.stop(true);
    try {
      this.connection?.destroy();
    } catch {
      // schon weg
    }
    await this.text.send({ content: `👋 Julia hört nicht mehr zu (${reason}).`, allowedMentions: { parse: [] } }).catch(() => undefined);
  }
}

/** Gespräch starten – im Sprachkanal der Person */
export async function startConversation(bot: BotContext, member: GuildMember, text: SendableChannels & { id: string }, voice: JuliaVoice, ask: AskFn): Promise<StartResult> {
  const channel = member.voice.channel;
  if (!channel) return 'noVoice';
  if (sessions.has(member.guild.id)) return 'already';
  if (getVoiceConnection(member.guild.id)) return 'busy'; // Musik o. Ä. läuft
  if (!voice.enabled) return 'notConfigured';
  const talk = new Conversation(bot, member.guild, channel, text, voice, ask);
  try {
    await talk.start();
    return 'started';
  } catch (error) {
    bot.logger.warn({ err: error, guildId: member.guild.id }, 'Julia-Gespräch: Start fehlgeschlagen');
    await talk.stop('Start fehlgeschlagen');
    return 'failed';
  }
}

/** Alle Gespräche beenden (Wartung, Herunterfahren) */
export async function stopAllConversations(reason: string): Promise<void> {
  // Test-Server laufen in der Wartung normal weiter
  for (const s of [...sessions.values()]) if (pausedByMaintenance('julia', s.guild.id)) await s.stop(reason);
}
