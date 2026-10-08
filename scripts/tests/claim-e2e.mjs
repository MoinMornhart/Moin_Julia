#!/usr/bin/env node
/**
 * Ende-zu-Ende: ältere Installation (Discord-Werte in der .env, noch kein Instanz-Admin).
 * Login → „System“ → Einrichtungs-Code → Admin → Bot-Token ändern.
 * Voraussetzung: Dashboard mit leerer DB, DISCORD_* in der Umgebung (falscher Token),
 * SETUP_CODE=MOIN-TEST-CODE und Fake-Discord (fake-discord.mjs).
 */
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

const { values } = parseArgs({ options: { url: { type: 'string', default: 'http://localhost:3302' }, shots: { type: 'string' } } });
const base = values.url.replace(/\/+$/, '');
let failed = false;
const check = (ok, label) => {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failed = true;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(`${base}/api/auth/login`);
await page.waitForURL(/\/servers/);
check(await page.getByText('Noch kein Instanz-Admin').isVisible(), 'Hinweis „Noch kein Instanz-Admin“ erscheint');
await page.getByRole('link', { name: 'System' }).first().click();
await page.waitForURL(/\/system/);
check(await page.getByRole('heading', { name: 'Instanz-Admin werden' }).isVisible(), 'System-Seite fragt nach dem Code');
await page.fill('#claimCode', 'FALSCH');
await page.getByRole('button', { name: 'Admin werden' }).click();
await page.getByText('Der Code stimmt nicht').waitFor();
check(true, 'Falscher Code wird abgelehnt');
await page.fill('#claimCode', 'MOIN-TEST-CODE');
await page.getByRole('button', { name: 'Admin werden' }).click();
await page.getByRole('heading', { name: 'Discord' }).waitFor();
check(true, 'Richtiger Code → System-Formular erscheint');
if (values.shots) await page.screenshot({ path: `${values.shots}/26-system-admin.png`, fullPage: true });

await page.fill('input[name="discordToken"]', 'immer.noch.falsch');
await page.getByRole('button', { name: 'Speichern' }).click();
await page.getByText('Der Bot-Token ist ungültig').waitFor();
check(true, 'Ungültiger neuer Token wird vor dem Speichern abgelehnt');
await page.fill('input[name="discordToken"]', 'FAKE.BOT.TOKEN');
await page.getByRole('button', { name: 'Speichern' }).click();
await page.getByText('Gespeichert – der Bot startet').waitFor();
check(true, 'Gültiger Token wird gespeichert, Bot-Neustart ausgelöst');
await page.reload();
check(await page.getByText('••••••OKEN').isVisible(), 'Neuer Token wird maskiert angezeigt');

await browser.close();
if (failed) process.exit(1);
console.log('\nAdmin-Übernahme-Test bestanden');
