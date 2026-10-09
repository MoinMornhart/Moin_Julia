import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CHANGELOG } from './changelog.js';
import { isNewerVersion } from './version.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('Änderungsverlauf', () => {
  it('oberster Eintrag passt zur Datei VERSION', () => {
    expect(CHANGELOG[0]!.version).toBe(readFileSync(path.join(root, 'VERSION'), 'utf8').trim());
  });
  it('ist absteigend sortiert und ohne doppelte Versionen', () => {
    for (let i = 1; i < CHANGELOG.length; i++) {
      expect(isNewerVersion(CHANGELOG[i - 1]!.version, CHANGELOG[i]!.version)).toBe(true);
    }
  });
  it('jede Version hat mindestens eine Änderung', () => {
    expect(CHANGELOG.every((e) => e.changes.length > 0)).toBe(true);
  });
  it('verlinkt nie auf Owner-only-Bereiche (den Verlauf sehen auch Admins)', async () => {
    const { MODULES } = await import('./modules.js');
    const ownerOnly = MODULES.filter((m) => m.ownerOnly).map((m) => `g:${m.id}`);
    const links = CHANGELOG.flatMap((e) => e.changes.map((c) => c.link ?? ''));
    expect(links.filter((l) => ownerOnly.some((o) => l === o || l.startsWith(`${o}/`)))).toEqual([]);
  });
});
