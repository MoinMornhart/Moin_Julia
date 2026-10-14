import { describe, expect, it } from 'vitest';
import { formFieldSchema } from './forms.js';
import { parseQuestions, questionsToFields } from './question-import.js';

const TEXT = `Bewerbung als Moderator 🛡️
Bitte beantworte alle Fragen ehrlich!

1. Wie heißt du?
2. Wie alt bist du?
3. Warum möchtest du Moderator werden?
4. Hast du schon Erfahrung als Moderator?
5. Wann bist du meistens online? (morgens / nachmittags / abends)
6. Welche Bereiche interessieren dich?
- Discord
- Twitch
- Minecraft
7. Ab wann kannst du anfangen?
8. Lade einen Screenshot deiner Discord-Einstellungen hoch
Discord-Name:
Danke für deine Bewerbung!`;

describe('Bewerbungsfragen aus Text', () => {
  it('erkennt Fragen und Feldarten', () => {
    const q = parseQuestions(TEXT);
    expect(q.map((x) => [x.question, x.kind])).toEqual([
      ['Wie heißt du?', 'short'],
      ['Wie alt bist du?', 'number'],
      ['Warum möchtest du Moderator werden?', 'long'],
      ['Hast du schon Erfahrung als Moderator?', 'yesno'],
      ['Wann bist du meistens online?', 'select'],
      ['Welche Bereiche interessieren dich?', 'select'],
      ['Ab wann kannst du anfangen?', 'date'],
      ['Lade einen Screenshot deiner Discord-Einstellungen hoch', 'file'],
      ['Discord-Name', 'short'],
    ]);
    expect(q[4]!.options).toEqual(['morgens', 'nachmittags', 'abends']);
    expect(q[5]!.options).toEqual(['Discord', 'Twitch', 'Minecraft']);
  });

  it('(Ja/Nein) in Klammern und Ja/Nein-Optionen werden zu Ja/Nein', () => {
    expect(parseQuestions('Bist du über 16? (Ja/Nein)')[0]).toMatchObject({ question: 'Bist du über 16?', kind: 'yesno' });
    expect(parseQuestions('Darfst du Voice nutzen?\n- Ja\n- Nein')[0]).toMatchObject({ kind: 'yesno', options: [] });
  });

  it('erzeugt gültige Formularfelder (lange Fragen gekürzt, ganze Frage im Platzhalter)', () => {
    const fields = questionsToFields(parseQuestions(`${TEXT}\nWas würdest du tun, wenn sich zwei Mitglieder im Voice-Chat lautstark streiten?`));
    for (const f of fields) expect(formFieldSchema.safeParse(f).success, f.label).toBe(true);
    const long = fields.at(-1)!;
    expect(long.label.length).toBeLessThanOrEqual(45);
    expect(long.placeholder).toContain('lautstark streiten');
    expect(fields.find((f) => f.label === 'Hast du schon Erfahrung als Moderator?')!.options.map((o) => o.label)).toEqual(['Ja', 'Nein']);
    expect(new Set(fields.map((f) => f.id)).size).toBe(fields.length);
  });
});

describe('Pflichtfragen – Runde 3', () => {
  it('ohne Markierung sind alle Fragen Pflicht', () => {
    expect(parseQuestions('Wie heißt du?\nWarum willst du Mod werden?').every((q) => q.required)).toBe(true);
  });
  it('mit * sind nur die markierten Pflicht, (optional) ist freiwillig', () => {
    const qs = parseQuestions('Wie heißt du? *\nWas spielst du gern?\nHast du Discord-Erfahrung? (optional)');
    expect(qs.map((q) => q.required)).toEqual([true, false, false]);
    expect(qs[2]!.question).not.toContain('optional');
  });
  it('„Erzähl was über dich“ wird ein langes Feld', () => {
    expect(parseQuestions('Schreib etwas über dich:')[0]?.kind).toBe('long');
  });
});
