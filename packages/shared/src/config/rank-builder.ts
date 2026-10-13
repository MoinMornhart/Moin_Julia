import { PERM } from './permissions-check.js';
import { MOD_PERMISSIONS } from './server-blueprints.js';

/**
 * Ränge-Baukasten (Issue #8): Rollen ganz einfach anlegen – Emoji, Trennzeichen, Name, Farbe, Rechte-Paket.
 * Stil wie auf vielen Community-Servern: „🔨‖Mod“, „💎 VIP“, „👑・Owner“.
 */
export const RANK_PACKAGES = ['keine', 'mitglied', 'vip', 'supporter', 'mod', 'admin'] as const;
export type RankPackage = (typeof RANK_PACKAGES)[number];

export const RANK_PACKAGE_INFO: Record<RankPackage, { label: string; hint: string; hoist: boolean }> = {
  keine: { label: 'Nur Deko', hint: 'keine Rechte – nur Name und Farbe', hoist: false },
  mitglied: { label: 'Mitglied', hint: 'keine Extra-Rechte (alles kommt von @everyone)', hoist: false },
  vip: { label: 'VIP', hint: 'getrennt angezeigt, darf Bilder/Links posten und Sprachaktivität nutzen', hoist: true },
  supporter: { label: 'Supporter', hint: 'Nachrichten löschen, Leute stummschalten/timeouten – kein Bannen', hoist: true },
  mod: { label: 'Moderator', hint: 'kicken, bannen, timeouten, Nachrichten löschen – keine Admin-Rechte', hoist: true },
  admin: { label: '⚠️ Administrator', hint: 'darf ALLES – nur für Owner/Admin-Ränge, nur der Server-Owner vergibt das', hoist: true },
};

const VIP_PERMISSIONS = (1n << 15n) /* Dateien */ | (1n << 14n) /* Links einbetten */ | (1n << 25n) /* Sprachaktivität */ | (1n << 18n); /* externe Emojis */
const SUPPORTER_PERMISSIONS = PERM.ManageMessages | PERM.ModerateMembers | (1n << 22n) /* Stummschalten */ | (1n << 24n); /* Verschieben */

/** Rechte-Bitfeld pro Paket (Dezimal-String wie bei Discord) */
export function rankPermissions(pkg: RankPackage): string {
  if (pkg === 'admin') return PERM.Administrator.toString();
  if (pkg === 'mod') return MOD_PERMISSIONS.toString();
  if (pkg === 'supporter') return SUPPORTER_PERMISSIONS.toString();
  if (pkg === 'vip') return VIP_PERMISSIONS.toString();
  return '0';
}

/** Trennzeichen zwischen Emoji und Name (Leerzeichen = einfach Abstand) */
export const RANK_SEPARATORS = ['‖', '・', '┃', '|', '»', '•', '-', ' ', ''] as const;

/** „🔨“ + „‖“ + „Mod“ → „🔨‖Mod“; ohne Emoji nur der Name. Discord erlaubt höchstens 100 Zeichen. */
export function buildRankName(emoji: string, separator: string, name: string): string {
  const e = emoji.trim();
  const n = name.trim().replace(/\s+/g, ' ');
  if (!n) return '';
  return (e ? `${e}${separator}${n}` : n).slice(0, 100);
}

export interface RankTemplate {
  emoji: string;
  name: string;
  color: number;
  pkg: RankPackage;
}

/** Vorlagen zum Anklicken – füllen den Baukasten, angelegt wird erst nach „Rang anlegen“ */
export const RANK_TEMPLATES: RankTemplate[] = [
  { emoji: '👑', name: 'Owner', color: 0xffc857, pkg: 'admin' },
  { emoji: '🛡️', name: 'Admin', color: 0xff7a59, pkg: 'admin' },
  { emoji: '🔨', name: 'Mod', color: 0x2fd1b8, pkg: 'mod' },
  { emoji: '🎧', name: 'Supporter', color: 0x5aa9ff, pkg: 'supporter' },
  { emoji: '💎', name: 'VIP', color: 0x9b8cff, pkg: 'vip' },
  { emoji: '🎥', name: 'Streamer', color: 0xb46cff, pkg: 'vip' },
  { emoji: '🚀', name: 'Booster', color: 0xff73fa, pkg: 'vip' },
  { emoji: '🎮', name: 'Gamer', color: 0x57f287, pkg: 'mitglied' },
  { emoji: '👤', name: 'Mitglied', color: 0x8c96ba, pkg: 'mitglied' },
  { emoji: '🤖', name: 'Bots', color: 0x5865f2, pkg: 'keine' },
];

/** Emoji/Trennzeichen aus einem vorhandenen Namen lösen (zum Bearbeiten): „🔨‖Mod“ → 🔨, ‖, Mod */
export function splitRankName(full: string): { emoji: string; separator: string; name: string } {
  const m = full.match(/^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*([‖・┃|»•-]?)\s*(.*)$/u);
  if (!m) return { emoji: '', separator: ' ', name: full };
  const sep = m[2] || (full.slice(m[1]!.length).startsWith(' ') ? ' ' : '');
  return { emoji: m[1]!, separator: sep, name: m[3] ?? '' };
}
