/**
 * Betreiber-Zugang (Support-Zugang): Der Instanz-Admin (Bot-Betreiber) kommt auf einen fremden Server NUR, wenn
 * Server-Owner oder Admin es erlauben (Issue #13 – vorher gab es einen Generalschlüssel ohne Zustimmung).
 * - Umfang: „lesen“ (Kanäle im Dashboard mitlesen) und/oder „dashboard“ (Einstellungen wie ein Admin, nie Owner-Bereich)
 * - Dauer: 1 h, 24 h, 7 Tage oder für immer; jederzeit entziehen; Betreiber sperren
 * - Anfrage mit Begründung (Dashboard → Alle Server) → Nachricht mit Knöpfen im Log-Kanal bzw. per DM an den Owner
 * Sprachkanäle: Der Bot hört NICHT mit – der Betreiber tritt per Einladung selbst sichtbar bei.
 */
export const supportAccessKey = (guildId: string) => `moin:support:${guildId}`;
export const supportBlockKey = (guildId: string) => `moin:support:block:${guildId}`;
export const supportRequestKey = (guildId: string) => `moin:support:request:${guildId}`;

export const SUPPORT_SCOPES = ['lesen', 'dashboard'] as const;
export type SupportScope = (typeof SUPPORT_SCOPES)[number];
export const SUPPORT_SCOPE_LABELS: Record<SupportScope, string> = { lesen: '👀 Kanäle mitlesen', dashboard: '⚙️ Dashboard verwalten (wie ein Admin)' };

export interface SupportAccess {
  /** Wer erlaubt hat */
  by: string;
  byName: string;
  /** ms */
  since: number;
  /** ms; null = für immer */
  until: number | null;
  /** Was erlaubt ist (ältere Einträge ohne Angabe = nur lesen) */
  scopes?: SupportScope[];
  /** Begründung des Betreibers aus der Anfrage */
  reason?: string;
}

/** Anfrage des Betreibers (wartet auf Owner/Admin) */
export interface SupportRequest {
  by: string;
  byName: string;
  reason: string;
  scopes: SupportScope[];
  at: number;
}

export const SUPPORT_DURATIONS = { '1h': 3_600_000, '24h': 86_400_000, '7d': 7 * 86_400_000, immer: null } as const;
export type SupportDuration = keyof typeof SUPPORT_DURATIONS;

/** Eine Anfrage pro Server höchstens alle 6 Stunden (gegen Nerven) */
export const SUPPORT_REQUEST_COOLDOWN_MS = 6 * 3_600_000;

export function supportActive(access: SupportAccess | null | undefined, now = Date.now()): boolean {
  return !!access && (access.until === null || access.until > now);
}

export function supportScopes(access: SupportAccess | null | undefined): SupportScope[] {
  if (!access) return [];
  return access.scopes?.length ? access.scopes.filter((s): s is SupportScope => (SUPPORT_SCOPES as readonly string[]).includes(s)) : ['lesen'];
}

/** Ist dieser Umfang gerade erlaubt? */
export function supportAllows(access: SupportAccess | null | undefined, scope: SupportScope, now = Date.now()): boolean {
  return supportActive(access, now) && supportScopes(access).includes(scope);
}

/** Umfang aus Formular/Knopf: nur bekannte Werte, mindestens einer */
export function parseSupportScopes(raw: unknown): SupportScope[] | null {
  const list = (Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[,+ ]+/) : []).filter((s): s is SupportScope => (SUPPORT_SCOPES as readonly string[]).includes(s as string));
  const unique = [...new Set(list)];
  return unique.length ? unique : null;
}

/** Begründung säubern (Pflicht, 10–500 Zeichen, keine Erwähnungen) */
export function cleanSupportReason(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/@(everyone|here)/gi, '@​$1').replace(/<@[!&]?\d+>/g, '@jemand').replace(/\s+/g, ' ').trim();
  return text.length >= 10 ? text.slice(0, 500) : null;
}

/** „bis 14.10., 18:00“ bzw. „für immer“ */
export function supportUntilText(access: SupportAccess): string {
  return access.until === null
    ? 'für immer (bis zum Widerruf)'
    : `bis ${new Date(access.until).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
}

export function supportScopesText(access: SupportAccess | SupportRequest): string {
  const scopes = 'until' in access ? supportScopes(access) : access.scopes;
  return scopes.map((s) => SUPPORT_SCOPE_LABELS[s]).join(' + ');
}
