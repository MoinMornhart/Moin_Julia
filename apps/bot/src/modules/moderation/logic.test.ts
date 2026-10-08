import { describe, expect, it } from 'vitest';
import { escalationFor, formatDuration, moderationConfigSchema, parseDuration } from '@moin/shared';
import {
  capsStats,
  caseEmbed,
  desiredNativeRules,
  dmText,
  hierarchyProblem,
  isCapsViolation,
  ruleKeyFromName,
  SpamTracker,
  warnsEmbed,
  type CaseData,
} from './logic.js';

const base: CaseData = {
  number: 7, type: 'WARN', userId: '1', userTag: 'anna', moderatorId: '2', moderatorTag: 'max',
  reason: 'Spam', durationSec: null, active: true, source: 'command', createdAt: new Date('2026-10-08T10:00:00Z'),
};

describe('Dauer', () => {
  it('versteht gängige Schreibweisen', () => {
    expect(parseDuration('10m')).toBe(600_000);
    expect(parseDuration('1h30m')).toBe(5_400_000);
    expect(parseDuration('2d')).toBe(172_800_000);
    expect(parseDuration('1w')).toBe(604_800_000);
    expect(parseDuration('1 h 30 min')).toBe(5_400_000);
    expect(parseDuration('3std')).toBe(10_800_000);
  });
  it('lehnt Unsinn ab', () => {
    for (const bad of ['', 'abc', '10', '5x', 'h1', '0m']) expect(parseDuration(bad)).toBeNull();
  });
  it('formatiert lesbar', () => {
    expect(formatDuration(5_400_000, 'de')).toBe('1 Std. 30 Min.');
    expect(formatDuration(172_800_000, 'en')).toBe('2 days');
    expect(formatDuration(30_000, 'de')).toBe('30 Sek.');
  });
});

describe('Eskalation', () => {
  const { escalation } = moderationConfigSchema.parse({});
  it('Standard: 3 Warns → Timeout 60 Min., 5 → Kick', () => {
    expect(escalationFor(escalation, 2)).toBeNull();
    expect(escalationFor(escalation, 3)).toMatchObject({ action: 'timeout', durationMin: 60 });
    expect(escalationFor(escalation, 4)).toBeNull();
    expect(escalationFor(escalation, 5)).toMatchObject({ action: 'kick' });
  });
});

describe('Rangprüfung', () => {
  const ok = { moderatorId: 'm', targetId: 't', ownerId: 'o', botId: 'b', moderatorTop: 10, targetTop: 5, botTop: 20 };
  it('erlaubt den Normalfall', () => expect(hierarchyProblem(ok)).toBeNull());
  it('verbietet sich selbst, den Bot und den Owner', () => {
    expect(hierarchyProblem({ ...ok, targetId: 'm' })).toBe('mod.err.self');
    expect(hierarchyProblem({ ...ok, targetId: 'b' })).toBe('mod.err.bot');
    expect(hierarchyProblem({ ...ok, targetId: 'o' })).toBe('mod.err.owner');
  });
  it('gleich hohe oder höhere Rolle', () => {
    expect(hierarchyProblem({ ...ok, targetTop: 10 })).toBe('mod.err.hierarchy');
    expect(hierarchyProblem({ ...ok, targetTop: 25, moderatorTop: 30 })).toBe('mod.err.botHierarchy');
  });
  it('der Owner darf auch höhere Rollen moderieren, aber nicht über dem Bot', () => {
    expect(hierarchyProblem({ ...ok, moderatorId: 'o', targetTop: 15 })).toBeNull();
    expect(hierarchyProblem({ ...ok, moderatorId: 'o', targetTop: 25 })).toBe('mod.err.botHierarchy');
  });
  it('Bann per ID ohne Mitgliedschaft', () => expect(hierarchyProblem({ ...ok, targetTop: null })).toBeNull());
});

describe('Fall-Karten', () => {
  it('Verwarnung mit Grund', () => {
    const e = caseEmbed('de', base);
    expect(e.title).toBe('⚠️ Fall #7 · Verwarnung');
    expect(e.fields?.map((f) => f.name)).toEqual(['Mitglied', 'Moderator', 'Grund']);
  });
  it('Timeout zeigt Dauer, Automod im Footer', () => {
    const e = caseEmbed('de', { ...base, type: 'TIMEOUT', durationSec: 3600, source: 'automod' });
    expect(e.fields?.find((f) => f.name === 'Dauer')?.value).toBe('1 Std.');
    expect(e.footer?.text).toContain('Automod');
  });
  it('zurückgenommene Verwarnung ist grau und markiert', () => {
    const e = caseEmbed('en', { ...base, active: false, reason: null });
    expect(e.title).toContain('pardoned');
    expect(e.color).toBe(0x8c96ba);
    expect(e.fields?.at(-1)?.value).toBe('No reason given');
  });
  it('Verwarnungsliste', () => {
    expect(warnsEmbed('de', 'anna', [], 0).description).toContain('keine aktiven');
    const e = warnsEmbed('de', 'anna', [base, { ...base, number: 8, active: false }], 1);
    expect(e.description?.split('\n')).toHaveLength(2);
    expect(e.footer?.text).toBe('Aktiv: 1 · Insgesamt: 2');
  });
  it('DM-Text', () => {
    expect(dmText('de', 'TIMEOUT', 'Moin', 'Spam', 600_000)).toBe('Du bist auf **Moin** für **10 Min.** im Timeout.\nGrund: Spam');
    expect(dmText('en', 'BAN', 'Moin', null)).toBe('You have been banned from **Moin**.');
  });
});

describe('Spam & Caps', () => {
  it('zählt Nachrichten im Zeitfenster', () => {
    const tracker = new SpamTracker();
    expect(tracker.hit('u', 0, 5000)).toBe(1);
    expect(tracker.hit('u', 1000, 5000)).toBe(2);
    expect(tracker.hit('u', 4000, 5000)).toBe(3);
    expect(tracker.hit('u', 7000, 5000)).toBe(2); // 0 und 1000 sind raus
    tracker.reset('u');
    expect(tracker.hit('u', 8000, 5000)).toBe(1);
  });
  it('Caps-Anteil ignoriert Erwähnungen, Emojis und Links', () => {
    expect(capsStats('HALLO').ratio).toBe(1);
    expect(capsStats('<@123> hallo <:LUL:456> https://EXAMPLE.COM').ratio).toBe(0);
    expect(capsStats('ÄÖÜ äöü').ratio).toBe(0.5);
  });
  it('Caps-Verstoß erst ab Mindestlänge', () => {
    expect(isCapsViolation('OK', 12, 75)).toBe(false);
    expect(isCapsViolation('WARUM SCHREIBT HIER KEINER', 12, 75)).toBe(true);
    expect(isCapsViolation('Warum schreibt hier keiner', 12, 75)).toBe(false);
  });
});

describe('Discord-AutoMod-Regeln', () => {
  it('nichts aktiviert → keine Regeln', () => {
    expect(desiredNativeRules('de', moderationConfigSchema.parse({}).automod)).toEqual([]);
  });
  it('baut Regeln aus den Einstellungen', () => {
    const { automod } = moderationConfigSchema.parse({
      automod: {
        badWords: { enabled: true, words: ['doof', ' doof ', 'blöd*'] },
        links: { enabled: true, allowDomains: ['youtube.com', 'https://twitch.tv'] },
        invites: { enabled: true },
        mentionSpam: { enabled: true, limit: 4 },
      },
    });
    const rules = desiredNativeRules('de', automod);
    expect(rules.map((r) => r.key)).toEqual(['badWords', 'links', 'invites', 'mentionSpam']);
    expect(rules[0]!.keywordFilter).toEqual(['doof', 'blöd*']);
    expect(rules[1]!.allowList).toEqual(['*youtube.com*', '*twitch.tv*']);
    expect(rules[3]!.mentionTotalLimit).toBe(4);
  });
  it('leere Wortliste erzeugt keine Regel', () => {
    const { automod } = moderationConfigSchema.parse({ automod: { badWords: { enabled: true, words: [] } } });
    expect(desiredNativeRules('de', automod)).toEqual([]);
  });
  it('erkennt eigene Regeln in beiden Sprachen, fremde nicht', () => {
    expect(ruleKeyFromName('Moin_Julia · Schimpfwörter')).toBe('badWords');
    expect(ruleKeyFromName('Moin_Julia · Mention spam')).toBe('mentionSpam');
    expect(ruleKeyFromName('Block bad words')).toBeNull();
  });
});
