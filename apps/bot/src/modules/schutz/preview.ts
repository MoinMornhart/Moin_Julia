import type { APIEmbed } from 'discord.js';
import { parseSchutzConfig, t } from '@moin/shared';
import { verifyPanel } from './index.js';

/** Beispiel-Meldungen fürs Bauprotokoll (Namen erfunden). Spiegelt die Texte aus index.ts. */
export function previewEmbeds(): { caption: string; embeds: APIEmbed[] }[] {
  const until = Math.floor(Date.UTC(2026, 9, 8, 19, 57) / 1000);
  const panel = verifyPanel('de', parseSchutzConfig({}));
  return [
    {
      caption: 'Alarm-Kanal: Raid erkannt und Anti-Nuke ausgelöst (mit Rollen-Ping @Moderator)',
      embeds: [
        {
          color: 0xff5d7a,
          title: t('de', 'schutz.alert.raidTitle'),
          description: t('de', 'schutz.alert.raidText', { joins: 10, seconds: 10, until: `<t:${until}:t>` }),
        },
        {
          color: 0xff5d7a,
          title: t('de', 'schutz.alert.nukeTitle'),
          description: [
            t('de', 'schutz.alert.nukeText', { user: '<@1>', count: 3, kind: t('de', 'schutz.kind.channelDelete'), seconds: 15 }),
            t('de', 'schutz.alert.nukeAction', { action: t('de', 'schutz.action.strip_roles') }),
          ].join('\n\n'),
        },
      ],
    },
    { caption: 'Verifizierungs-Panel (darunter der grüne Button „✅ Verifizieren“)', embeds: [panel.embeds[0]!.toJSON()] },
  ];
}

export const previewNames: Record<string, string> = { '1': 'gekaperter.admin' };
