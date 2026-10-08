import 'server-only';
import { GALAXYBOT_ID, GALAXYBOT_IDS } from '@moin/shared';
import { appSettings, DISCORD_API } from './config';
import { DEMO_GUILD_ID } from './demo';
import { fetchGuildChannels, TEXT_CHANNEL_TYPES } from './discord';

/**
 * GalaxyBot-Übernahme: GalaxyBot hat keinen Export. Wir lesen deshalb, was er sichtbar in Discord
 * hinterlassen hat – seine AutoMod-Regeln und seine Nachrichten (Panels, Embeds).
 * Welcher Bot es war, wählt man aus: GalaxyBot-Instanzen mit eigenem Branding haben eine eigene ID
 * und einen eigenen Namen (bei Philip so) – die feste GalaxyBot-ID allein reicht nicht.
 */

export interface BotCandidate {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** noch auf dem Server (sonst nur über seine AutoMod-Regeln gefunden) */
  present: boolean;
  /** Zahl der AutoMod-Regeln, die dieser Bot angelegt hat */
  rules: number;
  likelyGalaxy: boolean;
}

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
  /** gewählter Bot ist noch auf dem Server */
  botPresent: boolean;
  botName: string;
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

const avatarOf = (u: { id: string; avatar: string | null }) => (u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64` : null);

/** Bots, die als alter Bot infrage kommen: Bots auf dem Server + Ersteller von AutoMod-Regeln. */
export async function listBotCandidates(guildId: string): Promise<BotCandidate[]> {
  if (guildId === DEMO_GUILD_ID) return DEMO_CANDIDATES;
  const me = await botGet<{ id: string }>('/users/@me');
  const rules = (await botGet<RawRule[]>(`/guilds/${guildId}/auto-moderation/rules`)) ?? [];
  const ruleCount = new Map<string, number>();
  for (const r of rules) ruleCount.set(r.creator_id, (ruleCount.get(r.creator_id) ?? 0) + 1);

  type RawUser = { id: string; username: string; global_name?: string | null; avatar: string | null; bot?: boolean };
  const found = new Map<string, BotCandidate>();
  const add = (u: RawUser, present: boolean, nick?: string | null) => {
    if (!u.bot || u.id === me?.id) return;
    const name = nick || u.global_name || u.username;
    found.set(u.id, { id: u.id, name, avatarUrl: avatarOf(u), present, rules: ruleCount.get(u.id) ?? 0, likelyGalaxy: (GALAXYBOT_IDS as readonly string[]).includes(u.id) || /galaxy/i.test(`${u.username} ${name}`) });
  };
  // Mitgliederliste braucht den „Server Members“-Intent (ist für den Bot ohnehin nötig)
  const members = (await botGet<{ user: RawUser; nick?: string | null }[]>(`/guilds/${guildId}/members?limit=1000`)) ?? [];
  for (const m of members) add(m.user, true, m.nick);
  for (const creator of ruleCount.keys()) {
    if (found.has(creator) || creator === me?.id) continue;
    const user = await botGet<RawUser>(`/users/${creator}`);
    if (user) add(user, false);
  }
  return [...found.values()].sort((a, b) => Number(b.likelyGalaxy) - Number(a.likelyGalaxy) || b.rules - a.rules || a.name.localeCompare(b.name));
}

export async function scanGalaxy(guildId: string, botId: string = GALAXYBOT_ID): Promise<GalaxyScan> {
  if (guildId === DEMO_GUILD_ID) return { ...DEMO_SCAN, botName: DEMO_CANDIDATES.find((c) => c.id === botId)?.name ?? 'Bot' };

  const member = await botGet<{ nick?: string | null; user: { username: string } }>(`/guilds/${guildId}/members/${botId}`);
  const user = member?.user ?? (await botGet<{ username: string }>(`/users/${botId}`));
  const rawRules = (await botGet<RawRule[]>(`/guilds/${guildId}/auto-moderation/rules`)) ?? [];
  const rules: GalaxyRule[] = rawRules
    .filter((r) => r.creator_id === botId)
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
      if (m.author.id !== botId || !m.embeds.length) continue;
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
  return { rules, messages, scannedChannels: channels.length, botPresent: member !== null, botName: member?.nick || user?.username || botId };
}

const DEMO_CANDIDATES: BotCandidate[] = [
  { id: '100000000000000801', name: 'Moin Helfer', avatarUrl: null, present: true, rules: 2, likelyGalaxy: false },
  { id: '100000000000000802', name: 'Musik-Bot', avatarUrl: null, present: true, rules: 0, likelyGalaxy: false },
];

const DEMO_SCAN: GalaxyScan = {
  botPresent: true,
  botName: 'Moin Helfer',
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
