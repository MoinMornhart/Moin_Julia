/**
 * Support-Zugang (Wunsch Philip, 13./14.10.): Server-Owner oder Admin erlaubt dem Instanz-Admin per
 * /moin support-zugang, im Dashboard die Kanäle des Servers mitzulesen – für 1 h, 24 h, 7 Tage oder für immer.
 * Jederzeit widerrufbar, Hinweis im Log-Kanal, jeder Zugriff wird dort vermerkt.
 * Sprachkanäle: Der Bot hört NICHT mit – der Instanz-Admin tritt per Einladung selbst sichtbar bei.
 */
export const supportAccessKey = (guildId: string) => `moin:support:${guildId}`;

export interface SupportAccess {
  /** Wer erlaubt hat */
  by: string;
  byName: string;
  /** ms */
  since: number;
  /** ms; null = für immer */
  until: number | null;
}

export const SUPPORT_DURATIONS = { '1h': 3_600_000, '24h': 86_400_000, '7d': 7 * 86_400_000, immer: null } as const;
export type SupportDuration = keyof typeof SUPPORT_DURATIONS;

export function supportActive(access: SupportAccess | null | undefined, now = Date.now()): boolean {
  return !!access && (access.until === null || access.until > now);
}

/** „bis 14.10., 18:00“ bzw. „für immer“ */
export function supportUntilText(access: SupportAccess): string {
  return access.until === null
    ? 'für immer (bis zum Widerruf)'
    : `bis ${new Date(access.until).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
}
