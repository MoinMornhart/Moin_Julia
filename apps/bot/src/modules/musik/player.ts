import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  type AudioPlayer,
  type VoiceConnection,
} from '@discordjs/voice';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type { Guild, VoiceBasedChannel } from 'discord.js';
import { musicStateKey, type LoopMode, type MusicState } from '@moin/shared';
import type { BotContext } from '../../core/types.js';
import { MusicQueue, type Track } from './queue.js';
import { resolvePlaylist, spawnFfmpeg } from './source.js';

/**
 * Ein Player pro Server: Sprachverbindung, Warteschlange, Lautstärke, Wiederholen.
 * Der Zustand landet zusätzlich in Redis, damit das Dashboard „Jetzt läuft“ anzeigen kann.
 */
export class GuildMusic {
  readonly queue = new MusicQueue();
  volume: number;
  channelId: string | null = null;
  paused = false;
  startedAt = 0;
  private connection: VoiceConnection | null = null;
  private player: AudioPlayer;
  private ffmpeg: ChildProcessWithoutNullStreams | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  /** Während eines Titelwechsels meldet der Player kurz „Idle“ – das darf nicht weiterspringen */
  private switching = false;
  private onChange: () => void = () => undefined;

  constructor(
    private readonly bot: BotContext,
    readonly guild: Guild,
    defaultVolume: number,
    private readonly leaveAfterMs: number,
    private readonly notify: (kind: 'error' | 'left', track?: Track) => void,
  ) {
    this.volume = defaultVolume;
    this.player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
    this.player.on(AudioPlayerStatus.Idle, () => {
      if (!this.switching) void this.playNext(false);
    });
    this.player.on('error', (error) => {
      this.bot.logger.warn({ err: error, guildId: guild.id, track: this.queue.current?.url }, 'Musik: Wiedergabe-Fehler');
      if (this.queue.current) this.notify('error', this.queue.current);
    });
  }

  setListener(fn: () => void): void {
    this.onChange = fn;
  }

  /** In den Sprachkanal gehen (oder bleiben, wenn schon drin) */
  async join(channel: VoiceBasedChannel): Promise<void> {
    if (this.connection && this.channelId === channel.id && this.connection.state.status !== VoiceConnectionStatus.Destroyed) return;
    this.connection?.destroy();
    this.connection = joinVoiceChannel({ channelId: channel.id, guildId: this.guild.id, adapterCreator: this.guild.voiceAdapterCreator, selfDeaf: true, selfMute: false });
    this.channelId = channel.id;
    this.connection.on(VoiceConnectionStatus.Disconnected, () => {
      // Kurz warten, ob Discord die Verbindung selbst wieder aufbaut (Kanalwechsel/Netz), sonst aufräumen
      const conn = this.connection;
      if (!conn) return;
      Promise.race([entersState(conn, VoiceConnectionStatus.Signalling, 5000), entersState(conn, VoiceConnectionStatus.Connecting, 5000)]).catch(() => this.destroy());
    });
    await entersState(this.connection, VoiceConnectionStatus.Ready, 20_000);
    this.connection.subscribe(this.player);
  }

  /** Titel anstellen; startet sofort, wenn gerade nichts läuft */
  async enqueue(track: Track, max: number): Promise<number | 'full'> {
    const position = this.queue.add(track, max);
    if (position === 'full') return position;
    if (!this.queue.current) await this.playNext(true);
    this.changed();
    return position;
  }

  private async playNext(skip: boolean): Promise<void> {
    const track = skip ? this.queue.skip() : this.queue.next();
    if (!track) {
      this.switching = true;
      this.killFfmpeg();
      this.player.stop(true);
      this.switching = false;
      this.startedAt = 0;
      this.scheduleLeave();
      this.changed();
      return;
    }
    this.cancelLeave();
    await this.start(track, 0);
  }

  private async start(track: Track, seekMs: number): Promise<void> {
    this.switching = true;
    try {
      this.killFfmpeg();
      const url = await resolvePlaylist(track.url).catch(() => track.url);
      if (this.queue.current !== track) return; // inzwischen übersprungen/gestoppt
      const ffmpeg = spawnFfmpeg(url, this.volume, seekMs);
      this.ffmpeg = ffmpeg;
      ffmpeg.on('error', (error) => this.bot.logger.warn({ err: error }, 'Musik: ffmpeg nicht startbar (installiert?)'));
      ffmpeg.stderr.on('data', (chunk: Buffer) => this.bot.logger.debug({ msg: chunk.toString().slice(0, 300) }, 'ffmpeg'));
      const resource = createAudioResource(ffmpeg.stdout, { inputType: StreamType.OggOpus });
      this.startedAt = Date.now() - seekMs;
      this.paused = false;
      this.player.play(resource);
    } finally {
      this.switching = false;
    }
    this.changed();
  }

  skip(): void {
    void this.playNext(true);
  }

  togglePause(): boolean {
    if (this.paused) {
      this.player.unpause();
      this.paused = false;
    } else {
      this.player.pause();
      this.paused = true;
    }
    this.changed();
    return this.paused;
  }

  /** Lautstärke: ffmpeg neu starten (Radio: live weiter, Datei: an derselben Stelle) */
  async setVolume(volume: number): Promise<void> {
    this.volume = Math.max(1, Math.min(100, Math.round(volume)));
    const track = this.queue.current;
    if (track && !this.paused) {
      const position = track.kind === 'file' ? Date.now() - this.startedAt : 0;
      await this.start(track, position);
    }
    this.changed();
  }

  setLoop(mode: LoopMode): void {
    this.queue.loop = mode;
    this.changed();
  }

  /** Alles stoppen und den Kanal verlassen */
  destroy(): void {
    this.cancelLeave();
    this.queue.clear();
    this.switching = true;
    this.player.stop(true);
    this.killFfmpeg();
    this.switching = false;
    this.connection?.destroy();
    this.connection = null;
    this.channelId = null;
    this.paused = false;
    this.changed();
  }

  /** Allein im Kanal? Dann nach der Wartezeit gehen */
  checkAlone(): void {
    const channel = this.channelId ? this.guild.channels.cache.get(this.channelId) : undefined;
    const humans = channel?.isVoiceBased() ? channel.members.filter((m) => !m.user.bot).size : 0;
    if (humans === 0) this.scheduleLeave();
    else if (this.queue.current) this.cancelLeave();
  }

  private scheduleLeave(): void {
    if (this.idleTimer || !this.connection) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (!this.connection) return;
      this.notify('left');
      this.destroy();
    }, this.leaveAfterMs);
    this.idleTimer.unref();
  }

  private cancelLeave(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private killFfmpeg(): void {
    if (this.ffmpeg && this.ffmpeg.exitCode === null) this.ffmpeg.kill('SIGKILL');
    this.ffmpeg = null;
  }

  state(): MusicState {
    const q = this.queue;
    return {
      channelId: this.channelId,
      playing: !!q.current && !this.paused,
      paused: this.paused,
      volume: this.volume,
      loop: q.loop,
      current: q.current ? { ...q.current, startedAt: this.startedAt } : null,
      queue: q.upcoming.slice(0, 25),
      updatedAt: Date.now(),
    };
  }

  private changed(): void {
    void this.bot.redis.set(musicStateKey(this.guild.id), JSON.stringify(this.state()), 'EX', 6 * 3600).catch(() => undefined);
    this.onChange();
  }
}
