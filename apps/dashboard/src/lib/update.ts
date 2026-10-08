import 'server-only';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isNewerVersion } from '@moin/shared';
import { appVersion, isDemoMode } from './env';
import { cacheGet, cacheSet } from './redis';

/**
 * Versions-Prüfung gegen GitHub und Update-Knopf.
 * Das Dashboard startet Updates nie selbst: Es legt nur eine Anfrage-Datei in den Austausch-Ordner,
 * den ein systemd-Dienst auf dem Host beobachtet (moin-julia dashboard-update).
 */

const REPO = 'MoinMornhart/Moin_Julia';
const CONTROL_DIR = process.env.CONTROL_DIR ?? '/control';

export interface LatestInfo {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  /** Neueste Änderungen (Commit-Titel) für die Vorschau */
  changes: string[];
  checkedAt: string;
  error?: string;
}

/** Neueste Version auf GitHub (10 Minuten zwischengespeichert, damit das Limit der GitHub-API reicht). */
export async function checkLatest(force = false): Promise<LatestInfo> {
  const current = appVersion();
  const key = 'moin:dash:latest-version';
  if (!force) {
    const cached = await cacheGet<LatestInfo>(key);
    if (cached && cached.current === current) return cached;
  }
  const info: LatestInfo = { current, latest: null, updateAvailable: false, changes: [], checkedAt: new Date().toISOString() };
  if (isDemoMode()) {
    // Demo/Tests: neueste Version per DEMO_LATEST_VERSION vorgeben, sonst „aktuell“
    info.latest = process.env.DEMO_LATEST_VERSION ?? current;
    info.updateAvailable = isNewerVersion(info.latest, current);
    info.changes = info.updateAvailable ? ['Demo: Temp-Voice „Join to Create“', 'Demo: Bot-Profil im Dashboard'] : [];
    return info;
  }
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${REPO}/main/VERSION`, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (!res.ok) throw new Error(`GitHub antwortet mit ${res.status}`);
    info.latest = (await res.text()).trim();
    info.updateAvailable = isNewerVersion(info.latest, current);
    if (info.updateAvailable) {
      const commits = await fetch(`https://api.github.com/repos/${REPO}/commits?per_page=8`, {
        headers: { accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
      });
      if (commits.ok) {
        const list = (await commits.json()) as { commit: { message: string } }[];
        info.changes = list.map((c) => c.commit.message.split('\n')[0]!.slice(0, 120));
      }
    }
  } catch (error) {
    info.error = error instanceof Error ? error.message : 'GitHub nicht erreichbar';
  }
  await cacheSet(key, info, info.error ? 60 : 600);
  return info;
}

// ── Austausch mit dem Host ──────────────────────────────────────────────────

export interface UpdateState {
  /** Host-Dienst eingerichtet (moin-julia update-knopf) */
  agent: boolean;
  /** Anfrage liegt bereit, Host hat sie noch nicht abgeholt */
  requested: boolean;
  status: { state: 'running' | 'success' | 'failed'; from: string; to: string; at: string } | null;
  log: string;
}

async function readJson<T>(name: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(CONTROL_DIR, name), 'utf8')) as T;
  } catch {
    return null;
  }
}

/** Farbcodes und Fortschritts-Zeichen aus dem Terminal-Log entfernen */
export function cleanLog(raw: string): string {
  // eslint-disable-next-line no-control-regex -- ANSI-Farbcodes
  return raw.replace(/\u001b\[[0-9;]*m/g, '').replace(/\r/g, '');
}

export async function updateState(): Promise<UpdateState> {
  const [agent, status] = await Promise.all([readJson<{ installed: boolean }>('agent.json'), readJson<UpdateState['status']>('update-status.json')]);
  let requested = false;
  try {
    await readFile(path.join(CONTROL_DIR, 'update-request'));
    requested = true;
  } catch {
    requested = false;
  }
  let log = '';
  try {
    log = cleanLog(await readFile(path.join(CONTROL_DIR, 'update.log'), 'utf8')).split('\n').slice(-60).join('\n');
  } catch {
    log = '';
  }
  return { agent: Boolean(agent?.installed), requested, status, log };
}

/** Update anfordern (nur Instanz-Admin – prüft der Aufrufer). */
export async function requestUpdate(by: string): Promise<{ ok: boolean; message: string }> {
  const state = await updateState();
  if (!state.agent) return { ok: false, message: 'Der Update-Knopf ist auf dem Server noch nicht eingerichtet (einmalig: moin-julia update-knopf).' };
  // „running“ älter als 45 Minuten gilt als hängen geblieben (z. B. Host neu gestartet)
  const stale = state.status ? Date.now() - Date.parse(state.status.at) > 45 * 60_000 : true;
  if (state.requested || (state.status?.state === 'running' && !stale)) return { ok: false, message: 'Es läuft bereits ein Update.' };
  try {
    const file = path.join(CONTROL_DIR, 'update-request');
    await writeFile(`${file}.tmp`, JSON.stringify({ by, at: new Date().toISOString() }));
    await rename(`${file}.tmp`, file);
    return { ok: true, message: 'Update angefordert – der Server startet es in wenigen Sekunden.' };
  } catch {
    return { ok: false, message: 'Konnte die Anfrage nicht ablegen – Ordner „control“ nicht beschreibbar (einmalig: moin-julia update-knopf).' };
  }
}
