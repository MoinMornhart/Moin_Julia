import { isNewerVersion } from '../version.js';

export interface UpdateStatusFile {
  state: 'running' | 'success' | 'failed';
  from: string;
  to: string;
  at: string;
}

/** Länger „läuft“ als das = hängen geblieben (z. B. Host neu gestartet, Update im Terminal parallel) */
export const UPDATE_STALE_MS = 45 * 60_000;

/**
 * Status aus der Datei, aber mit gesundem Menschenverstand (Wunsch Philip 13.10.: „Update läuft …“ blieb hängen):
 * Läuft schon eine neuere Version als die, von der das Update gestartet ist → es ist offensichtlich durch.
 * Steht „läuft“ zu lange → hängen geblieben, Knopf wieder frei.
 */
export function effectiveUpdateStatus(status: UpdateStatusFile | null, current: string, now = Date.now()): { status: UpdateStatusFile | null; stale: boolean } {
  if (!status || status.state !== 'running') return { status, stale: false };
  if (status.from && current !== status.from && isNewerVersion(current, status.from)) return { status: { ...status, state: 'success', to: current }, stale: false };
  if (now - Date.parse(status.at) > UPDATE_STALE_MS) return { status: { ...status, state: 'failed', to: current }, stale: true };
  return { status, stale: false };
}
