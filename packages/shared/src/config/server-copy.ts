/**
 * Server kopieren (Wunsch Philip, 14.10.): Rollen, Kategorien, Kanäle mit Rechten und auf Wunsch den
 * Nachrichtenverlauf von einem Server auf einen anderen übertragen. Nur wer auf BEIDEN Servern Owner oder
 * Administrator ist (kein Generalschlüssel). Der Bot führt den Auftrag aus, das Dashboard zeigt den Fortschritt.
 */

export const COPY_MESSAGE_LIMITS = [0, 50, 100, 500, 1000] as const;
export type CopyMessageLimit = (typeof COPY_MESSAGE_LIMITS)[number];

export interface CopyOptions {
  roles: boolean;
  channels: boolean;
  /** Nachrichten pro Textkanal (0 = keine) */
  messages: CopyMessageLimit;
}

export type CopyStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface CopyJob {
  id: string;
  sourceGuildId: string;
  sourceName: string;
  targetGuildId: string;
  by: string;
  byName: string;
  options: CopyOptions;
  status: CopyStatus;
  /** Was gerade passiert (für die Anzeige) */
  step: string;
  counts: { roles: number; reusedRoles: number; channels: number; reusedChannels: number; messages: number; messageTotal: number };
  errors: string[];
  /** Vom Kopieren neu angelegt (für „wieder löschen“) */
  created: { roleIds: string[]; channelIds: string[] };
  cancel?: boolean;
  startedAt: number;
  finishedAt?: number;
}

export const copyJobKey = (targetGuildId: string) => `moin:copy:job:${targetGuildId}`;
/** Fortschritt eine Woche aufheben */
export const COPY_JOB_TTL = 7 * 24 * 3600;

export function newCopyJob(input: Pick<CopyJob, 'id' | 'sourceGuildId' | 'sourceName' | 'targetGuildId' | 'by' | 'byName' | 'options'>, now = Date.now()): CopyJob {
  return {
    ...input,
    status: 'queued',
    step: 'Wartet auf den Bot …',
    counts: { roles: 0, reusedRoles: 0, channels: 0, reusedChannels: 0, messages: 0, messageTotal: 0 },
    errors: [],
    created: { roleIds: [], channelIds: [] },
    startedAt: now,
  };
}

export function parseCopyOptions(raw: { roles?: unknown; channels?: unknown; messages?: unknown }): CopyOptions | null {
  const messages = Number(raw.messages ?? 0);
  if (!(COPY_MESSAGE_LIMITS as readonly number[]).includes(messages)) return null;
  const options: CopyOptions = { roles: raw.roles === true, channels: raw.channels === true, messages: messages as CopyMessageLimit };
  // Nachrichten brauchen Kanäle (sonst wüssten wir nicht, wohin)
  if (options.messages > 0 && !options.channels) options.channels = true;
  if (!options.roles && !options.channels) return null;
  return options;
}

export const ADMINISTRATOR = 1n << 3n;

/** Owner oder Administrator – nur die dürfen kopieren */
export function canCopyServer(isOwner: boolean, permissions: bigint): boolean {
  return isOwner || (permissions & ADMINISTRATOR) !== 0n;
}

/** Rechte, die der Bot vergeben kann: nur die, die er selbst hat; Administrator nie */
export function maskPermissions(wanted: bigint, botPermissions: bigint): bigint {
  if ((botPermissions & ADMINISTRATOR) !== 0n) return wanted & ~ADMINISTRATOR;
  return wanted & botPermissions & ~ADMINISTRATOR;
}

export interface CopyRoleSource {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  permissions: bigint;
  position: number;
  managed: boolean;
}

export interface RolePlanItem {
  source: CopyRoleSource;
  /** vorhandene Rolle im Ziel (gleicher Name) – wird mitbenutzt, nicht verändert */
  reuseId: string | null;
}

/**
 * Welche Rollen anlegen? Von oben nach unten (neue Rollen landen bei Discord ganz unten – so stimmt die
 * Reihenfolge am Ende). @everyone und Bot-/Integrations-Rollen werden nicht kopiert.
 */
export function planRoles(source: readonly CopyRoleSource[], target: readonly { id: string; name: string }[], sourceGuildId: string): RolePlanItem[] {
  const byName = new Map(target.map((r) => [r.name.toLowerCase(), r.id]));
  return source
    .filter((r) => r.id !== sourceGuildId && !r.managed)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ source: r, reuseId: byName.get(r.name.toLowerCase()) ?? null }));
}

export interface CopyOverwrite {
  id: string;
  type: 0 | 1;
  allow: bigint;
  deny: bigint;
}

/**
 * Kanal-Rechte übertragen: Rollen-IDs umschreiben (@everyone → @everyone des Ziels), Personen-Rechte weglassen
 * (die Leute sind auf dem anderen Server nicht dieselben), Rechte auf das begrenzen, was der Bot vergeben darf.
 * Der Bot selbst bekommt immer Zugriff, sonst könnte er den Kanal danach nicht mehr verwalten.
 */
export function mapOverwrites(
  source: readonly CopyOverwrite[],
  roleMap: ReadonlyMap<string, string>,
  ids: { sourceGuildId: string; targetGuildId: string; botId: string },
  botPermissions: bigint,
): CopyOverwrite[] {
  const out: CopyOverwrite[] = [];
  for (const o of source) {
    if (o.type !== 0) continue;
    const id = o.id === ids.sourceGuildId ? ids.targetGuildId : roleMap.get(o.id);
    if (!id) continue;
    const allow = maskPermissions(o.allow, botPermissions);
    const deny = maskPermissions(o.deny, botPermissions);
    if (allow || deny) out.push({ id, type: 0, allow, deny });
  }
  // Ansehen, Senden, Verlauf, Webhooks (für die Nachrichten), Verbinden
  const botAllow = (1n << 10n) | (1n << 11n) | (1n << 16n) | (1n << 29n) | (1n << 20n);
  out.push({ id: ids.botId, type: 1, allow: maskPermissions(botAllow, botPermissions), deny: 0n });
  return out;
}

/** Discord-Kanaltypen, die wir kopieren können (Text, Sprache, Kategorie, Ankündigung, Bühne, Forum) */
export const COPYABLE_CHANNEL_TYPES = [0, 2, 4, 5, 13, 15] as const;

/** Ankündigung/Bühne/Forum gehen nur auf Community-Servern – sonst Text bzw. Sprache */
export function targetChannelType(type: number, community: boolean): number | null {
  if (type === 0 || type === 2 || type === 4) return type;
  if (type === 5) return community ? 5 : 0;
  if (type === 13) return community ? 13 : 2;
  if (type === 15) return community ? 15 : 0;
  return null;
}

/** Webhook-Name: Discord verbietet „discord“/„clyde“ im Namen und mehr als 80 Zeichen */
export function webhookUsername(name: string): string {
  const clean = name
    .replace(/discord/gi, 'disc0rd')
    .replace(/clyde/gi, 'clyd3')
    .replace(/\s+/g, ' ')
    .trim();
  return (clean || 'Unbekannt').slice(0, 80);
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Datum in deutscher Zeit, z. B. „03.10.2026, 14:22“ */
export function copyDate(ms: number): string {
  const parts = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')}, ${get('hour')}:${get('minute')}`;
}

/**
 * Text einer kopierten Nachricht: kleine Zeile mit dem Original-Datum (Discord kann kein altes Datum setzen),
 * dann der Inhalt. Passt alles in 2000 Zeichen; Anhänge, die nicht hochgeladen werden konnten, als Link.
 */
export function copiedMessageContent(input: { createdAt: number; content: string; edited?: boolean; extra?: string[] }): string {
  const head = `-# 📅 ${copyDate(input.createdAt)}${input.edited ? ' (bearbeitet)' : ''}`;
  const extra = (input.extra ?? []).filter(Boolean);
  const tail = extra.length ? `\n${extra.join('\n')}` : '';
  const room = 2000 - head.length - 1 - tail.length;
  const body = input.content.length > room ? `${input.content.slice(0, Math.max(0, room - 1))}…` : input.content;
  return `${head}\n${body}${tail}`.slice(0, 2000);
}

/** Größte Datei, die wir neu hochladen (Webhook-Limit ohne Boost: 10 MB) */
export const COPY_MAX_FILE_BYTES = 10 * 1024 * 1024;
