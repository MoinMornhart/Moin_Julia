import type { APIEmbed } from 'discord.js';
import { caseEmbed, warnsEmbed, type CaseData } from './logic.js';

/** Beispiel-Meldungen fürs Bauprotokoll. Alle Namen sind erfunden. */
export function previewEmbeds(): { caption: string; embeds: APIEmbed[] }[] {
  const at = (h: number) => new Date(Date.UTC(2026, 9, 8, h, 15));
  const base: CaseData = {
    number: 41, type: 'WARN', userId: '1', userTag: 'spammer.lukas', moderatorId: '2', moderatorTag: 'moderator.max',
    reason: 'Werbung für fremden Server im #allgemein', durationSec: null, active: true, source: 'command', createdAt: at(17),
  };
  const third: CaseData = { ...base, number: 43, reason: 'Beleidigung im Stream-Chat', createdAt: at(19) };
  const escalation: CaseData = {
    ...base, number: 44, type: 'TIMEOUT', moderatorId: '9', moderatorTag: 'Moin_Julia', reason: 'Automatische Eskalation: 3 × Verwarnung',
    durationSec: 3600, source: 'escalation', createdAt: at(19),
  };
  return [
    { caption: 'Mod-Log: dritte Verwarnung löst automatisch einen Timeout aus', embeds: [caseEmbed('de', third), caseEmbed('de', escalation)] },
    {
      caption: 'Bann mit Grund · /warns zeigt aktive und zurückgenommene Verwarnungen',
      embeds: [
        caseEmbed('de', { ...base, number: 45, type: 'BAN', userId: '3', userTag: 'free.nitro.bot', reason: 'Phishing-Links', createdAt: at(20) }),
        warnsEmbed('de', 'spammer.lukas', [third, { ...base, number: 42, reason: 'Automod: Spam (8 Nachrichten in 5 s)', source: 'automod' }, { ...base, active: false }], 2),
      ],
    },
  ];
}

export const previewNames: Record<string, string> = { '1': 'spammer.lukas', '2': 'moderator.max', '3': 'free.nitro.bot', '9': 'Moin_Julia' };
