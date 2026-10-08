import { describe, expect, it } from 'vitest';
import { formFieldSchema, validateAnswers } from './forms.js';
import { applicationBlocker, fillTeamText, positionSchema, snowflakeDate } from './team.js';

const now = new Date('2026-10-08T12:00:00Z');
const day = 86_400_000;
// Discord-ID von 2020 (Account alt genug)
const OLD_USER = '700000000000000001';

describe('Bewerben erlaubt?', () => {
  const pos = positionSchema.parse({ title: 'Moderator', cooldownDays: 14, minAccountDays: 30, minMemberDays: 7 });
  const ctx = { userId: OLD_USER, joinedAt: new Date(now.getTime() - 30 * day), now, previous: [] };
  it('alles erfüllt → frei', () => {
    expect(applicationBlocker(pos, ctx)).toBeNull();
  });
  it('geschlossen, schon offen, Wartezeit nach Absage', () => {
    expect(applicationBlocker({ ...pos, open: false }, ctx)).toContain('geschlossen');
    expect(applicationBlocker(pos, { ...ctx, previous: [{ status: 'pending', decidedAt: null }] })).toContain('schon beworben');
    expect(applicationBlocker(pos, { ...ctx, previous: [{ status: 'rejected', decidedAt: new Date(now.getTime() - 3 * day) }] })).toContain('wieder bewerben');
    expect(applicationBlocker(pos, { ...ctx, previous: [{ status: 'rejected', decidedAt: new Date(now.getTime() - 20 * day) }] })).toBeNull();
  });
  it('zu neuer Account, zu kurz auf dem Server, kein Mitglied', () => {
    const fresh = String((BigInt(now.getTime() - 2 * day - 1420070400000) << 22n) + 1n);
    expect(snowflakeDate(fresh).getTime()).toBeGreaterThan(now.getTime() - 3 * day);
    expect(applicationBlocker(pos, { ...ctx, userId: fresh })).toContain('Account');
    expect(applicationBlocker(pos, { ...ctx, joinedAt: new Date(now.getTime() - 2 * day) })).toContain('7 Tage');
    expect(applicationBlocker(pos, { ...ctx, joinedAt: null })).toContain('Mitglied');
  });
  it('Platzhalter in DM-Texten', () => {
    expect(fillTeamText('{user} – {position} auf {server}: {reason}', { user: 'Anna', position: 'Mod', server: 'Moin' })).toBe('Anna – Mod auf Moin: –');
  });
});

describe('Formular-Antworten prüfen', () => {
  const fields = [
    formFieldSchema.parse({ id: 'f1', label: 'Alter', type: 'short', maxLength: 3 }),
    formFieldSchema.parse({ id: 'f2', label: 'Erfahrung', type: 'long', minLength: 10, required: false }),
    formFieldSchema.parse({ id: 'f3', label: 'Bereich', type: 'select', options: [{ label: 'Discord' }, { label: 'Twitch' }] }),
  ];
  it('gültig, optionale leere Felder fallen weg', () => {
    const r = validateAnswers(fields, { f1: '19', f2: '', f3: 'Twitch' });
    expect(r).toEqual({ ok: true, answers: [{ fieldId: 'f1', label: 'Alter', value: '19' }, { fieldId: 'f3', label: 'Bereich', value: 'Twitch' }] });
  });
  it('Pflicht, Länge, unbekannte Option', () => {
    expect(validateAnswers(fields, { f3: 'Twitch' })).toMatchObject({ ok: false });
    expect(validateAnswers(fields, { f1: '1234', f3: 'Twitch' })).toMatchObject({ ok: false });
    expect(validateAnswers(fields, { f1: '19', f2: 'kurz', f3: 'Twitch' })).toMatchObject({ ok: false });
    expect(validateAnswers(fields, { f1: '19', f3: 'YouTube' })).toMatchObject({ ok: false });
  });
  it('Auswahl ohne Optionen ist kein gültiges Feld', () => {
    expect(formFieldSchema.safeParse({ id: 'x', label: 'Leer', type: 'select' }).success).toBe(false);
  });
});
