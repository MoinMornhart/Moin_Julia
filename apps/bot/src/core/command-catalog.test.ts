import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { botModules } from '../modules/index.js';
import { buildCommandCatalog } from './command-catalog.js';

const target = fileURLToPath(new URL('../../../../packages/shared/src/commands.catalog.ts', import.meta.url));

function render(): string {
  const catalog = buildCommandCatalog(botModules);
  return `/* Automatisch erzeugt aus den Bot-Befehlen – nicht von Hand ändern.
 * Neu erzeugen: UPDATE_CATALOG=1 pnpm --filter @moin/bot exec vitest run src/core/command-catalog.test.ts */
import type { CommandCatalogEntry } from './config/command-notes.js';

export const COMMAND_CATALOG: CommandCatalogEntry[] = ${JSON.stringify(catalog, null, 2)};
`;
}

describe('Befehls-Übersicht', () => {
  it('Katalog im Dashboard ist aktuell (sonst UPDATE_CATALOG=1 ausführen)', () => {
    const text = render();
    if (process.env.UPDATE_CATALOG === '1') writeFileSync(target, text);
    expect(readFileSync(target, 'utf8').replace(/\r\n/g, '\n')).toBe(text);
  });

  it('löst Unterbefehle auf', () => {
    const names = buildCommandCatalog(botModules).map((c) => c.name);
    expect(names).toContain('musik play');
    expect(names).toContain('raenge verschieben');
    expect(names).toContain('ping');
  });
});
