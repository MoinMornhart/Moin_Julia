#!/usr/bin/env node
/**
 * Klick-Test des Dashboards im Demo-Modus (DASHBOARD_DEMO=true):
 * Login → Übersicht → Modul „Allgemein“ aus- und wieder einschalten → Zustand nach Reload prüfen.
 *
 *   node scripts/smoke-test.mjs --url http://localhost:3000
 */
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

const { values } = parseArgs({ options: { url: { type: 'string', default: 'http://localhost:3000' } } });
const base = values.url.replace(/\/+$/, '');
const overview = `${base}/g/100000000000000001`;

let failed = false;
function check(condition, label) {
  console.log(`${condition ? '✓' : '✗'} ${label}`);
  if (!condition) failed = true;
}

const browser = await chromium.launch();
const page = await browser.newPage();

const health = await page.request.get(`${base}/api/health`);
check(health.ok(), `Healthcheck antwortet (${health.status()})`);

await page.goto(`${base}/api/auth/demo`);
check(page.url().endsWith('/servers'), 'Demo-Login leitet zur Server-Auswahl');

await page.goto(overview);
const allgemein = page.getByRole('switch', { name: /Allgemein/ });
const before = await allgemein.getAttribute('aria-checked');
check(before === 'true', 'Modul „Allgemein“ ist standardmäßig an');

const planned = page.getByRole('switch', { name: /Logging/ });
check(await planned.isDisabled(), 'Geplantes Modul „Logging“ lässt sich noch nicht schalten');

async function toggleAndVerify(expected) {
  await allgemein.click();
  await page.waitForFunction(
    (value) => document.querySelector('[role=switch][aria-label^="Allgemein"]')?.getAttribute('aria-checked') === value,
    expected,
  );
  await page.waitForTimeout(500);
  await page.reload();
  const after = await page.getByRole('switch', { name: /Allgemein/ }).getAttribute('aria-checked');
  check(after === expected, `Nach Reload ist „Allgemein“ ${expected === 'true' ? 'an' : 'aus'}`);
}
await toggleAndVerify('false');
await toggleAndVerify('true');

const foreign = await page.goto(`${base}/g/100000000000000003`);
check(foreign?.status() === 404, 'Server ohne Bot/Rechte → 404');

await browser.close();
if (failed) {
  console.error('\nSmoke-Test FEHLGESCHLAGEN');
  process.exit(1);
}
console.log('\nSmoke-Test bestanden');
