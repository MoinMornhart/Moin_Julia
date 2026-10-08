import { describe, expect, it } from 'vitest';
import {
  bulkTranscript,
  diffChannel,
  diffGuild,
  diffIds,
  diffRole,
  inviteEmbed,
  memberJoinedEmbed,
  messageDeletedEmbed,
  messageEditedEmbed,
  moderationEmbed,
  rolesChangedEmbed,
  stamp,
  timeoutEmbed,
  truncate,
  voiceEmbed,
} from './embeds.js';

const now = new Date('2026-10-08T10:00:00Z');
const anna = { id: '111111111111111111', tag: 'anna', avatarUrl: 'https://cdn.example/a.png' };
const mod = { id: '222222222222222222', tag: 'moderator' };

describe('Hilfsfunktionen', () => {
  it('kürzt lange Texte mit …', () => {
    expect(truncate('abcdef', 4)).toBe('abc…');
    expect(truncate('abc', 4)).toBe('abc');
  });
  it('baut Discord-Zeitstempel', () => {
    expect(stamp(now)).toBe('<t:1791453600:f> (<t:1791453600:R>)');
  });
  it('erkennt hinzugefügte und entfernte Rollen', () => {
    expect(diffIds(['1', '2'], ['2', '3'])).toEqual({ added: ['3'], removed: ['1'] });
  });
});

describe('Nachrichten', () => {
  it('gelöschte Nachricht: Inhalt, Autor, Kanal, Anhänge', () => {
    const e = messageDeletedEmbed({
      locale: 'de', author: anna, channelId: '333', messageId: '444', content: 'Hallo Welt', attachments: ['bild.png'], now,
    });
    expect(e.title).toContain('Nachricht gelöscht');
    expect(e.description).toBe('Hallo Welt');
    expect(e.fields?.map((f) => f.value)).toEqual(['<@111111111111111111> · `anna`', '<#333>', 'bild.png']);
    expect(e.footer?.text).toBe('Nachricht 444');
  });

  it('nicht gecachte Nachricht wird ehrlich als unbekannt gemeldet', () => {
    const e = messageDeletedEmbed({ locale: 'en', author: null, channelId: '1', messageId: '2', content: null, attachments: [], now });
    expect(e.description).toContain('Content unknown');
    expect(e.author).toBeUndefined();
  });

  it('bearbeitete Nachricht: Vorher/Nachher, Backticks entschärft, lange Texte gekürzt', () => {
    const e = messageEditedEmbed({
      locale: 'de', author: anna, channelId: '1', messageId: '2', url: 'https://discord.com/x', before: '```code```', after: 'x'.repeat(2000), now,
    });
    expect(e.fields?.[0]?.value).not.toContain('```');
    expect(e.fields?.[1]?.value.length).toBeLessThanOrEqual(1024);
    expect(e.description).toContain('[Zur Nachricht](https://discord.com/x)');
  });

  it('Massenlöschung als Textdatei, chronologisch', () => {
    const text = bulkTranscript([
      { createdAt: new Date('2026-10-08T10:01:00Z'), authorTag: 'bernd', content: 'zweite', attachments: [] },
      { createdAt: new Date('2026-10-08T10:00:00Z'), authorTag: 'anna', content: 'erste', attachments: ['a.png'] },
      { createdAt: new Date('2026-10-08T10:02:00Z'), authorTag: null, content: null, attachments: [] },
    ]);
    expect(text.split('\n')).toEqual([
      '[2026-10-08 10:00:00 UTC] anna: erste [Anhänge: a.png]',
      '[2026-10-08 10:01:00 UTC] bernd: zweite',
      '[2026-10-08 10:02:00 UTC] Unbekannt: [Inhalt unbekannt]',
    ]);
  });
});

describe('Mitglieder & Moderation', () => {
  it('warnt bei neuen Accounts', () => {
    const young = memberJoinedEmbed({ locale: 'de', user: anna, accountCreated: new Date('2026-10-06T00:00:00Z'), memberCount: 42, now });
    const old = memberJoinedEmbed({ locale: 'de', user: anna, accountCreated: new Date('2020-01-01T00:00:00Z'), memberCount: 42, now });
    expect(young.description).toContain('Neuer Account');
    expect(old.description).not.toContain('Neuer Account');
    expect(young.fields?.[1]?.value).toBe('42');
  });

  it('Ban mit Moderator und Grund, ohne Grund mit Hinweis', () => {
    const e = moderationEmbed({ locale: 'de', kind: 'ban', user: anna, moderator: mod, reason: null, now });
    expect(e.title).toContain('gebannt');
    expect(e.fields?.map((f) => f.name)).toEqual(['Durch', 'Grund']);
    expect(e.fields?.[1]?.value).toBe('Kein Grund angegeben');
  });

  it('Rollen-Änderung listet hinzugefügte und entfernte Rollen', () => {
    const e = rolesChangedEmbed({ locale: 'de', user: anna, added: ['5'], removed: ['6', '7'], moderator: null, now });
    expect(e.fields?.map((f) => f.value)).toEqual(['<@&5>', '<@&6> <@&7>']);
  });

  it('Timeout gesetzt vs. aufgehoben', () => {
    const set = timeoutEmbed({ locale: 'de', user: anna, until: new Date('2026-10-08T11:00:00Z'), moderator: mod, reason: 'Spam', now });
    const removed = timeoutEmbed({ locale: 'de', user: anna, until: null, moderator: mod, reason: 'egal', now });
    expect(set.title).toContain('Timeout vergeben');
    expect(set.fields?.some((f) => f.value === 'Spam')).toBe(true);
    expect(removed.title).toContain('aufgehoben');
    expect(removed.fields?.some((f) => f.name === 'Grund')).toBe(false);
  });
});

describe('Kanäle, Rollen, Server', () => {
  it('Kanal-Diff erkennt nur echte Änderungen', () => {
    const a = { name: 'chat', topic: null, nsfw: false, slowmode: 0, parentId: null };
    expect(diffChannel('de', a, { ...a })).toEqual([]);
    const changes = diffChannel('de', a, { ...a, name: 'plaudern', nsfw: true, slowmode: 10 });
    expect(changes.map((c) => c.key)).toEqual(['log.change.name', 'log.change.nsfw', 'log.change.slowmode']);
    expect(changes[1]).toMatchObject({ before: 'Nein', after: 'Ja' });
  });

  it('Rollen-Diff zeigt Farben als Hex', () => {
    const a = { name: 'Mod', color: 0xff0000, hoist: false, mentionable: false, permissions: 'KickMembers' };
    const [change] = diffRole('en', a, { ...a, color: 0x00ff00 });
    expect(change).toEqual({ key: 'log.change.color', before: '#ff0000', after: '#00ff00' });
  });

  it('Server-Diff', () => {
    const a = { name: 'Alt', icon: null, banner: null, description: null, verificationLevel: 1 };
    expect(diffGuild(a, { ...a, name: 'Neu', icon: 'abc' }).map((c) => c.key)).toEqual(['log.change.name', 'log.change.icon']);
  });

  it('Einladung: unbegrenzt / nie', () => {
    const e = inviteEmbed({ locale: 'de', kind: 'created', code: 'abc', channelId: '1', inviter: anna, maxUses: 0, expiresAt: null, now });
    expect(e.fields?.map((f) => f.value)).toEqual(['`abc`', '<#1>', 'unbegrenzt', 'nie', '<@111111111111111111> · `anna`']);
  });
});

describe('Voice', () => {
  it('Join, Leave, Wechsel und „keine Änderung“', () => {
    expect(voiceEmbed({ locale: 'de', user: anna, from: null, to: '1', now })?.title).toContain('betreten');
    expect(voiceEmbed({ locale: 'de', user: anna, from: '1', to: null, now })?.title).toContain('verlassen');
    expect(voiceEmbed({ locale: 'de', user: anna, from: '1', to: '2', now })?.title).toContain('gewechselt');
    expect(voiceEmbed({ locale: 'de', user: anna, from: '1', to: '1', now })).toBeNull();
  });
});
