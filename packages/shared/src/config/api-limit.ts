/**
 * API-Kostenlimit der Instanz (Wunsch Philip, 15.10.): z. B. „höchstens 80 € im Monat“ für den KI-Schlüssel des
 * Betreibers. Zählt nur Anfragen über den Schlüssel der Instanz – Server mit eigenem Schlüssel zahlen selbst.
 * Ist das Limit erreicht, antwortet Julia (mit diesem Schlüssel) bis zum nächsten Monat nicht mehr.
 * Anthropic rechnet in US-Dollar ab; umgerechnet wird mit einem festen, vorsichtigen Kurs.
 */

/** 1 € = so viele US-Dollar (lieber etwas höher angesetzt – dann greift das Limit eher zu früh als zu spät) */
export const USD_PER_EUR = 1.2;

/** Warnung per DM an den Instanz-Admin ab diesem Anteil */
export const API_LIMIT_WARN_PERCENT = 80;

/** Einstellung „apiLimitEur“ → Zahl (0 = kein Limit) */
export function parseApiLimitEur(raw: string | null | undefined): number {
  const n = Number.parseFloat(String(raw ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n * 100) / 100, 100_000) : 0;
}

/** Limit in Mikro-Dollar (wie die gebuchten Kosten) */
export function apiLimitMicroUsd(limitEur: number): number {
  return Math.round(limitEur * USD_PER_EUR * 1_000_000);
}

export function apiLimitReached(spentMicroUsd: number, limitEur: number): boolean {
  return limitEur > 0 && spentMicroUsd >= apiLimitMicroUsd(limitEur);
}

/** 0–100 (gerundet) */
export function apiLimitPercent(spentMicroUsd: number, limitEur: number): number {
  return limitEur > 0 ? Math.min(100, Math.floor((spentMicroUsd / apiLimitMicroUsd(limitEur)) * 100)) : 0;
}

/** Mikro-Dollar → „12,34 €“ (umgerechnet) */
export function eurText(microUsd: number): string {
  return `${(microUsd / 1_000_000 / USD_PER_EUR).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
