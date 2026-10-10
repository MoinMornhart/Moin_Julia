import { z } from 'zod';
import { parseLoggingConfig, loggingConfigSchema } from './logging.js';
import { parseModerationConfig, moderationConfigSchema } from './moderation.js';
import { parseSchutzConfig, schutzConfigSchema } from './schutz.js';
import { parseWillkommenConfig, willkommenConfigSchema } from './willkommen.js';
import { parseTempVoiceConfig, tempVoiceConfigSchema } from './tempvoice.js';
import { parseTicketsConfig, ticketsConfigSchema } from './tickets.js';
import { parseTeamConfig, teamConfigSchema } from './team.js';
import { parseAlertsConfig, alertsConfigSchema } from './alerts.js';
import { parseLevelConfig, levelConfigSchema } from './level.js';
import { parseCommunityConfig, communityConfigSchema } from './community.js';
import { parseJuliaConfig, juliaConfigSchema } from './julia.js';
import { parseStatsConfig, statsConfigSchema } from './stats.js';
import { parseMusicConfig, musicConfigSchema } from './music.js';

/**
 * Vorlagen: Bot-Einstellungen eines Servers als Datei exportieren und auf einem anderen
 * Server importieren. Kanal- und Rollen-IDs werden mit Namen gespeichert und beim Import
 * per Name neu zugeordnet.
 */

export const TEMPLATE_FORMAT = 'moin-julia-vorlage';
export const TEMPLATE_VERSION = 1;

const SNOWFLAKE = /^\d{15,22}$/;

/** Module mit eigenem Schema – beim Import wird ihre Konfiguration geprüft und vervollständigt */
export const MODULE_CONFIG_PARSERS: Record<string, (raw: unknown) => unknown> = {
  logging: parseLoggingConfig,
  moderation: parseModerationConfig,
  schutz: parseSchutzConfig,
  willkommen: parseWillkommenConfig,
  tempvoice: parseTempVoiceConfig,
  tickets: parseTicketsConfig,
  team: parseTeamConfig,
  alerts: parseAlertsConfig,
  level: parseLevelConfig,
  community: parseCommunityConfig,
  julia: parseJuliaConfig,
  statistiken: parseStatsConfig,
  musik: parseMusicConfig,
};

/** Schemas der Module – damit der Import Fehler gezielt reparieren kann, statt alles auf Standard zu setzen */
export const MODULE_CONFIG_SCHEMAS: Record<string, z.ZodType> = {
  logging: loggingConfigSchema,
  moderation: moderationConfigSchema,
  schutz: schutzConfigSchema,
  willkommen: willkommenConfigSchema,
  tempvoice: tempVoiceConfigSchema,
  tickets: ticketsConfigSchema,
  team: teamConfigSchema,
  alerts: alertsConfigSchema,
  level: levelConfigSchema,
  community: communityConfigSchema,
  julia: juliaConfigSchema,
  statistiken: statsConfigSchema,
  musik: musicConfigSchema,
};

const refSchema = z.object({ name: z.string(), type: z.number().optional() });

export const templateFileSchema = z.object({
  format: z.literal(TEMPLATE_FORMAT),
  version: z.number().int().min(1).max(TEMPLATE_VERSION),
  createdAt: z.string(),
  source: z.object({ appVersion: z.string(), guildName: z.string() }),
  guild: z.object({ locale: z.enum(['de', 'en']).default('de') }).prefault({}),
  modules: z.record(z.string(), z.object({ enabled: z.boolean(), config: z.unknown() })),
  rolePanels: z.array(z.object({ name: z.string(), channelId: z.string().nullable(), data: z.unknown() })).default([]),
  refs: z.object({
    channels: z.record(z.string(), refSchema).default({}),
    roles: z.record(z.string(), refSchema).default({}),
  }),
});

export type TemplateFile = z.infer<typeof templateFileSchema>;

export interface NamedRef {
  id: string;
  name: string;
  type?: number;
}

/** Alle Snowflake-Strings in einem verschachtelten Objekt (Kanäle, Rollen, Nutzer …). */
export function collectSnowflakes(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (SNOWFLAKE.test(value)) out.add(value);
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectSnowflakes(v, out));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => collectSnowflakes(v, out));
  }
  return out;
}

/**
 * Ersetzt Snowflakes laut Zuordnung. Wert `null` = weglassen: in Listen wird der Eintrag entfernt,
 * sonst wird das Feld leer ('' = „nicht gesetzt“ in allen Modul-Schemas). IDs, die nicht in der Zuordnung
 * stehen (z. B. User-IDs), bleiben.
 */
export function replaceSnowflakes(value: unknown, map: Map<string, string | null>): unknown {
  if (typeof value === 'string') return SNOWFLAKE.test(value) && map.has(value) ? (map.get(value) ?? '') : value;
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' && SNOWFLAKE.test(v) && map.has(v) && map.get(v) === null ? undefined : replaceSnowflakes(v, map)))
      .filter((v) => v !== undefined);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceSnowflakes(v, map)]));
  }
  return value;
}

/** Vorlage aus den Daten eines Servers bauen. Nur Kanäle/Rollen, die wirklich vorkommen, landen in refs. */
export function buildTemplate(input: {
  appVersion: string;
  guildName: string;
  locale: 'de' | 'en';
  modules: Record<string, { enabled: boolean; config: unknown }>;
  rolePanels: { name: string; channelId: string | null; data: unknown }[];
  channels: NamedRef[];
  roles: NamedRef[];
  now?: Date;
}): TemplateFile {
  const used = collectSnowflakes({ m: input.modules, p: input.rolePanels });
  const channels = Object.fromEntries(input.channels.filter((c) => used.has(c.id)).map((c) => [c.id, { name: c.name, type: c.type }]));
  const roles = Object.fromEntries(input.roles.filter((r) => used.has(r.id)).map((r) => [r.id, { name: r.name }]));
  return {
    format: TEMPLATE_FORMAT,
    version: TEMPLATE_VERSION,
    createdAt: (input.now ?? new Date()).toISOString(),
    source: { appVersion: input.appVersion, guildName: input.guildName },
    guild: { locale: input.locale },
    modules: input.modules,
    rolePanels: input.rolePanels,
    refs: { channels, roles },
  };
}

export type MatchKind = 'channel' | 'role';

export interface RefMatch {
  sourceId: string;
  kind: MatchKind;
  name: string;
  /** Vorschlag im Ziel-Server (gleicher Name, bei Kanälen bevorzugt gleiche Art) oder null */
  targetId: string | null;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, '-');

/** Kanäle und Rollen der Vorlage per Name im Ziel-Server suchen. */
export function matchRefs(template: TemplateFile, target: { channels: NamedRef[]; roles: NamedRef[] }): RefMatch[] {
  const matches: RefMatch[] = [];
  for (const [id, ref] of Object.entries(template.refs.channels)) {
    const sameName = target.channels.filter((c) => norm(c.name) === norm(ref.name));
    const best = sameName.find((c) => c.type === ref.type) ?? sameName[0];
    matches.push({ sourceId: id, kind: 'channel', name: ref.name, targetId: best?.id ?? null });
  }
  for (const [id, ref] of Object.entries(template.refs.roles)) {
    const best = target.roles.find((r) => norm(r.name) === norm(ref.name));
    matches.push({ sourceId: id, kind: 'role', name: ref.name, targetId: best?.id ?? null });
  }
  return matches;
}

export type RemapResult = { ok: true; config: unknown; dropped: number } | { ok: false; error: string };

/**
 * Konfiguration eines Moduls mit neuer Zuordnung übertragen und mit dem Modul-Schema prüfen.
 * Passt etwas nicht (z. B. ein Kanal fehlt im Ziel-Server), wird nur genau dieser Teil entfernt –
 * ein Listeneintrag fliegt raus, ein einzelnes Feld fällt auf seinen Standard zurück. Früher wurde in so
 * einem Fall still die GANZE Modul-Konfiguration auf Standard gesetzt.
 */
export function remapModuleConfig(moduleId: string, config: unknown, map: Map<string, string | null>): RemapResult {
  const replaced = replaceSnowflakes(config, map);
  const schema = MODULE_CONFIG_SCHEMAS[moduleId];
  if (!schema) return { ok: true, config: replaced, dropped: 0 };
  let current: unknown = structuredCloneJson(replaced);
  let dropped = 0;
  for (let round = 0; round < 50; round++) {
    const parsed = schema.safeParse(current);
    if (parsed.success) return { ok: true, config: parsed.data, dropped };
    const issue = parsed.error.issues[0]!;
    if (!removeAtIssue(current, issue.path)) return { ok: false, error: `${moduleId}: ${issue.path.join('.')} – ${issue.message}` };
    dropped++;
  }
  return { ok: false, error: `${moduleId}: zu viele ungültige Einträge` };
}

function structuredCloneJson<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

/** Den fehlerhaften Teil entfernen: den tiefsten Listeneintrag auf dem Pfad, sonst das Feld selbst */
function removeAtIssue(root: unknown, path: readonly PropertyKey[]): boolean {
  const nodes: unknown[] = [root];
  for (const key of path) {
    const parent = nodes.at(-1) as Record<PropertyKey, unknown> | unknown[] | null | undefined;
    if (parent === null || typeof parent !== 'object') break;
    nodes.push((parent as Record<PropertyKey, unknown>)[key as string]);
  }
  for (let i = Math.min(path.length, nodes.length - 1) - 1; i >= 0; i--) {
    const parent = nodes[i];
    if (Array.isArray(parent) && typeof path[i] === 'number') {
      parent.splice(path[i] as number, 1);
      return true;
    }
  }
  const last = path.at(-1);
  const holder = nodes[path.length - 1];
  if (last !== undefined && holder && typeof holder === 'object' && !Array.isArray(holder) && last in holder) {
    delete (holder as Record<PropertyKey, unknown>)[last as string];
    return true;
  }
  return false;
}

/** Vorlage-Datei lesen; liefert eine verständliche Fehlermeldung statt einer Ausnahme. */
export function readTemplateFile(text: string): { ok: true; template: TemplateFile } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Die Datei ist kein gültiges JSON.' };
  }
  if ((raw as { format?: unknown })?.format !== TEMPLATE_FORMAT) {
    return { ok: false, error: 'Das ist keine Moin_Julia-Vorlage.' };
  }
  const parsed = templateFileSchema.safeParse(raw);
  if (!parsed.success) {
    const version = (raw as { version?: unknown }).version;
    if (typeof version === 'number' && version > TEMPLATE_VERSION) {
      return { ok: false, error: 'Die Vorlage stammt aus einer neueren Moin_Julia-Version – bitte erst updaten.' };
    }
    return { ok: false, error: `Die Vorlage ist beschädigt (${parsed.error.issues[0]?.path.join('.') ?? '?'}).` };
  }
  return { ok: true, template: parsed.data };
}

// ── GalaxyBot ───────────────────────────────────────────────────────────────

/**
 * Es gibt zwei Bots namens „GalaxyBot“ (laut top.gg):
 * 697498867754729482 = GalaxyBot von galaxybot.app (deutsch, Tickets/Teams/Club Management) – Philips Bot,
 * 576764876924387328 = ein anderer, englischer Multi-Bot gleichen Namens.
 * Beide werden erkannt und im Scan vorausgewählt; GalaxyBot mit eigenem Branding hat eine eigene ID (Bot-Auswahl).
 */
export const GALAXYBOT_IDS = ['697498867754729482', '576764876924387328'] as const;
export const GALAXYBOT_ID = GALAXYBOT_IDS[0];

/**
 * Laut GalaxyBot-Doku (docs.galaxybot.app/en/modules/welcome): %TOTALUSERCOUNT% = alle Mitglieder inkl. Bots,
 * %USERCOUNT% = ohne Bots, %BOTCOUNT% = Bots. %USERTAG%/%USERID% sind nicht dokumentiert, schaden aber nicht.
 */
const GALAXY_PLACEHOLDERS: [RegExp, string][] = [
  [/%MENTION%/gi, '{user}'],
  [/%USERNAME%/gi, '{user.name}'],
  [/%USERTAG%/gi, '{user.tag}'],
  [/%USERID%/gi, '{user.id}'],
  [/%SERVERNAME%/gi, '{server}'],
  [/%TOTALUSERCOUNT%/gi, '{memberCount}'],
  [/%USERCOUNT%/gi, '{humanCount}'],
  [/%BOTCOUNT%/gi, '{botCount}'],
];

/** GalaxyBot-Platzhalter in Moin_Julia-Platzhalter umwandeln. Unbekannte bleiben stehen und werden gemeldet. */
export function convertGalaxyPlaceholders(text: string): { text: string; unknown: string[] } {
  let result = text;
  for (const [pattern, replacement] of GALAXY_PLACEHOLDERS) result = result.replace(pattern, replacement);
  const unknown = [...new Set(result.match(/%[A-Z_]+%/gi) ?? [])];
  return { text: result, unknown };
}
