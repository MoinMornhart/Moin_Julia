/**
 * Felder, die nur der Instanz-Admin ändern darf (Bug-Hunting Runde 3): Sie erlauben dem Bot Zugriffe ins
 * Heimnetz der Instanz (SSRF). Gilt für Dashboard-Formulare, Vorlagen-Import, Sicherungen und Julias Einstellungs-Werkzeug.
 */
export const INSTANCE_ONLY_FIELDS: Record<string, readonly string[]> = {
  julia: ['customBaseUrl'],
  musik: ['allowPrivateUrls'],
};

/** Gesperrt für alle außer dem Instanz-Admin – plus alles, was nach Adresse/Schlüssel aussieht (Julia-Werkzeug) */
export function isRestrictedSettingField(moduleId: string, key: string): boolean {
  return (INSTANCE_ONLY_FIELDS[moduleId] ?? []).includes(key) || /(url|key|token|secret|password|passwort|webhook|endpoint)/i.test(key);
}

/** Beim Übernehmen (Import, Sicherung): geschützte Felder behalten den bisherigen Wert */
export function protectInstanceFields(moduleId: string, next: unknown, current: unknown): unknown {
  const fields = INSTANCE_ONLY_FIELDS[moduleId];
  if (!fields?.length || !next || typeof next !== 'object') return next;
  const out = { ...(next as Record<string, unknown>) };
  const cur = current && typeof current === 'object' ? (current as Record<string, unknown>) : {};
  for (const f of fields) {
    if (f in cur) out[f] = cur[f];
    else delete out[f];
  }
  return out;
}
