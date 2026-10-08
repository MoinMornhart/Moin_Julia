import 'server-only';
import { GALAXYBOT_ID } from '@moin/shared';
import { appSettings, DISCORD_API } from './config';
import { DEMO_GUILD_ID } from './demo';
import { fetchGuildChannels, TEXT_CHANNEL_TYPES } from './discord';

/**
 * GalaxyBot-Übernahme: GalaxyBot hat keinen Export. Wir lesen deshalb, was er sichtbar in Discord
 * hinterlassen hat – seine AutoMod-Regeln und seine Nachrichten (Panels, Embeds).
 */

export interface GalaxyRule {
  id: string;
  name: string;
  kind: 'keywords' | 'mentions' | 'other';
  keywords: string[];
  mentionLimit: number | null;
}

export interface GalaxyMessage {
  channelId: string;
  channelName: string;
  messageId: string;
  title: string;
  description: string;
  color: number | null;
  /** Beschriftungen von Buttons/Auswahlmenüs (z. B. Ticket-Kategorien) */
  options: string[];
}

export interface GalaxyScan {
  rules: GalaxyRule[];
  messages: GalaxyMessage[];
  scannedChannels: number;
  galaxyPresent: boolean;
}

async function botGet<T>(route: string): Promise<T | null> {
  const token = (await appSettings()).discordToken;
  if (!token) return null;
  const res = await fetch(`${DISCORD_API}${route}`, { headers: { authorization: `Bot ${token}` } });
  if (res.status === 429) {
    const retry = Number((await res.json().catch(() => ({}))).retry_after ?? 1);
    await new Promise((r) => setTimeout(r, Math.min(5, retry) * 1000));
    return botGet<T>(route);
  }
  return res.ok ? ((await res.json()) as T) : null;
}

interface RawRule {
  id: string;
  name: string;
  creator_id: string;
  trigger_type: number;
  trigger_metadata: { keyword_filter?: string[]; mention_total_limit?: number };
}

interface RawMessage {
  id: string;
  author: { id: string };
  embeds: { title?: string; description?: string; color?: number }[];
  components?: { components?: { label?: string; options?: { label: string }[] }[] }[];
}

export async function scanGalaxy(guildId: string): Promise<GalaxyScan> {
  if (guildId === DEMO_GUILD_ID) return DEMO_SCAN;

  const member = await botGet<unknown>(`/guilds/${guildId}/members/${GALAXYBOT_ID}`);
  const rawRules = (await botGet<RawRule[]>(`/guilds/${guildId}/auto-moderation/rules`)) ?? [];
  const rules: GalaxyRule[] = rawRules
    .filter((r) => r.creator_id === GALAXYBOT_ID)
    .map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.trigger_type === 1 ? 'keywords' : r.trigger_type === 5 ? 'mentions' : 'other',
      keywords: r.trigger_metadata.keyword_filter ?? [],
      mentionLimit: r.trigger_metadata.mention_total_limit ?? null,
    }));

  const channels = (await fetchGuildChannels(guildId).catch(() => [])).filter((c) => TEXT_CHANNEL_TYPES.includes(c.type)).slice(0, 40);
  const messages: GalaxyMessage[] = [];
  for (const channel of channels) {
    const list = (await botGet<RawMessage[]>(`/channels/${channel.id}/messages?limit=50`)) ?? [];
    for (const m of list) {
      if (m.author.id !== GALAXYBOT_ID || !m.embeds.length) continue;
      const embed = m.embeds[0]!;
      messages.push({
        channelId: channel.id,
        channelName: channel.name,
        messageId: m.id,
        title: embed.title ?? '',
        description: (embed.description ?? '').slice(0, 1500),
        color: embed.color ?? null,
        options: (m.components ?? []).flatMap((row) => (row.components ?? []).flatMap((c) => (c.options ? c.options.map((o) => o.label) : c.label ? [c.label] : []))),
      });
      if (messages.length >= 30) break;
    }
    if (messages.length >= 30) break;
  }
  return { rules, messages, scannedChannels: channels.length, galaxyPresent: member !== null };
}

const DEMO_SCAN: GalaxyScan = {
  galaxyPresent: true,
  scannedChannels: 11,
  rules: [
    { id: '1', name: 'GalaxyBot Bad Words', kind: 'keywords', keywords: ['spamwort', 'beleidigung1', '*scam*'], mentionLimit: null },
    { id: '2', name: 'GalaxyBot Mention Spam', kind: 'mentions', keywords: [], mentionLimit: 6 },
  ],
  messages: [
    {
      channelId: '100000000000000021',
      channelName: 'support',
      messageId: '1',
      title: '🎫 Support-Ticket öffnen',
      description: 'Wähle unten eine Kategorie – das Team meldet sich so schnell wie möglich.',
      color: 0x5865f2,
      options: ['Allgemeine Frage', 'Bewerbung', 'Bug melden'],
    },
  ],
};
