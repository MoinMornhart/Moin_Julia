#!/usr/bin/env node
/**
 * Nimmt Dashboard-Screenshots fürs Bauprotokoll auf (immer dieselben Seiten → Fortschritt vergleichbar).
 *
 * Voraussetzung: Dashboard läuft mit DASHBOARD_DEMO=true.
 *   node scripts/screenshots.mjs --url http://localhost:3000 --phase 02-grundgeruest
 *
 * Ergebnis: docs/bauprotokoll/img/<phase>/*.png
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:3000' },
    phase: { type: 'string' },
    out: { type: 'string', default: 'docs/bauprotokoll/img' },
    /** Nur Seiten bis zu diesem Modul (für Vergleichsbilder älterer Stände) */
    upto: { type: 'string', default: '99' },
  },
});
if (!values.phase) {
  console.error('Bitte --phase angeben, z. B. --phase 02-grundgeruest');
  process.exit(1);
}

const base = values.url.replace(/\/+$/, '');
const outDir = path.resolve(values.out, values.phase);
const DEMO_GUILD = '100000000000000001';

/** Seiten, die nach jedem Modul erneut fotografiert werden. */
const PAGES = [
  { name: '01-start', path: '/', login: false },
  { name: '02-server-auswahl', path: '/servers', login: true },
  { name: '03-uebersicht', path: `/g/${DEMO_GUILD}`, login: true },
  { name: '04-einstellungen', path: `/g/${DEMO_GUILD}/einstellungen`, login: true },
  { name: '05-bauprotokoll', path: '/bauprotokoll', login: false },
  // Ab hier je Modul eine Seite (sobald das Modul gebaut ist)
  { name: '10-logging', path: `/g/${DEMO_GUILD}/logging`, login: true, since: 1 },
  { name: '11-moderation', path: `/g/${DEMO_GUILD}/moderation`, login: true, since: 2 },
  { name: '12-moderation-faelle', path: `/g/${DEMO_GUILD}/moderation/faelle`, login: true, since: 2 },
  { name: '13-schutz', path: `/g/${DEMO_GUILD}/schutz`, login: true, since: 3 },
  { name: '14-willkommen', path: `/g/${DEMO_GUILD}/willkommen`, login: true, since: 4 },
  { name: '15-rollen-panel', path: `/g/${DEMO_GUILD}/willkommen/panels?panel=neu`, login: true, since: 4 },
  { name: '16-vorlagen', path: `/g/${DEMO_GUILD}/vorlagen`, login: true, since: 4 },
];
const onlyUpTo = Number(values.upto);

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();

async function shoot(viewport, suffix) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: 'dark', locale: 'de-DE' });
  const page = await context.newPage();
  for (const entry of PAGES) {
    if (entry.since && entry.since > onlyUpTo) continue;
    if (entry.login) {
      await page.goto(`${base}/api/auth/demo`);
    }
    const response = await page.goto(`${base}${entry.path}`, { waitUntil: 'networkidle' });
    if (!response?.ok()) throw new Error(`${entry.path} lieferte HTTP ${response?.status()}`);
    const file = path.join(outDir, `${entry.name}${suffix}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`✓ ${path.relative(process.cwd(), file)}`);
  }
  await context.close();
}

await shoot({ width: 1440, height: 900 }, '');
await shoot({ width: 390, height: 844 }, '-mobil');
await browser.close();
