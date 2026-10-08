import type { APIEmbed, APIEmbedField } from 'discord.js';
import { t, type Locale, type TranslationKey } from '@moin/shared';

/**
 * Reine Funktionen: Ereignis-Daten → Embed. Keine discord.js-Objekte, damit alles ohne Discord testbar ist.
 */

export const LOG_COLORS = {
  delete: 0xff5d7a,
  edit: 0xffc857,
  join: 0x2fd1b8,
  leave: 0x8c96ba,
  moderation: 0xff7a59,
  info: 0x7aa2ff,
} as const;

export interface LogUserRef {
  id: string;
  tag: string;
  avatarUrl?: string | null;
}

export interface Change {
  key: TranslationKey;
  before: string;
  after: string;
}

const FIELD_MAX = 1024;
const DESCRIPTION_MAX = 4096;
const NEW_ACCOUNT_MS = 7 * 24 * 60 * 60 * 1000;

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Discord-Zeitstempel: absolut + relativ, wird im Client in der Sprache des Lesers angezeigt. */
export function stamp(date: Date): string {
  const unix = Math.floor(date.getTime() / 1000);
  return `<t:${unix}:f> (<t:${unix}:R>)`;
}

export function userLine(user: LogUserRef): string {
  return `<@${user.id}> · \`${user.tag}\``;
}

function field(name: string, value: string, inline = false): APIEmbedField {
  return { name, value: truncate(value || '–', FIELD_MAX), inline };
}

/** Text in einen Block setzen; leere Nachrichten und Backticks sicher behandeln. */
function block(locale: Locale, text: string | null): string {
  if (text === null) return t(locale, 'log.uncached');
  if (!text.trim()) return t(locale, 'log.noText');
  return truncate(text.replace(/```/g, 'ˋˋˋ'), FIELD_MAX - 8);
}

function moderatorFields(locale: Locale, moderator?: LogUserRef | null, reason?: string | null): APIEmbedField[] {
  const fields: APIEmbedField[] = [];
  if (moderator) fields.push(field(t(locale, 'log.field.moderator'), userLine(moderator), true));
  if (reason !== undefined) fields.push(field(t(locale, 'log.field.reason'), reason || t(locale, 'log.noReason'), true));
  return fields;
}

function author(user: LogUserRef): APIEmbed['author'] {
  return { name: user.tag, icon_url: user.avatarUrl ?? undefined };
}

function base(color: number, title: string, now: Date): APIEmbed {
  return { color, title, timestamp: now.toISOString() };
}

// ── Nachrichten ─────────────────────────────────────────────────────────────

export function messageDeletedEmbed(p: {
  locale: Locale;
  author: LogUserRef | null;
  channelId: string;
  messageId: string;
  content: string | null;
  attachments: string[];
  now: Date;
}): APIEmbed {
  const fields = [
    ...(p.author ? [field(t(p.locale, 'log.field.author'), userLine(p.author), true)] : []),
    field(t(p.locale, 'log.field.channel'), `<#${p.channelId}>`, true),
  ];
  if (p.attachments.length) fields.push(field(t(p.locale, 'log.field.attachments'), p.attachments.join('\n')));
  return {
    ...base(LOG_COLORS.delete, `🗑️ ${t(p.locale, 'log.messageDeleted')}`, p.now),
    author: p.author ? author(p.author) : undefined,
    description: p.content === null ? t(p.locale, 'log.uncached') : truncate(p.content || t(p.locale, 'log.noText'), DESCRIPTION_MAX),
    fields,
    footer: { text: t(p.locale, 'log.footer.messageId', { id: p.messageId }) },
  };
}

export function messageEditedEmbed(p: {
  locale: Locale;
  author: LogUserRef;
  channelId: string;
  messageId: string;
  url: string;
  before: string | null;
  after: string;
  now: Date;
}): APIEmbed {
  return {
    ...base(LOG_COLORS.edit, `✏️ ${t(p.locale, 'log.messageEdited')}`, p.now),
    author: author(p.author),
    description: `[${t(p.locale, 'log.jump')}](${p.url}) · <#${p.channelId}>`,
    fields: [
      field(t(p.locale, 'log.field.before'), block(p.locale, p.before)),
      field(t(p.locale, 'log.field.after'), block(p.locale, p.after)),
      field(t(p.locale, 'log.field.author'), userLine(p.author), true),
    ],
    footer: { text: t(p.locale, 'log.footer.messageId', { id: p.messageId }) },
  };
}

export function bulkDeletedEmbed(p: { locale: Locale; channelId: string; count: number; now: Date }): APIEmbed {
  return {
    ...base(LOG_COLORS.delete, `🧹 ${t(p.locale, 'log.bulkDeleted', { count: p.count })}`, p.now),
    description: `<#${p.channelId}>\n${t(p.locale, 'log.bulkFile')}`,
    footer: { text: t(p.locale, 'log.footer.channelId', { id: p.channelId }) },
  };
}

/** Textdatei für Massenlöschungen, älteste Nachricht zuerst. */
export function bulkTranscript(
  messages: { createdAt: Date; authorTag: string | null; content: string | null; attachments: string[] }[],
): string {
  return [...messages]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((m) => {
      const when = m.createdAt.toISOString().replace('T', ' ').slice(0, 19);
      const text = m.content === null ? '[Inhalt unbekannt]' : m.content || '[kein Text]';
      const files = m.attachments.length ? ` [Anhänge: ${m.attachments.join(', ')}]` : '';
      return `[${when} UTC] ${m.authorTag ?? 'Unbekannt'}: ${text}${files}`;
    })
    .join('\n');
}

// ── Mitglieder ──────────────────────────────────────────────────────────────

export function memberJoinedEmbed(p: {
  locale: Locale;
  user: LogUserRef;
  accountCreated: Date;
  memberCount: number;
  now: Date;
}): APIEmbed {
  const young = p.now.getTime() - p.accountCreated.getTime() < NEW_ACCOUNT_MS;
  return {
    ...base(LOG_COLORS.join, `📥 ${t(p.locale, 'log.memberJoined')}`, p.now),
    author: author(p.user),
    description: young ? `${userLine(p.user)}\n${t(p.locale, 'log.newAccount')}` : userLine(p.user),
    thumbnail: p.user.avatarUrl ? { url: p.user.avatarUrl } : undefined,
    fields: [
      field(t(p.locale, 'log.field.accountCreated'), stamp(p.accountCreated), true),
      field(t(p.locale, 'log.field.memberCount'), String(p.memberCount), true),
    ],
    footer: { text: t(p.locale, 'log.footer.userId', { id: p.user.id }) },
  };
}

export function memberLeftEmbed(p: { locale: Locale; user: LogUserRef; joinedAt: Date | null; roleIds: string[]; now: Date }): APIEmbed {
  const fields = [field(t(p.locale, 'log.field.joinedServer'), p.joinedAt ? stamp(p.joinedAt) : '–', true)];
  if (p.roleIds.length) fields.push(field(t(p.locale, 'log.field.roles'), p.roleIds.map((id) => `<@&${id}>`).join(' ')));
  return {
    ...base(LOG_COLORS.leave, `📤 ${t(p.locale, 'log.memberLeft')}`, p.now),
    author: author(p.user),
    description: userLine(p.user),
    fields,
    footer: { text: t(p.locale, 'log.footer.userId', { id: p.user.id }) },
  };
}

export type ModerationKind = 'kick' | 'ban' | 'unban';
const MODERATION_TITLES: Record<ModerationKind, [string, TranslationKey]> = {
  kick: ['👢', 'log.memberKicked'],
  ban: ['🔨', 'log.memberBanned'],
  unban: ['🕊️', 'log.memberUnbanned'],
};

export function moderationEmbed(p: {
  locale: Locale;
  kind: ModerationKind;
  user: LogUserRef;
  moderator: LogUserRef | null;
  reason: string | null;
  now: Date;
}): APIEmbed {
  const [icon, key] = MODERATION_TITLES[p.kind];
  return {
    ...base(p.kind === 'unban' ? LOG_COLORS.join : LOG_COLORS.moderation, `${icon} ${t(p.locale, key)}`, p.now),
    author: author(p.user),
    description: userLine(p.user),
    fields: moderatorFields(p.locale, p.moderator, p.reason),
    footer: { text: t(p.locale, 'log.footer.userId', { id: p.user.id }) },
  };
}

/** Welche Rollen-IDs hinzugekommen bzw. weggefallen sind. */
export function diffIds(before: string[], after: string[]): { added: string[]; removed: string[] } {
  const old = new Set(before);
  const now = new Set(after);
  return { added: after.filter((id) => !old.has(id)), removed: before.filter((id) => !now.has(id)) };
}

export function rolesChangedEmbed(p: {
  locale: Locale;
  user: LogUserRef;
  added: string[];
  removed: string[];
  moderator: LogUserRef | null;
  now: Date;
}): APIEmbed {
  const fields: APIEmbedField[] = [];
  if (p.added.length) fields.push(field(`➕ ${t(p.locale, 'log.field.added')}`, p.added.map((id) => `<@&${id}>`).join(' ')));
  if (p.removed.length) fields.push(field(`➖ ${t(p.locale, 'log.field.removed')}`, p.removed.map((id) => `<@&${id}>`).join(' ')));
  fields.push(...moderatorFields(p.locale, p.moderator));
  return {
    ...base(LOG_COLORS.info, `🏷️ ${t(p.locale, 'log.rolesChanged')}`, p.now),
    author: author(p.user),
    description: userLine(p.user),
    fields,
    footer: { text: t(p.locale, 'log.footer.userId', { id: p.user.id }) },
  };
}

export function nickChangedEmbed(p: { locale: Locale; user: LogUserRef; before: string | null; after: string | null; now: Date }): APIEmbed {
  return {
    ...base(LOG_COLORS.info, `🪪 ${t(p.locale, 'log.nickChanged')}`, p.now),
    author: author(p.user),
    description: userLine(p.user),
    fields: [
      field(t(p.locale, 'log.field.before'), p.before ?? '–', true),
      field(t(p.locale, 'log.field.after'), p.after ?? '–', true),
    ],
    footer: { text: t(p.locale, 'log.footer.userId', { id: p.user.id }) },
  };
}

export function timeoutEmbed(p: {
  locale: Locale;
  user: LogUserRef;
  until: Date | null;
  moderator: LogUserRef | null;
  reason: string | null;
  now: Date;
}): APIEmbed {
  const set = p.until !== null;
  const fields = set ? [field(t(p.locale, 'log.field.until'), stamp(p.until!), true)] : [];
  fields.push(...moderatorFields(p.locale, p.moderator, set ? p.reason : undefined));
  return {
    ...base(set ? LOG_COLORS.moderation : LOG_COLORS.join, `${set ? '⏳' : '✅'} ${t(p.locale, set ? 'log.timeoutSet' : 'log.timeoutRemoved')}`, p.now),
    author: author(p.user),
    description: userLine(p.user),
    fields,
    footer: { text: t(p.locale, 'log.footer.userId', { id: p.user.id }) },
  };
}

// ── Kanäle, Rollen, Server ──────────────────────────────────────────────────

export interface ChannelSnapshot {
  name: string;
  topic: string | null;
  nsfw: boolean;
  slowmode: number;
  parentId: string | null;
}

export interface RoleSnapshot {
  name: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  permissions: string;
}

export interface GuildSnapshot {
  name: string;
  icon: string | null;
  banner: string | null;
  description: string | null;
  verificationLevel: number;
}

function yesNo(locale: Locale, value: boolean): string {
  return t(locale, value ? 'common.yes' : 'common.no');
}

function hex(color: number): string {
  return color ? `#${color.toString(16).padStart(6, '0')}` : '–';
}

export function diffChannel(locale: Locale, a: ChannelSnapshot, b: ChannelSnapshot): Change[] {
  const changes: Change[] = [];
  if (a.name !== b.name) changes.push({ key: 'log.change.name', before: a.name, after: b.name });
  if ((a.topic ?? '') !== (b.topic ?? '')) changes.push({ key: 'log.change.topic', before: a.topic || '–', after: b.topic || '–' });
  if (a.nsfw !== b.nsfw) changes.push({ key: 'log.change.nsfw', before: yesNo(locale, a.nsfw), after: yesNo(locale, b.nsfw) });
  if (a.slowmode !== b.slowmode) changes.push({ key: 'log.change.slowmode', before: `${a.slowmode}s`, after: `${b.slowmode}s` });
  if (a.parentId !== b.parentId) {
    changes.push({ key: 'log.change.parent', before: a.parentId ? `<#${a.parentId}>` : '–', after: b.parentId ? `<#${b.parentId}>` : '–' });
  }
  return changes;
}

export function diffRole(locale: Locale, a: RoleSnapshot, b: RoleSnapshot): Change[] {
  const changes: Change[] = [];
  if (a.name !== b.name) changes.push({ key: 'log.change.name', before: a.name, after: b.name });
  if (a.color !== b.color) changes.push({ key: 'log.change.color', before: hex(a.color), after: hex(b.color) });
  if (a.hoist !== b.hoist) changes.push({ key: 'log.change.hoist', before: yesNo(locale, a.hoist), after: yesNo(locale, b.hoist) });
  if (a.mentionable !== b.mentionable) {
    changes.push({ key: 'log.change.mentionable', before: yesNo(locale, a.mentionable), after: yesNo(locale, b.mentionable) });
  }
  if (a.permissions !== b.permissions) changes.push({ key: 'log.change.permissions', before: a.permissions, after: b.permissions });
  return changes;
}

export function diffGuild(a: GuildSnapshot, b: GuildSnapshot): Change[] {
  const changes: Change[] = [];
  if (a.name !== b.name) changes.push({ key: 'log.change.name', before: a.name, after: b.name });
  if (a.icon !== b.icon) changes.push({ key: 'log.change.icon', before: a.icon ? '✔' : '–', after: b.icon ? '✔' : '–' });
  if (a.banner !== b.banner) changes.push({ key: 'log.change.banner', before: a.banner ? '✔' : '–', after: b.banner ? '✔' : '–' });
  if ((a.description ?? '') !== (b.description ?? '')) {
    changes.push({ key: 'log.change.description', before: a.description || '–', after: b.description || '–' });
  }
  if (a.verificationLevel !== b.verificationLevel) {
    changes.push({ key: 'log.change.verification', before: String(a.verificationLevel), after: String(b.verificationLevel) });
  }
  return changes;
}

function changeFields(locale: Locale, changes: Change[]): APIEmbedField[] {
  return changes.map((c) => field(t(locale, c.key), `${truncate(c.before, 480)} → ${truncate(c.after, 480)}`));
}

export type LifecycleKind = 'created' | 'deleted' | 'updated';

export function channelEmbed(p: {
  locale: Locale;
  kind: LifecycleKind;
  channelId: string;
  name: string;
  changes?: Change[];
  moderator: LogUserRef | null;
  now: Date;
}): APIEmbed {
  const titles: Record<LifecycleKind, [number, string, TranslationKey]> = {
    created: [LOG_COLORS.join, '➕', 'log.channelCreated'],
    deleted: [LOG_COLORS.delete, '➖', 'log.channelDeleted'],
    updated: [LOG_COLORS.edit, '🔧', 'log.channelUpdated'],
  };
  const [color, icon, key] = titles[p.kind];
  return {
    ...base(color, `${icon} ${t(p.locale, key)}`, p.now),
    description: p.kind === 'deleted' ? `**#${p.name}**` : `<#${p.channelId}> · **#${p.name}**`,
    fields: [...changeFields(p.locale, p.changes ?? []), ...moderatorFields(p.locale, p.moderator)],
    footer: { text: t(p.locale, 'log.footer.channelId', { id: p.channelId }) },
  };
}

export function roleEmbed(p: {
  locale: Locale;
  kind: LifecycleKind;
  roleId: string;
  name: string;
  color: number;
  changes?: Change[];
  moderator: LogUserRef | null;
  now: Date;
}): APIEmbed {
  const titles: Record<LifecycleKind, [string, TranslationKey]> = {
    created: ['➕', 'log.roleCreated'],
    deleted: ['➖', 'log.roleDeleted'],
    updated: ['🔧', 'log.roleUpdated'],
  };
  const [icon, key] = titles[p.kind];
  return {
    ...base(p.color || (p.kind === 'deleted' ? LOG_COLORS.delete : LOG_COLORS.info), `${icon} ${t(p.locale, key)}`, p.now),
    description: p.kind === 'deleted' ? `**@${p.name}**` : `<@&${p.roleId}> · **@${p.name}**`,
    fields: [...changeFields(p.locale, p.changes ?? []), ...moderatorFields(p.locale, p.moderator)],
    footer: { text: t(p.locale, 'log.footer.roleId', { id: p.roleId }) },
  };
}

export function serverUpdatedEmbed(p: { locale: Locale; changes: Change[]; moderator: LogUserRef | null; now: Date }): APIEmbed {
  return {
    ...base(LOG_COLORS.info, `🏠 ${t(p.locale, 'log.serverUpdated')}`, p.now),
    fields: [...changeFields(p.locale, p.changes), ...moderatorFields(p.locale, p.moderator)],
  };
}

export function inviteEmbed(p: {
  locale: Locale;
  kind: 'created' | 'deleted';
  code: string;
  channelId: string | null;
  inviter: LogUserRef | null;
  maxUses: number | null;
  expiresAt: Date | null;
  now: Date;
}): APIEmbed {
  const created = p.kind === 'created';
  const fields = [field(t(p.locale, 'log.field.code'), `\`${p.code}\``, true)];
  if (p.channelId) fields.push(field(t(p.locale, 'log.field.channel'), `<#${p.channelId}>`, true));
  if (created) {
    fields.push(
      field(t(p.locale, 'log.field.maxUses'), p.maxUses ? String(p.maxUses) : t(p.locale, 'log.unlimited'), true),
      field(t(p.locale, 'log.field.expires'), p.expiresAt ? stamp(p.expiresAt) : t(p.locale, 'log.never'), true),
    );
    if (p.inviter) fields.push(field(t(p.locale, 'log.field.createdBy'), userLine(p.inviter), true));
  }
  return {
    ...base(created ? LOG_COLORS.join : LOG_COLORS.delete, `🔗 ${t(p.locale, created ? 'log.inviteCreated' : 'log.inviteDeleted')}`, p.now),
    fields,
  };
}

// ── Voice ───────────────────────────────────────────────────────────────────

export function voiceEmbed(p: {
  locale: Locale;
  user: LogUserRef;
  from: string | null;
  to: string | null;
  now: Date;
}): APIEmbed | null {
  if (p.from === p.to) return null;
  if (!p.from && p.to) {
    return {
      ...base(LOG_COLORS.join, `🔊 ${t(p.locale, 'log.voiceJoined')}`, p.now),
      author: author(p.user),
      description: `${userLine(p.user)} → <#${p.to}>`,
      footer: { text: t(p.locale, 'log.footer.userId', { id: p.user.id }) },
    };
  }
  if (p.from && !p.to) {
    return {
      ...base(LOG_COLORS.leave, `🔇 ${t(p.locale, 'log.voiceLeft')}`, p.now),
      author: author(p.user),
      description: `${userLine(p.user)} ← <#${p.from}>`,
      footer: { text: t(p.locale, 'log.footer.userId', { id: p.user.id }) },
    };
  }
  return {
    ...base(LOG_COLORS.info, `🔀 ${t(p.locale, 'log.voiceMoved')}`, p.now),
    author: author(p.user),
    description: userLine(p.user),
    fields: [field(t(p.locale, 'log.field.from'), `<#${p.from}>`, true), field(t(p.locale, 'log.field.to'), `<#${p.to}>`, true)],
    footer: { text: t(p.locale, 'log.footer.userId', { id: p.user.id }) },
  };
}
