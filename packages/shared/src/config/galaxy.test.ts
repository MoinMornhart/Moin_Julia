import { describe, expect, it } from 'vitest';
import { parseAutomodRule, parseBotMessage } from './galaxy.js';

describe('Nachrichten des alten Bots auswerten', () => {
  it('klassisches Embed mit Feldern, Autor, Fußzeile, Menü und Knöpfen (ohne Link-Knöpfe)', () => {
    const m = parseBotMessage({
      embeds: [{ author: { name: '🎫 Support' }, description: 'Wähle eine Kategorie.', color: 0x5865f2, fields: [{ name: 'Zeiten', value: 'Mo–Fr' }], footer: { text: 'Team Moin' } }],
      components: [
        { type: 1, components: [{ type: 3, options: [{ label: 'Frage' }, { label: 'Bewerbung' }] }] },
        { type: 1, components: [{ type: 2, style: 1, label: 'Bug melden' }, { type: 2, style: 5, label: 'Website' }, { type: 2, style: 1, label: 'Frage' }] },
      ],
    });
    expect(m).toEqual({
      title: '🎫 Support',
      description: 'Wähle eine Kategorie.\n\n**Zeiten**\nMo–Fr\n\n_Team Moin_',
      color: 0x5865f2,
      options: ['Frage', 'Bewerbung', 'Bug melden'],
      componentsV2: false,
    });
  });

  it('neues Discord-Format (Components V2): Texte in Containern und Abschnitten', () => {
    const m = parseBotMessage({
      flags: 1 << 15,
      components: [
        {
          type: 17,
          accent_color: 0xff7a59,
          components: [
            { type: 10, content: '## Tickets\nKlick unten auf einen Grund.' },
            { type: 9, components: [{ type: 10, content: 'Antwort meist in 1 Stunde.' }], accessory: { type: 2, style: 1, label: 'Ticket öffnen' } },
            { type: 1, components: [{ type: 3, options: [{ label: 'Support' }, { label: 'Partnerschaft' }] }] },
          ],
        },
      ],
    });
    expect(m).toEqual({
      title: 'Tickets',
      description: 'Klick unten auf einen Grund.\n\nAntwort meist in 1 Stunde.',
      color: 0xff7a59,
      options: ['Ticket öffnen', 'Support', 'Partnerschaft'],
      componentsV2: true,
    });
  });

  it('Text + Knöpfe ohne Embed zählt als Panel, reiner Text nicht', () => {
    expect(parseBotMessage({ content: '**Rollen**\nWähle deine Rollen', components: [{ type: 1, components: [{ type: 2, style: 2, label: 'Gamer' }] }] })).toMatchObject({ title: 'Rollen', options: ['Gamer'] });
    expect(parseBotMessage({ content: 'Hallo!' })).toBeNull();
  });
});

describe('AutoMod-Regeln', () => {
  it('Wortliste mit Ausnahmen und Regex', () => {
    const r = parseAutomodRule({ id: '1', name: 'Bad Words', creator_id: 'g', trigger_type: 1, trigger_metadata: { keyword_filter: ['*scam*', ''], regex_patterns: ['fr[e3]{2}'], allow_list: ['scampi'] } });
    expect(r).toMatchObject({ kind: 'keywords', keywords: ['*scam*'], regexCount: 1, allowList: ['scampi'], importable: true, typeLabel: 'Wortliste' });
  });
  it('nur Regex → nichts zu übernehmen; Spam/Presets sind „other“', () => {
    expect(parseAutomodRule({ id: '2', name: 'Regex', creator_id: 'g', trigger_type: 1, trigger_metadata: { regex_patterns: ['x+'] } }).importable).toBe(false);
    expect(parseAutomodRule({ id: '3', name: 'Spam', creator_id: 'g', trigger_type: 3 })).toMatchObject({ kind: 'other', typeLabel: 'Spam-Erkennung', importable: false });
    expect(parseAutomodRule({ id: '4', name: 'Mentions', creator_id: 'g', trigger_type: 5, trigger_metadata: { mention_total_limit: 5 }, enabled: false })).toMatchObject({ importable: true, enabled: false });
  });
});
