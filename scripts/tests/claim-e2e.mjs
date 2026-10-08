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
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText('Der Bot-Token ist ungültig').waitFor();
check(true, 'Ungültiger neuer Token wird vor dem Speichern abgelehnt');
await page.fill('input[name="discordToken"]', 'FAKE.BOT.TOKEN');
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText('Gespeichert – der Bot startet').waitFor();
check(true, 'Gültiger Token wird gespeichert, Bot-Neustart ausgelöst');
await page.reload();
check(await page.getByText('••••••OKEN').isVisible(), 'Neuer Token wird maskiert angezeigt');

// Bot einladen → Discord leitet zurück → Server wird ohne laufenden Bot erkannt → direkt ins Server-Dashboard
await page.goto(`${base}/servers`);
check(await page.getByText('Der Bot meldet sich nicht').isVisible(), 'Ohne Lebenszeichen erklärt die Seite, was zu tun ist');
const invite = page.getByRole('link', { name: 'Einladen' }).first();
check((await invite.getAttribute('href')).includes('redirect_uri='), 'Einladungs-Link enthält die Rückleitung ins Dashboard');
await invite.click();
await page.waitForURL(/\/g\/700000000000000001$/);
check(true, 'Nach dem Einladen landet man direkt im Dashboard des Servers');
await page.goto(`${base}/servers`);
check(await page.getByRole('link', { name: /Philips Server/ }).isVisible(), 'Server steht danach unter „Deine Server“');

// Bot-Profil (global): Name, Kapitänin Julia als Bild, „Über mich“, Status
const recorded = async () => (await (await fetch('http://localhost:3399/__recorded')).json());
await page.goto(`${base}/system`);
await page.getByRole('heading', { name: 'Bot-Profil' }).waitFor();
await page.locator('#bot-profil input').first().fill('Kapitaenin Julia');
await page.locator('#bot-profil textarea').fill('Ahoi! Ich helfe bei Moderation und mehr.');
await page.getByRole('button', { name: '👩‍✈️ Kapitänin Julia' }).first().click();
await page.locator('#bot-profil img[src^="data:image/png"]').first().waitFor();
await page.locator('#bot-profil select').first().selectOption('dnd');
await page.getByRole('button', { name: 'Profil speichern' }).click();
await page.getByText('Status und Aktivität gespeichert').waitFor();
const r1 = await recorded();
check(r1.user?.username === 'Kapitaenin Julia' && String(r1.user?.avatar).startsWith('data:image/png;base64,'), 'Name und Profilbild gehen an Discord (PATCH /users/@me)');
check(r1.application?.description === 'Ahoi! Ich helfe bei Moderation und mehr.', '„Über mich“ geht an Discord (PATCH /applications/@me)');
await page.reload();
check((await page.locator('#bot-profil select').first().inputValue()) === 'dnd', 'Status „Bitte nicht stören“ bleibt gespeichert');

// Bot auf diesem Server
await page.goto(`${base}/g/700000000000000001/einstellungen`);
await page.getByRole('heading', { name: 'Bot auf diesem Server' }).waitFor();
await page.getByPlaceholder('Moin_Julia').fill('Käpt’n');
await page.getByRole('button', { name: 'Server-Profil speichern' }).click();
await page.getByText('Server-Profil gespeichert').waitFor();
check((await recorded()).member?.nick === 'Käpt’n', 'Spitzname pro Server geht an Discord (PATCH /guilds/…/members/@me)');

await browser.close();
if (failed) process.exit(1);
console.log('\nAdmin-Übernahme-Test bestanden');
