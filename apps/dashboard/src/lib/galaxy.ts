import 'server-only';
import { GALAXYBOT_ID, GALAXYBOT_IDS, parseAutomodRule, parseBotMessage, type RawAutomodRule, type RawBotMessage, type ScannedRule } from '@moin/shared';
import { appSettings, DISCORD_API } from './config';
import { DEMO_GUILD_ID } from './demo';
import { fetchGuildChannels, TEXT_CHANNEL_TYPES } from './discord';

/**
 * GalaxyBot-Übernahme: GalaxyBot hat keinen Export. Wir lesen deshalb, was er sichtbar in Discord
 * hinterlassen hat – seine AutoMod-Regeln und seine Nachrichten (Panels, Embeds, Components V2).
 * Welcher Bot es war, wählt man aus: GalaxyBot-Instanzen mit eigenem Branding haben eine eigene ID
 * und einen eigenen Namen (bei Philip so) – die feste GalaxyBot-ID allein reicht nicht.
 */

/** Höchstens so viele Kanäle/Nachrichten durchsuchen (große Server: Discord-Limits beachten) */
const MAX_CHANNELS = 150;
const MAX_MESSAGES = 60;
const PARALLEL = 4;

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

export type GalaxyRule = ScannedRule;

export interface GalaxyMessage {
  channelId: string;
  channelName: string;
  messageId: string;
  title: string;
  description: string;
  color: number | null;
  /** Beschriftungen von Buttons/Auswahlmenüs (z. B. Ticket-Kategorien) */
  options: string[];
  componentsV2: boolean;
}

export interface GalaxyScan {
  rules: GalaxyRule[];
  messages: GalaxyMessage[];
  scannedChannels: number;
  /** Kanäle, die der Bot nicht lesen durfte */
  unreadableChannels: number;
  /** es gab mehr Kanäle als durchsucht */
  truncated: boolean;
  /** gewählter Bot ist noch auf dem Server */
  botPresent: boolean;
  botName: string;
}

async function botGet<T>(route: string, attempt = 0): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  const token = (await appSettings()).discordToken;
  if (!token) return { ok: false, status: 401 };
  const res = await fetch(`${DISCORD_API}${route}`, { headers: { authorization: `Bot ${token}` }, cache: 'no-store' });
  if (res.status === 429 && attempt < 5) {
    const retry = Number((await res.json().catch(() => ({}))).retry_after ?? 1);
    await new Promise((r) => setTimeout(r, Math.min(5, retry) * 1000 + 50));
    return botGet<T>(route, attempt + 1);
  }
  return res.ok ? { ok: true, data: (await res.json()) as T } : { ok: false, status: res.status };
}

async function get<T>(route: string): Promise<T | null> {
  const r = await botGet<T>(route);
  return r.ok ? r.data : null;
}

const avatarOf = (u: { id: string; avatar: string | null }) => (u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64` : null);

type RawUser = { id: string; username: string; global_name?: string | null; avatar: string | null; bot?: boolean };

/** Alle Mitglieder seitenweise (je 1000), höchstens 20 Seiten – große Server haben mehr als 1000 */
async function allMembers(guildId: string): Promise<{ user: RawUser; nick?: string | null }[]> {
  const out: { user: RawUser; nick?: string | null }[] = [];
  let after = '0';
  for (let page = 0; page < 20; page++) {
    const batch = await get<{ user: RawUser; nick?: string | null }[]>(`/guilds/${guildId}/members?limit=1000&after=${after}`);
    if (!batch?.length) break;
    out.push(...batch);
    if (batch.length < 1000) break;
    after = batch.at(-1)!.user.id;
  }
  return out;
}

/** Bots, die als alter Bot infrage kommen: Bots auf dem Server + Ersteller von AutoMod-Regeln. */
export async function listBotCandidates(guildId: string): Promise<BotCandidate[]> {
  if (guildId === DEMO_GUILD_ID) return DEMO_CANDIDATES;
  const me = await get<{ id: string }>('/users/@me');
  const rules = (await get<RawAutomodRule[]>(`/guilds/${guildId}/auto-moderation/rules`)) ?? [];
  const ruleCount = new Map<string, number>();
  for (const r of rules) ruleCount.set(r.creator_id, (ruleCount.get(r.creator_id) ?? 0) + 1);

  const found = new Map<string, BotCandidate>();
  const add = (u: RawUser, present: boolean, nick?: string | null) => {
    if (!u.bot || u.id === me?.id) return;
    const name = nick || u.global_name || u.username;
    found.set(u.id, { id: u.id, name, avatarUrl: avatarOf(u), present, rules: ruleCount.get(u.id) ?? 0, likelyGalaxy: (GALAXYBOT_IDS as readonly string[]).includes(u.id) || /galaxy/i.test(`${u.username} ${name}`) });
  };
  // Mitgliederliste braucht den „Server Members“-Intent (ist für den Bot ohnehin nötig)
  for (const m of await allMembers(guildId)) add(m.user, true, m.nick);
  for (const creator of ruleCount.keys()) {
    if (found.has(creator) || creator === me?.id) continue;
    const user = await get<RawUser>(`/users/${creator}`);
    if (user) add(user, false);
  }
  return [...found.values()].sort((a, b) => Number(b.likelyGalaxy) - Number(a.likelyGalaxy) || b.rules - a.rules || a.name.localeCompare(b.name));
}

/** Kleine Parallelisierung: mehrere Kanäle gleichzeitig, aber nicht alle (Discord-Limits) */
async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]!);
      }
    }),
  );
  return results;
}

export async function scanGalaxy(guildId: string, botId: string = GALAXYBOT_ID): Promise<GalaxyScan> {
  if (guildId === DEMO_GUILD_ID) return { ...DEMO_SCAN, botName: DEMO_CANDIDATES.find((c) => c.id === botId)?.name ?? 'Bot' };

  const member = await get<{ nick?: string | null; user: { username: string } }>(`/guilds/${guildId}/members/${botId}`);
  const user = member?.user ?? (await get<{ username: string }>(`/users/${botId}`));
  const rawRules = (await get<RawAutomodRule[]>(`/guilds/${guildId}/auto-moderation/rules`)) ?? [];
  const rules = rawRules.filter((r) => r.creator_id === botId).map(parseAutomodRule);

  const allChannels = (await fetchGuildChannels(guildId).catch(() => [])).filter((c) => TEXT_CHANNEL_TYPES.includes(c.type));
  const channels = allChannels.slice(0, MAX_CHANNELS);
  let unreadable = 0;
  const perChannel = await mapLimited(channels, PARALLEL, async (channel) => {
    const r = await botGet<(RawBotMessage & { id: string; author: { id: string } })[]>(`/channels/${channel.id}/messages?limit=100`);
    if (!r.ok) {
      if (r.status === 403) unreadable++;
      return [] as GalaxyMessage[];
    }
    return r.data
      .filter((m) => m.author.id === botId)
      .map((m) => {
        const parsed = parseBotMessage(m);
        return parsed ? { channelId: channel.id, channelName: channel.name, messageId: m.id, ...parsed } : null;
      })
      .filter((m): m is GalaxyMessage => m !== null);
  });
  const messages = perChannel.flat().slice(0, MAX_MESSAGES);
  return {
    rules,
    messages,
    scannedChannels: channels.length,
    unreadableChannels: unreadable,
    truncated: allChannels.length > channels.length,
    botPresent: member !== null,
    botName: member?.nick || user?.username || botId,
  };
}

const DEMO_CANDIDATES: BotCandidate[] = [
  { id: '100000000000000801', name: 'Moin Helfer', avatarUrl: null, present: true, rules: 2, likelyGalaxy: false },
  { id: '100000000000000802', name: 'Musik-Bot', avatarUrl: null, present: true, rules: 0, likelyGalaxy: false },
];

const DEMO_SCAN: GalaxyScan = {
  botPresent: true,
  botName: 'Moin Helfer',
  scannedChannels: 11,
  unreadableChannels: 1,
  truncated: false,
  rules: [
    parseAutomodRule({ id: '1', name: 'GalaxyBot Bad Words', creator_id: '100000000000000801', trigger_type: 1, trigger_metadata: { keyword_filter: ['spamwort', 'beleidigung1', '*scam*'], allow_list: ['scampi'] } }),
    parseAutomodRule({ id: '2', name: 'GalaxyBot Mention Spam', creator_id: '100000000000000801', trigger_type: 5, trigger_metadata: { mention_total_limit: 6 } }),
    parseAutomodRule({ id: '3', name: 'GalaxyBot Links', creator_id: '100000000000000801', trigger_type: 1, trigger_metadata: { regex_patterns: ['https?://\\S+'] } }),
    parseAutomodRule({ id: '4', name: 'GalaxyBot Spam', creator_id: '100000000000000801', trigger_type: 3 }),
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
      componentsV2: false,
    },
    {
      channelId: '100000000000000022',
      channelName: 'ankündigungen',
      messageId: '2',
      title: 'Rollen',
      description: 'Hol dir deine Rollen über die Knöpfe.',
      color: 0xff7a59,
      options: ['Gamer', 'Künstler:in'],
      componentsV2: true,
    },
  ],
};
