/**
 * Rechte-Check (Issue #5): findet gefährliche Discord-Rechte, die normale Mitglieder bekommen –
 * über die @everyone-Rolle, über Rollen oder über Kanal-Ausnahmen – und erklärt sie verständlich.
 * Dazu der „Nur lesen“-Schalter: @everyone darf im Kanal lesen, aber nicht schreiben.
 * Rechte sind Bitfelder (Discord liefert sie als Zahl-Text, z. B. "2048").
 */
export const PERM = {
  KickMembers: 1n << 1n,
  BanMembers: 1n << 2n,
  Administrator: 1n << 3n,
  ManageChannels: 1n << 4n,
  ManageGuild: 1n << 5n,
  AddReactions: 1n << 6n,
  ViewChannel: 1n << 10n,
  SendMessages: 1n << 11n,
  ManageMessages: 1n << 13n,
  MentionEveryone: 1n << 17n,
  ManageNicknames: 1n << 27n,
  ManageRoles: 1n << 28n,
  ManageWebhooks: 1n << 29n,
  ManageGuildExpressions: 1n << 30n,
  CreatePublicThreads: 1n << 35n,
  CreatePrivateThreads: 1n << 36n,
  SendMessagesInThreads: 1n << 38n,
  ModerateMembers: 1n << 40n,
} as const;
export type PermName = keyof typeof PERM;

/** Verständliche Namen (wie in Discord) und warum es gefährlich ist */
export const DANGEROUS_PERMS: { name: PermName; label: string; why: string }[] = [
  { name: 'Administrator', label: 'Administrator', why: 'darf ALLES – auch Kanäle/Rollen löschen und andere bannen' },
  { name: 'ManageGuild', label: 'Server verwalten', why: 'kann Server-Einstellungen und Bots ändern' },
  { name: 'ManageRoles', label: 'Rollen verwalten', why: 'kann sich selbst und anderen Rechte geben' },
  { name: 'ManageChannels', label: 'Kanäle verwalten', why: 'kann Kanäle umbenennen, löschen und Rechte ändern' },
  { name: 'BanMembers', label: 'Mitglieder bannen', why: 'kann Leute dauerhaft rauswerfen' },
  { name: 'KickMembers', label: 'Mitglieder kicken', why: 'kann Leute rauswerfen' },
  { name: 'ModerateMembers', label: 'Mitglieder im Timeout', why: 'kann andere stummschalten' },
  { name: 'ManageWebhooks', label: 'Webhooks verwalten', why: 'kann Nachrichten unter fremden Namen senden' },
  { name: 'MentionEveryone', label: '@everyone erwähnen', why: 'kann den ganzen Server anpingen' },
  { name: 'ManageMessages', label: 'Nachrichten verwalten', why: 'kann fremde Nachrichten löschen' },
];

/** Was „Nur lesen“ verbietet: schreiben und Threads – Lesen, Verlauf und Reaktionen bleiben */
export const READ_ONLY_DENY = PERM.SendMessages | PERM.SendMessagesInThreads | PERM.CreatePublicThreads | PERM.CreatePrivateThreads;

export interface CheckRole {
  id: string;
  name: string;
  permissions: string;
  /** Rolle eines Bots/einer Integration – setzt Discord selbst */
  managed?: boolean;
}
export interface CheckOverwrite {
  id: string;
  /** 0 = Rolle, 1 = Person */
  type: number;
  allow: string;
  deny: string;
}
export interface CheckChannel {
  id: string;
  name: string;
  type: number;
  overwrites: CheckOverwrite[];
}

export interface PermFinding {
  severity: 'hoch' | 'mittel';
  /** Wo steht das Recht? */
  where: 'everyone' | 'rolle' | 'kanal';
  targetId: string;
  title: string;
  detail: string;
  /** Was man tun sollte */
  fix: string;
}

const bits = (value: string | undefined) => {
  try {
    return BigInt(value ?? '0');
  } catch {
    return 0n;
  }
};

/** Welche gefährlichen Rechte stecken in diesem Bitfeld? */
export function dangerousIn(value: string | bigint): typeof DANGEROUS_PERMS {
  const v = typeof value === 'bigint' ? value : bits(value);
  return DANGEROUS_PERMS.filter((p) => (v & PERM[p.name]) !== 0n);
}

const list = (perms: typeof DANGEROUS_PERMS) => perms.map((p) => `„${p.label}“`).join(', ');

/**
 * Alle Funde für einen Server. `guildId` ist zugleich die ID der @everyone-Rolle.
 * Bot-Rollen (managed) zählen nicht – die setzt Discord beim Einladen.
 */
export function auditPermissions(guildId: string, roles: readonly CheckRole[], channels: readonly CheckChannel[]): PermFinding[] {
  const out: PermFinding[] = [];
  const everyone = roles.find((r) => r.id === guildId);
  const everyonePerms = everyone ? dangerousIn(everyone.permissions) : [];
  if (everyonePerms.length) {
    out.push({
      severity: 'hoch',
      where: 'everyone',
      targetId: guildId,
      title: `Jedes Mitglied hat ${list(everyonePerms)}`,
      detail: `Die Rolle @everyone hat jeder – auch wer gerade erst beigetreten ist. ${everyonePerms.map((p) => `${p.label}: ${p.why}`).join('; ')}.`,
      fix: 'In Discord: Server-Einstellungen → Rollen → @everyone → diese Rechte ausschalten.',
    });
  }
  for (const role of roles) {
    if (role.id === guildId || role.managed) continue;
    if ((bits(role.permissions) & PERM.Administrator) !== 0n) {
      out.push({
        severity: 'mittel',
        where: 'rolle',
        targetId: role.id,
        title: `Rolle „${role.name}“ hat Administrator`,
        detail: 'Wer diese Rolle hat, darf alles. Das ist nur für das engste Team gedacht.',
        fix: 'Nur vertrauten Personen geben – oder statt Administrator einzelne Rechte vergeben.',
      });
    }
  }
  for (const channel of channels) {
    for (const ow of channel.overwrites) {
      if (ow.type !== 0 || ow.id !== guildId) continue;
      const perms = dangerousIn(ow.allow);
      if (!perms.length) continue;
      out.push({
        severity: 'hoch',
        where: 'kanal',
        targetId: channel.id,
        title: `#${channel.name}: jedes Mitglied hat ${list(perms)}`,
        detail: `Im Kanal #${channel.name} ist für @everyone ausdrücklich erlaubt: ${perms.map((p) => `${p.label} (${p.why})`).join('; ')}.`,
        fix: `In Discord: #${channel.name} bearbeiten → Berechtigungen → @everyone → diese Rechte auf ✖ oder „/“ stellen.`,
      });
    }
  }
  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'hoch' ? -1 : 1));
}

/** Ist der Kanal für @everyone „Nur lesen“? */
export function isReadOnly(guildId: string, channel: Pick<CheckChannel, 'overwrites'>): boolean {
  const ow = channel.overwrites.find((o) => o.type === 0 && o.id === guildId);
  return !!ow && (bits(ow.deny) & PERM.SendMessages) !== 0n;
}

/** Neue @everyone-Ausnahme für „Nur lesen“ an/aus – alle anderen Bits bleiben, wie sie waren */
export function readOnlyOverwrite(current: Pick<CheckOverwrite, 'allow' | 'deny'> | undefined, on: boolean): { allow: string; deny: string } {
  let allow = bits(current?.allow);
  let deny = bits(current?.deny);
  if (on) {
    allow &= ~READ_ONLY_DENY;
    deny |= READ_ONLY_DENY;
  } else {
    deny &= ~READ_ONLY_DENY;
  }
  return { allow: allow.toString(), deny: deny.toString() };
}
