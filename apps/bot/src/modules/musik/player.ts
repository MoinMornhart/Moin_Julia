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
import type { IncomingMessage } from 'node:http';
import type { Guild, VoiceBasedChannel } from 'discord.js';
import { MUSIC_EFFECTS, musicLastQueueKey, musicStateKey, type LoopMode, type MusicEffect, type MusicState } from '@moin/shared';
import type { BotContext } from '../../core/types.js';
import { MusicQueue, type Track } from './queue.js';
import { openStream, spawnFfmpeg } from './source.js';
import { ytRelated, ytStream } from './youtube.js';

/**
 * Ein Player pro Server: Sprachverbindung, Warteschlange, Lautstärke, Effekte, Wiederholen,
 * Autoplay und 24/7. Der Zustand landet zusätzlich in Redis, damit das Dashboard „Jetzt läuft“ anzeigen kann.
 */
export class GuildMusic {
  readonly queue = new MusicQueue();
  volume: number;
  effect: MusicEffect | null = null;
  channelId: string | null = null;
  paused = false;
  startedAt = 0;
  private pausedAt = 0;
  /** Einstellungen (setzt das Modul beim Erstellen und bei Änderungen) */
  autoplay = false;
  stay247 = false;
  leaveAfterMs: number;
  /** Darf YouTube/SoundCloud genutzt werden? (Instanz-Einstellung, wird bei jedem Titel neu gefragt) */
  youtubeAllowed: () => Promise<boolean> = async () => false;
  /** Vote-Skip: Stimmen für den aktuellen Titel */
  readonly skipVotes = new Set<string>();
  private connection: VoiceConnection | null = null;
  private player: AudioPlayer;
  private ffmpeg: ChildProcessWithoutNullStreams | null = null;
  /** Aktueller Datenstrom (wird beim Wechsel geschlossen) */
  private source: IncomingMessage | null = null;
  private ytProc: ChildProcessWithoutNullStreams | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  /** Während eines Titelwechsels meldet der Player kurz „Idle“ – das darf nicht weiterspringen */
  private switching = false;
  private onChange: () => void = () => undefined;

  constructor(
    private readonly bot: BotContext,
    readonly guild: Guild,
    defaultVolume: number,
    leaveAfterMs: number,
    private readonly notify: (kind: 'error' | 'left' | 'autoplay', track?: Track) => void,
  ) {
    this.volume = defaultVolume;
    this.leaveAfterMs = leaveAfterMs;
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

  /** Mehrere Titel (Playlist); Ergebnis: Anzahl angestellt */
  async enqueueMany(tracks: Track[], max: number): Promise<number> {
    const added = this.queue.addMany(tracks, max);
    if (added && !this.queue.current) await this.playNext(true);
    this.changed();
    return added;
  }

  private async playNext(skip: boolean): Promise<void> {
    const before = this.queue.current;
    let track = skip ? this.queue.skip() : this.queue.next();
    if (!track && this.autoplay && before) track = await this.autoplayNext(before);
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

  /** Autoplay: passende YouTube-Titel (Mix zum letzten Titel), die zuletzt nicht liefen */
  private async autoplayNext(last: Track): Promise<Track | null> {
    if (last.kind !== 'youtube' || !(await this.youtubeAllowed())) return null;
    const recent = new Set([...this.queue.history.map((t) => t.url), last.url]);
    const related = await ytRelated(last.url, 8).catch(() => []);
    const fresh = related.filter((r) => !recent.has(r.url)).slice(0, 3);
    if (!fresh.length) return null;
    this.queue.addMany(
      fresh.map((r) => ({ title: r.title, url: r.url, kind: 'youtube' as const, requestedBy: this.bot.client.user?.id ?? '', durationMs: r.durationMs, author: r.author, thumbnail: r.thumbnail, auto: true })),
      50,
    );
    const next = this.queue.skip();
    if (next) this.notify('autoplay', next);
    return next;
  }

  private async start(track: Track, seekMs: number): Promise<void> {
    this.switching = true;
    let failed = false;
    if (seekMs === 0) this.skipVotes.clear();
    try {
      this.killFfmpeg();
      const filter = this.effect ? MUSIC_EFFECTS[this.effect].filter : undefined;
      if (track.kind === 'youtube') {
        if (!(await this.youtubeAllowed())) throw new Error('YouTube ist auf dieser Instanz aus.');
        if (this.queue.current !== track) return;
        const yt = ytStream(track.url);
        this.ytProc = yt;
        const ffmpeg = this.spawn(seekMs, filter);
        yt.on('error', (error) => this.bot.logger.warn({ err: error }, 'Musik: yt-dlp nicht startbar (installiert?)'));
        yt.stderr.on('data', (chunk: Buffer) => this.bot.logger.debug({ msg: chunk.toString().slice(0, 300) }, 'yt-dlp'));
        yt.stdout.on('error', () => undefined);
        yt.stdout.pipe(ffmpeg.stdin);
      } else {
        const opened = await openStream(track.url, { allowPrivate: !!track.allowPrivate }).catch((error: unknown) => error as Error);
        if (this.queue.current !== track) {
          // inzwischen übersprungen/gestoppt
          if (!(opened instanceof Error) && opened.kind === 'pipe') opened.res.destroy();
          return;
        }
        if (opened instanceof Error) throw opened;
        const ffmpeg = this.spawn(seekMs, filter, opened.kind === 'pipe' ? 'pipe:0' : opened.url);
        if (opened.kind === 'pipe') this.feed(track, ffmpeg, opened.res, 0);
        else ffmpeg.stdin.end();
      }
      this.startedAt = Date.now() - seekMs;
      this.paused = false;
    } catch (error) {
      this.bot.logger.warn({ err: error, guildId: this.guild.id, track: track.url }, 'Musik: Titel nicht abspielbar');
      this.notify('error', track);
      failed = true;
    } finally {
      this.switching = false;
    }
    if (failed) {
      // Nicht abspielbaren Titel ganz entfernen (sonst Endlosschleife bei „Schlange wiederholen“)
      if (this.queue.current === track) this.queue.current = null;
      await this.playNext(true);
      return;
    }
    this.changed();
  }

  /** ffmpeg starten und an den Discord-Player hängen */
  private spawn(seekMs: number, filter: string | undefined, input = 'pipe:0'): ChildProcessWithoutNullStreams {
    const ffmpeg = spawnFfmpeg(input, this.volume, seekMs, filter);
    this.ffmpeg = ffmpeg;
    ffmpeg.on('error', (error) => this.bot.logger.warn({ err: error }, 'Musik: ffmpeg nicht startbar (installiert?)'));
    ffmpeg.stdin.on('error', () => undefined); // ffmpeg beendet → Schreiben ins Leere ist egal
    ffmpeg.stderr.on('data', (chunk: Buffer) => this.bot.logger.debug({ msg: chunk.toString().slice(0, 300) }, 'ffmpeg'));
    this.player.play(createAudioResource(ffmpeg.stdout, { inputType: StreamType.OggOpus }));
    return ffmpeg;
  }

  /** Daten an ffmpeg weiterreichen; bricht ein Radio-Stream ab, bis zu 3-mal neu verbinden */
  private feed(track: Track, ffmpeg: ChildProcessWithoutNullStreams, res: IncomingMessage, attempt: number): void {
    const radio = track.kind === 'radio';
    const since = Date.now();
    this.source = res;
    res.pipe(ffmpeg.stdin, { end: !radio });
    if (!radio) return;
    let done = false;
    const reconnect = () => {
      if (done) return;
      done = true;
      const stillPlaying = () => this.ffmpeg === ffmpeg && this.queue.current === track;
      if (!stillPlaying()) return;
      const next = Date.now() - since > 30_000 ? 0 : attempt + 1; // lief lange gut → Zähler zurücksetzen
      if (next > 3) {
        ffmpeg.stdin.end();
        return;
      }
      setTimeout(() => {
        if (!stillPlaying()) return;
        openStream(track.url, { allowPrivate: !!track.allowPrivate }).then(
          (opened) => {
            if (opened.kind === 'pipe' && stillPlaying()) this.feed(track, ffmpeg, opened.res, next);
            else {
              if (opened.kind === 'pipe') opened.res.destroy();
              ffmpeg.stdin.end();
            }
          },
          () => (stillPlaying() ? ffmpeg.stdin.end() : undefined),
        );
      }, 2000).unref();
    };
    res.once('end', reconnect);
    res.once('error', reconnect);
  }

  /** Aktuelle Stelle im Titel (ms) – Pausen zählen nicht mit */
  position(): number {
    if (!this.startedAt) return 0;
    return (this.paused ? this.pausedAt : Date.now()) - this.startedAt;
  }

  /** Lässt sich im Titel springen? (Radio nicht) */
  get seekable(): boolean {
    return !!this.queue.current && this.queue.current.kind !== 'radio';
  }

  skip(): void {
    void this.playNext(true);
  }

  /** Vorheriger Titel; false = es gibt keinen */
  async back(): Promise<boolean> {
    const track = this.queue.back();
    if (!track) return false;
    this.cancelLeave();
    await this.start(track, 0);
    return true;
  }

  /** Zu Platz n springen */
  async jump(position: number): Promise<boolean> {
    const track = this.queue.jump(position);
    if (!track) return false;
    await this.start(track, 0);
    return true;
  }

  async seek(ms: number): Promise<boolean> {
    const track = this.queue.current;
    if (!track || !this.seekable) return false;
    const max = track.durationMs ? Math.max(0, track.durationMs - 1000) : Infinity;
    await this.start(track, Math.max(0, Math.min(ms, max)));
    return true;
  }

  shuffle(): void {
    this.queue.shuffle();
    this.changed();
  }

  remove(position: number): Track | null {
    const removed = this.queue.remove(position);
    this.changed();
    return removed;
  }

  togglePause(): boolean {
    if (this.paused) {
      this.player.unpause();
      this.startedAt += Date.now() - this.pausedAt;
      this.paused = false;
    } else {
      this.player.pause();
      this.pausedAt = Date.now();
      this.paused = true;
    }
    this.changed();
    return this.paused;
  }

  /** Lautstärke/Effekt: ffmpeg neu starten (Radio: live weiter, sonst an derselben Stelle) */
  private async restartAtPosition(): Promise<void> {
    const track = this.queue.current;
    if (track && !this.paused) await this.start(track, this.seekable ? this.position() : 0);
  }

  async setVolume(volume: number): Promise<void> {
    this.volume = Math.max(1, Math.min(100, Math.round(volume)));
    await this.restartAtPosition();
    this.changed();
  }

  async setEffect(effect: MusicEffect | null): Promise<void> {
    this.effect = effect;
    await this.restartAtPosition();
    this.changed();
  }

  setLoop(mode: LoopMode): void {
    this.queue.loop = mode;
    this.changed();
  }

  /** Alles stoppen und den Kanal verlassen; die Warteschlange wird für „wiederherstellen“ gemerkt */
  destroy(): void {
    this.rememberQueue();
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

  /** Aktuellen Titel + Warteschlange für 7 Tage in Redis merken (übersteht auch einen Neustart) */
  rememberQueue(): void {
    const tracks = [this.queue.current, ...this.queue.upcoming].filter((t): t is Track => !!t && !t.auto);
    if (!tracks.length) return;
    void this.bot.redis.set(musicLastQueueKey(this.guild.id), JSON.stringify(tracks.slice(0, 200)), 'EX', 7 * 86_400).catch(() => undefined);
  }

  /** Allein im Kanal? Dann nach der Wartezeit gehen (außer 24/7) */
  checkAlone(): void {
    const channel = this.channelId ? this.guild.channels.cache.get(this.channelId) : undefined;
    const humans = channel?.isVoiceBased() ? channel.members.filter((m) => !m.user.bot).size : 0;
    if (humans === 0) this.scheduleLeave();
    else if (this.queue.current) this.cancelLeave();
  }

  /** Zuhörer im Kanal (ohne Bots) – für Vote-Skip */
  listeners(): string[] {
    const channel = this.channelId ? this.guild.channels.cache.get(this.channelId) : undefined;
    return channel?.isVoiceBased() ? [...channel.members.filter((m) => !m.user.bot).keys()] : [];
  }

  private scheduleLeave(): void {
    if (this.stay247 || this.idleTimer || !this.connection) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (!this.connection || this.stay247) return;
      this.notify('left');
      this.destroy();
    }, this.leaveAfterMs);
    this.idleTimer.unref();
  }

  cancelLeave(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private killFfmpeg(): void {
    this.source?.destroy();
    this.source = null;
    if (this.ytProc && this.ytProc.exitCode === null) this.ytProc.kill('SIGKILL');
    this.ytProc = null;
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
      current: q.current
        ? { title: q.current.title, url: q.current.url, kind: q.current.kind, requestedBy: q.current.requestedBy, startedAt: Date.now() - this.position(), durationMs: q.current.durationMs, thumbnail: q.current.thumbnail, author: q.current.author }
        : null,
      queue: q.upcoming.slice(0, 25).map((t) => ({ title: t.title, url: t.url, kind: t.kind, requestedBy: t.requestedBy, durationMs: t.durationMs })),
      effect: this.effect,
      autoplay: this.autoplay,
      updatedAt: Date.now(),
    };
  }

  changed(): void {
    void this.bot.redis.set(musicStateKey(this.guild.id), JSON.stringify(this.state()), 'EX', 6 * 3600).catch(() => undefined);
    this.onChange();
  }
}
