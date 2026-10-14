import { describe, expect, it } from 'vitest';
import { canCopyServer, copiedMessageContent, copyDate, mapOverwrites, maskPermissions, parseCopyOptions, planRoles, targetChannelType, webhookUsername } from './server-copy.js';

const ADMIN = 1n << 3n;
const VIEW = 1n << 10n;
const SEND = 1n << 11n;
const BAN = 1n << 2n;

describe('Server kopieren', () => {
  it('nur Owner oder Administrator', () => {
    expect(canCopyServer(true, 0n)).toBe(true);
    expect(canCopyServer(false, ADMIN)).toBe(true);
    expect(canCopyServer(false, BAN | VIEW)).toBe(false);
  });

  it('Optionen: Nachrichten brauchen Kanäle, ungültige Anzahl abgelehnt', () => {
    expect(parseCopyOptions({ roles: true, channels: false, messages: 100 })).toEqual({ roles: true, channels: true, messages: 100 });
    expect(parseCopyOptions({ roles: true, messages: 77 })).toBeNull();
    expect(parseCopyOptions({ roles: false, channels: false, messages: 0 })).toBeNull();
  });

  it('Rechte: nur was der Bot hat, nie Administrator', () => {
    expect(maskPermissions(ADMIN | BAN | VIEW, VIEW | SEND)).toBe(VIEW);
    expect(maskPermissions(ADMIN | BAN, ADMIN)).toBe(BAN);
  });

  it('Rollen: ohne @everyone und Bot-Rollen, von oben nach unten, gleichnamige mitbenutzt', () => {
    const r = (id: string, name: string, position: number, managed = false) => ({ id, name, color: 0, hoist: false, mentionable: false, permissions: 0n, position, managed });
    const plan = planRoles([r('g', '@everyone', 0), r('a', 'Mitglied', 1), r('b', 'Mod', 3), r('c', 'MEE6', 2, true)], [{ id: 'x', name: 'mod' }], 'g');
    expect(plan.map((p) => [p.source.name, p.reuseId])).toEqual([
      ['Mod', 'x'],
      ['Mitglied', null],
    ]);
  });

  it('Kanal-Rechte: Rollen umgeschrieben, Personen weg, Bot bekommt Zugriff', () => {
    const map = new Map([['roleA', 'newA']]);
    const out = mapOverwrites(
      [
        { id: 'src', type: 0, allow: 0n, deny: VIEW },
        { id: 'roleA', type: 0, allow: VIEW | SEND | ADMIN, deny: 0n },
        { id: 'user1', type: 1, allow: VIEW, deny: 0n },
        { id: 'unknownRole', type: 0, allow: VIEW, deny: 0n },
      ],
      map,
      { sourceGuildId: 'src', targetGuildId: 'tgt', botId: 'bot' },
      VIEW | SEND | (1n << 16n) | (1n << 29n),
    );
    expect(out).toEqual([
      { id: 'tgt', type: 0, allow: 0n, deny: VIEW },
      { id: 'newA', type: 0, allow: VIEW | SEND, deny: 0n },
      { id: 'bot', type: 1, allow: VIEW | SEND | (1n << 16n) | (1n << 29n), deny: 0n },
    ]);
  });

  it('Kanaltypen ohne Community: Ankündigung/Forum → Text, Bühne → Sprache, Threads nicht', () => {
    expect(targetChannelType(5, false)).toBe(0);
    expect(targetChannelType(15, false)).toBe(0);
    expect(targetChannelType(13, false)).toBe(2);
    expect(targetChannelType(5, true)).toBe(5);
    expect(targetChannelType(11, true)).toBeNull();
  });

  it('Webhook-Namen ohne „discord“/„clyde“, höchstens 80 Zeichen', () => {
    expect(webhookUsername('Discord Fan')).toBe('disc0rd Fan');
    expect(webhookUsername('  ')).toBe('Unbekannt');
    expect(webhookUsername('x'.repeat(100))).toHaveLength(80);
  });

  it('Nachricht mit Original-Datum, nie über 2000 Zeichen', () => {
    const at = Date.UTC(2026, 9, 3, 12, 22);
    expect(copyDate(at)).toBe('03.10.2026, 14:22');
    expect(copiedMessageContent({ createdAt: at, content: 'Moin!' })).toBe('-# 📅 03.10.2026, 14:22\nMoin!');
    const long = copiedMessageContent({ createdAt: at, content: 'a'.repeat(3000), extra: ['📎 https://example.org/bild.png'] });
    expect(long.length).toBeLessThanOrEqual(2000);
    expect(long.endsWith('📎 https://example.org/bild.png')).toBe(true);
  });
});
