import { Readable } from 'node:stream';
import { AudioPlayerStatus, createAudioPlayer, createAudioResource, entersState, getVoiceConnection, joinVoiceChannel, StreamType, VoiceConnectionStatus } from '@discordjs/voice';
import type { VoiceBasedChannel } from 'discord.js';
import { loadGuildSecrets, loadSettings } from '@moin/db';
import { synthesizeSpeech, VoiceError, type JuliaVoice, type VoiceFetch } from '@moin/shared';
import type { BotContext } from '../../core/types.js';

/**
 * Julia spricht (Issue #7): Text → Sprache (Piper/OpenAI/ElevenLabs) → kurz in den Sprachkanal, sprechen, wieder gehen.
 * Läuft im Server schon eine Sprachverbindung (z. B. Musik), spricht Julia nicht dazwischen.
 */
export type SpeakResult = 'spoken' | 'busy' | 'noVoice' | 'notConfigured' | 'failed';

/** Text → Audio mit den Schlüsseln/der Adresse dieses Servers bzw. der Instanz */
export async function synthesize(bot: BotContext, guildId: string, voice: JuliaVoice, text: string, f: VoiceFetch = fetch as unknown as VoiceFetch): Promise<Buffer> {
  const [settings, secrets] = await Promise.all([loadSettings(bot.prisma).catch(() => null), loadGuildSecrets(bot.prisma, guildId).catch(() => null)]);
  const { audio } = await synthesizeSpeech({ voice, text, ttsUrl: settings?.ttsUrl || process.env.TTS_URL, openaiKey: secrets?.openaiApiKey, elevenlabsKey: secrets?.elevenlabsApiKey }, f, () => AbortSignal.timeout(20_000));
  return Buffer.from(audio);
}

/** Audio im Sprachkanal abspielen, danach wieder gehen (höchstens 90 s) */
export async function playOnce(channel: VoiceBasedChannel, audio: Buffer): Promise<'spoken' | 'busy'> {
  if (getVoiceConnection(channel.guild.id)) return 'busy';
  const connection = joinVoiceChannel({ channelId: channel.id, guildId: channel.guild.id, adapterCreator: channel.guild.voiceAdapterCreator, selfDeaf: true, selfMute: false });
  const player = createAudioPlayer();
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    connection.subscribe(player);
    player.play(createAudioResource(Readable.from(audio), { inputType: StreamType.Arbitrary }));
    await entersState(player, AudioPlayerStatus.Playing, 15_000);
    await entersState(player, AudioPlayerStatus.Idle, 90_000);
    return 'spoken';
  } finally {
    player.stop(true);
    connection.destroy();
  }
}

/** Komplett: Text sprechen im Sprachkanal der Person */
export async function speak(bot: BotContext, guildId: string, channel: VoiceBasedChannel | null, voice: JuliaVoice, text: string, deps = { synthesize, playOnce }): Promise<SpeakResult> {
  if (!channel) return 'noVoice';
  if (getVoiceConnection(guildId)) return 'busy';
  try {
    const audio = await deps.synthesize(bot, guildId, voice, text);
    return await deps.playOnce(channel, audio);
  } catch (error) {
    bot.logger.warn({ err: error, guildId }, 'Julia: Sprechen fehlgeschlagen');
    return error instanceof VoiceError && error.kind === 'notConfigured' ? 'notConfigured' : 'failed';
  }
}
