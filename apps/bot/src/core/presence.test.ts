import { ActivityType } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { parsePresence } from '@moin/shared';
import { toPresenceData } from './presence.js';

describe('Bot-Status aus dem Dashboard', () => {
  const ctx = { version: '0.9.1', servers: 3 };
  it('Standard: online mit eigenem Status „Moin! · v…“', () => {
    const p = toPresenceData(parsePresence(null), ctx);
    expect(p.status).toBe('online');
    expect(p.activities?.[0]).toMatchObject({ type: ActivityType.Custom, name: 'Moin! · v0.9.1', state: 'Moin! · v0.9.1' });
  });
  it('ersetzt Platzhalter und setzt die Aktivitäts-Art', () => {
    const p = toPresenceData(parsePresence(JSON.stringify({ status: 'dnd', type: 'watching', text: '{server} Server' })), ctx);
    expect(p.status).toBe('dnd');
    expect(p.activities?.[0]).toMatchObject({ type: ActivityType.Watching, name: '3 Server' });
  });
  it('„Keine Aktivität“ und kaputte Werte', () => {
    expect(toPresenceData(parsePresence(JSON.stringify({ type: 'none' })), ctx).activities).toEqual([]);
    expect(toPresenceData(parsePresence('{kaputt'), ctx).status).toBe('online');
  });
});
