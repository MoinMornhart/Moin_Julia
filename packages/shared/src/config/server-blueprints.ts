import { normalizeWords, rankByName } from '../fuzzy.js';
import { PERM } from './permissions-check.js';

/**
 * Server-Profile (Issue #5): fertige Baupläne für einen ganzen Discord-Server – Rollen, Kategorien,
 * Kanäle mit passenden Rechten und Modul-Einstellungen. Beim Aktivieren wird vorher gesichert;
 * beim Deaktivieren kommt die Sicherung zurück (auf Wunsch werden die angelegten Kanäle/Rollen gelöscht).
 * Vorhandene Rollen/Kanäle mit gleichem Namen werden wiederverwendet, nie verändert oder gelöscht.
 */
export type RoleKind = 'mod' | 'member' | 'ping';
export interface BlueprintRole {
  key: string;
  name: string;
  color: number;
  kind: RoleKind;
  /** Eigener Rang aus dem Dashboard (Wunsch Philip, 14.10.): feste Rechte statt „kind“ */
  permissions?: string;
  hoist?: boolean;
  mentionable?: boolean;
  /** ID des eigenen Rangs (Tabelle BlueprintRank) */
  rankId?: string;
}

/** Eigener Rang, der einer Vorlage hinzugefügt wurde */
export interface ExtraRank {
  id: string;
  blueprintId: string;
  name: string;
  color: number;
  permissions: string;
  hoist: boolean;
  mentionable: boolean;
}

const ADMIN_BIT = 1n << 3n;

/** Vorlage + eigene Ränge (gleichnamige Bauplan-Rollen gewinnen; nie Administrator) */
export function withExtraRanks(blueprint: ServerBlueprint, ranks: readonly ExtraRank[]): ServerBlueprint {
  const names = new Set(blueprint.roles.map((r) => r.name.trim().toLowerCase()));
  const extra: BlueprintRole[] = [];
  for (const r of ranks) {
    if (r.blueprintId !== blueprint.id || names.has(r.name.trim().toLowerCase())) continue;
    names.add(r.name.trim().toLowerCase());
    extra.push({ key: `rank:${r.id}`, name: r.name, color: r.color, kind: 'member', permissions: (BigInt(r.permissions) & ~ADMIN_BIT).toString(), hoist: r.hoist, mentionable: r.mentionable, rankId: r.id });
  }
  return { ...blueprint, roles: [...blueprint.roles, ...extra] };
}

/** So wird eine Bauplan-Rolle angelegt (Discord-API) */
export function blueprintRoleBody(role: BlueprintRole): { name: string; color: number; permissions: string; hoist: boolean; mentionable: boolean } {
  if (role.permissions !== undefined) return { name: role.name, color: role.color, permissions: (BigInt(role.permissions) & ~ADMIN_BIT).toString(), hoist: !!role.hoist, mentionable: !!role.mentionable };
  return { name: role.name, color: role.color, permissions: role.kind === 'mod' ? MOD_PERMISSIONS.toString() : '0', hoist: role.kind === 'mod', mentionable: role.kind === 'ping' };
}

/** Muss eine vom Profil angelegte Rolle an den (geänderten) Rang angepasst werden? */
export function roleNeedsUpdate(current: { color: number; permissions: string; hoist: boolean; mentionable: boolean }, wanted: ReturnType<typeof blueprintRoleBody>): boolean {
  return current.color !== wanted.color || current.permissions !== wanted.permissions || current.hoist !== wanted.hoist || current.mentionable !== wanted.mentionable;
}
/** all = alle schreiben, readonly = alle lesen/nur Team schreibt, team = nur Team sieht es */
export type ChannelAccess = 'all' | 'readonly' | 'team';
export interface BlueprintChannel {
  key: string;
  name: string;
  type: 'text' | 'voice';
  access?: ChannelAccess;
  topic?: string;
}
export interface BlueprintCategory {
  key: string;
  name: string;
  access?: ChannelAccess;
  channels: BlueprintChannel[];
}
/** Modul-Einstellungen in Abhängigkeit von den (angelegten oder gefundenen) IDs */
export type BlueprintModules = Record<string, (ids: Record<string, string>) => Record<string, unknown>>;
export interface ServerBlueprint {
  id: string;
  icon: string;
  name: string;
  description: string;
  roles: BlueprintRole[];
  categories: BlueprintCategory[];
  modules: BlueprintModules;
}

/** Rechte der Team-Rolle: moderieren, aber nie Administrator, Server/Rollen verwalten */
export const MOD_PERMISSIONS =
  PERM.KickMembers | PERM.BanMembers | PERM.ModerateMembers | PERM.ManageMessages | PERM.ManageNicknames | (1n << 7n) /* Audit-Log */ | (1n << 22n) /* Stummschalten */ | (1n << 24n); /* Verschieben */

const common = {
  logs: (ids: Record<string, string>) => ({
    logging: { defaultChannelId: ids.modlog },
    moderation: { modLogChannelId: ids.modlog },
    schutz: { alertChannelId: ids.modlog },
  }),
};

export const SERVER_BLUEPRINTS: ServerBlueprint[] = [
  {
    id: 'streamer',
    icon: '📺',
    name: 'Streamer-Community',
    description: 'Für Twitch/YouTube: Info-Kanäle, Live-Meldungen, Community-Chat, Julia-Chat, eigene Sprachkanäle und ein Team-Bereich.',
    roles: [
      { key: 'mod', name: 'Moderator', color: 0x2fd1b8, kind: 'mod' },
      { key: 'sub', name: 'Subscriber', color: 0x9b8cff, kind: 'member' },
      { key: 'liveping', name: 'Live-Ping', color: 0xff7a59, kind: 'ping' },
    ],
    categories: [
      {
        key: 'info',
        name: '📌 Info',
        channels: [
          { key: 'regeln', name: 'regeln', type: 'text', access: 'readonly', topic: 'Bitte lesen 🙏' },
          { key: 'news', name: 'ankündigungen', type: 'text', access: 'readonly' },
          { key: 'live', name: 'live-meldungen', type: 'text', access: 'readonly' },
        ],
      },
      {
        key: 'community',
        name: '💬 Community',
        channels: [
          { key: 'chat', name: 'allgemein', type: 'text' },
          { key: 'clips', name: 'clips', type: 'text' },
          { key: 'julia', name: 'julia-chat', type: 'text', topic: 'Hier antwortet Julia auf jede Nachricht' },
          { key: 'lounge', name: 'Lounge', type: 'voice' },
          { key: 'hub', name: '➕ Kanal erstellen', type: 'voice' },
        ],
      },
      {
        key: 'team',
        name: '🛡️ Team',
        access: 'team',
        channels: [
          { key: 'teamchat', name: 'team-chat', type: 'text' },
          { key: 'modlog', name: 'mod-log', type: 'text' },
        ],
      },
    ],
    modules: {
      logging: (ids) => common.logs(ids).logging,
      moderation: (ids) => common.logs(ids).moderation,
      schutz: (ids) => common.logs(ids).schutz,
      willkommen: (ids) => ({ welcome: { enabled: true, channelId: ids.chat } }),
      julia: (ids) => ({ chatChannelIds: [ids.julia] }),
      tempvoice: (ids) => ({ hubs: [{ channelId: ids.hub, categoryId: ids['cat:community'] }] }),
    },
  },
  {
    id: 'gaming',
    icon: '🎮',
    name: 'Gaming-Clan',
    description: 'Für Clans und Teams: Regeln, Termine, Screenshots, mehrere Zock-Kanäle und ein Bereich für die Leitung.',
    roles: [
      { key: 'mod', name: 'Leitung', color: 0xff7a59, kind: 'mod' },
      { key: 'member', name: 'Mitglied', color: 0x2fd1b8, kind: 'member' },
      { key: 'guest', name: 'Gast', color: 0x8c96ba, kind: 'member' },
    ],
    categories: [
      {
        key: 'info',
        name: '📌 Info',
        channels: [
          { key: 'regeln', name: 'regeln', type: 'text', access: 'readonly' },
          { key: 'termine', name: 'termine', type: 'text', access: 'readonly' },
        ],
      },
      {
        key: 'clan',
        name: '🎮 Clan',
        channels: [
          { key: 'chat', name: 'allgemein', type: 'text' },
          { key: 'shots', name: 'screenshots', type: 'text' },
          { key: 'z1', name: 'Zocken 1', type: 'voice' },
          { key: 'z2', name: 'Zocken 2', type: 'voice' },
          { key: 'hub', name: '➕ Kanal erstellen', type: 'voice' },
        ],
      },
      {
        key: 'lead',
        name: '🛡️ Leitung',
        access: 'team',
        channels: [
          { key: 'teamchat', name: 'leitung', type: 'text' },
          { key: 'modlog', name: 'mod-log', type: 'text' },
        ],
      },
    ],
    modules: {
      logging: (ids) => common.logs(ids).logging,
      moderation: (ids) => common.logs(ids).moderation,
      schutz: (ids) => common.logs(ids).schutz,
      willkommen: (ids) => ({ welcome: { enabled: true, channelId: ids.chat } }),
      tempvoice: (ids) => ({ hubs: [{ channelId: ids.hub, categoryId: ids['cat:clan'] }] }),
    },
  },
  {
    id: 'freunde',
    icon: '🍻',
    name: 'Freundeskreis',
    description: 'Klein und gemütlich: ein Chat, Bilder, Julia zum Quatschen und Sprachkanäle – ohne viel Verwaltung.',
    roles: [{ key: 'mod', name: 'Orga', color: 0xffc857, kind: 'mod' }],
    categories: [
      {
        key: 'main',
        name: '🏠 Treffpunkt',
        channels: [
          { key: 'chat', name: 'chat', type: 'text' },
          { key: 'bilder', name: 'bilder', type: 'text' },
          { key: 'julia', name: 'julia', type: 'text', topic: 'Quatsch mit Julia' },
          { key: 'voice', name: 'Quatschen', type: 'voice' },
          { key: 'hub', name: '➕ Kanal erstellen', type: 'voice' },
        ],
      },
      { key: 'orga', name: '🔒 Orga', access: 'team', channels: [{ key: 'modlog', name: 'log', type: 'text' }] },
    ],
    modules: {
      logging: (ids) => common.logs(ids).logging,
      julia: (ids) => ({ chatChannelIds: [ids.julia] }),
      tempvoice: (ids) => ({ hubs: [{ channelId: ids.hub, categoryId: ids['cat:main'] }] }),
    },
  },
];

export function getBlueprint(id: string): ServerBlueprint | undefined {
  return SERVER_BLUEPRINTS.find((b) => b.id === id);
}

/** Rechte-Ausnahmen (permission_overwrites) für einen Kanal/eine Kategorie */
export function blueprintOverwrites(access: ChannelAccess | undefined, everyoneId: string, modRoleIds: readonly string[], botId: string | null): { id: string; type: 0 | 1; allow: string; deny: string }[] {
  const view = PERM.ViewChannel;
  const send = PERM.SendMessages | PERM.SendMessagesInThreads | PERM.CreatePublicThreads | PERM.CreatePrivateThreads;
  const bot = botId ? [{ id: botId, type: 1 as const, allow: (view | send).toString(), deny: '0' }] : [];
  if (access === 'team') {
    return [{ id: everyoneId, type: 0, allow: '0', deny: view.toString() }, ...modRoleIds.map((id) => ({ id, type: 0 as const, allow: (view | send).toString(), deny: '0' })), ...bot];
  }
  if (access === 'readonly') {
    return [{ id: everyoneId, type: 0, allow: '0', deny: send.toString() }, ...modRoleIds.map((id) => ({ id, type: 0 as const, allow: send.toString(), deny: '0' })), ...bot];
  }
  return [];
}

/** Modul-Einstellungen des Bauplans – nur Module, deren Kanäle alle vorhanden sind */
export function blueprintModuleConfigs(blueprint: ServerBlueprint, ids: Record<string, string>): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [moduleId, build] of Object.entries(blueprint.modules)) {
    const config = build(ids);
    if (containsUndefined(config)) continue;
    out[moduleId] = config;
  }
  return out;
}

function containsUndefined(value: unknown): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.some(containsUndefined);
  if (value && typeof value === 'object') return Object.values(value).some(containsUndefined);
  return false;
}

/** Tiefes Zusammenführen: Bauplan-Werte über die vorhandenen Einstellungen (Arrays werden ersetzt) */
export function mergeConfig(base: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = base && typeof base === 'object' && !Array.isArray(base) ? { ...(base as Record<string, unknown>) } : {};
  for (const [k, v] of Object.entries(patch)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? mergeConfig(out[k], v as Record<string, unknown>) : v;
  }
  return out;
}

// ── Vorhandenes übernehmen (Issue #7) ───────────────────────────────────────

export type BlueprintItemKind = 'role' | 'category' | 'text' | 'voice';
export interface ExistingThing {
  id: string;
  name: string;
  /** Discord-Kanaltyp (Rollen: weglassen) */
  type?: number;
}
export interface ProfileAnalysisItem {
  key: string;
  kind: BlueprintItemKind;
  name: string;
  /** Bester Treffer (genau oder ähnlich) – null = neu anlegen */
  match: { id: string; name: string; exact: boolean } | null;
  /** Alle passenden vorhandenen Dinge zur Auswahl */
  options: { id: string; name: string }[];
}

const plain = (s: string) => normalizeWords(s).join(' ');
const KIND_TYPES: Record<Exclude<BlueprintItemKind, 'role'>, number[]> = { category: [4], text: [0, 5, 15], voice: [2, 13] };

/** Vorhandenes zu einem Namen finden: gleich (ohne Emojis/Groß-klein) → ähnlich (Tippfehler, gleiche Wörter) */
export function bestMatch(name: string, candidates: readonly ExistingThing[]): { id: string; name: string; exact: boolean } | null {
  const want = plain(name);
  const exact = candidates.find((c) => plain(c.name) === want);
  if (exact) return { id: exact.id, name: exact.name, exact: true };
  const [similar] = rankByName(name, candidates, (c) => c.name, 0.75);
  if (similar) return { id: similar.id, name: similar.name, exact: false };
  return null;
}

/** Was gibt es im Server schon? Pro Rolle/Kategorie/Kanal des Bauplans: bester Treffer + Auswahl */
export function analyzeBlueprint(blueprint: ServerBlueprint, roles: readonly ExistingThing[], channels: readonly ExistingThing[]): ProfileAnalysisItem[] {
  const out: ProfileAnalysisItem[] = [];
  for (const r of blueprint.roles) out.push({ key: r.key, kind: 'role', name: r.name, match: bestMatch(r.name, roles), options: roles.map(({ id, name }) => ({ id, name })) });
  for (const c of blueprint.categories) {
    const cats = channels.filter((x) => KIND_TYPES.category.includes(x.type ?? -1));
    out.push({ key: `cat:${c.key}`, kind: 'category', name: c.name, match: bestMatch(c.name, cats), options: cats.map(({ id, name }) => ({ id, name })) });
    for (const ch of c.channels) {
      const kind = ch.type === 'voice' ? 'voice' : 'text';
      const pool = channels.filter((x) => KIND_TYPES[kind].includes(x.type ?? -1));
      out.push({ key: ch.key, kind, name: ch.name, match: bestMatch(ch.name, pool), options: pool.map(({ id, name }) => ({ id, name })) });
    }
  }
  return out;
}
