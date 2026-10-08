#!/usr/bin/env node
/**
 * Ende-zu-Ende-Test des Einrichtungs-Assistenten gegen die nachgebaute Discord-API.
 * Voraussetzung: Dashboard mit leerer Datenbank, SETUP_CODE=MOIN-TEST-CODE und
 * DISCORD_API_URL/DISCORD_AUTHORIZE_URL auf fake-discord.mjs.
 *
 *   node scripts/tests/setup-e2e.mjs --url http://localhost:3301
 */
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

const { values } = parseArgs({ options: { url: { type: 'string', default: 'http://localhost:3301' }, shots: { type: 'string' } } });
const base = values.url.replace(/\/+$/, '');

let failed = false;
function check(condition, label) {
  console.log(`${condition ? '✓' : '✗'} ${label}`);
  if (!condition) failed = true;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const shot = async (name) => values.shots && page.screenshot({ path: `${values.shots}/${name}.png`, fullPage: true });

await page.goto(base);
check(page.url().endsWith('/setup'), 'Startseite leitet ohne Einrichtung zum Assistenten');
await page.goto(`${base}/api/auth/login`);
check(page.url().endsWith('/setup'), 'Login leitet ohne Einrichtung zum Assistenten');
await shot('20-setup-code');

// Schritt 1: Code
await page.fill('#setupCode', 'FALSCH-123');
await page.getByRole('button', { name: 'Weiter' }).click();
await page.getByText('Der Code stimmt nicht').waitFor();
check(true, 'Falscher Code wird abgelehnt');
await page.fill('#setupCode', 'moin-test-code');
await page.getByRole('button', { name: 'Weiter' }).click();
await page.getByRole('heading', { name: 'Discord-Bot verbinden' }).waitFor();
check(true, 'Richtiger Code (Groß/Klein egal) öffnet Schritt 2');

// Schritt 2: Discord
await page.fill('#token', 'falscher.token');
await page.fill('#clientId', '123456789012345678');
await page.fill('#clientSecret', 'falsch');
await page.getByRole('button', { name: 'Bei Discord prüfen' }).click();
await page.getByText('Der Bot-Token ist ungültig').waitFor();
check(await page.getByText('Das Client-Secret ist falsch').isVisible(), 'Falscher Token und falsches Secret werden erkannt');
check(await page.getByRole('button', { name: 'Weiter' }).isDisabled(), '„Weiter“ bleibt gesperrt');
await page.fill('#token', 'FAKE.BOT.TOKEN');
await page.fill('#clientSecret', 'fake-secret');
await page.getByRole('button', { name: 'Bei Discord prüfen' }).click();
await page.getByText('Bot gefunden: Moin_Julia').waitFor();
check(await page.getByText('„Message Content Intent“ ist aus').isVisible(), 'Fehlender Message-Content-Intent wird als Hinweis gemeldet');
check(await page.getByText('Client-Secret stimmt').isVisible(), 'Gültiges Secret wird bestätigt');
await shot('21-setup-discord');
await page.getByRole('button', { name: 'Weiter' }).click();

// Schritt 3: Adresse
await page.getByRole('heading', { name: 'Adresse des Dashboards' }).waitFor();
check((await page.inputValue('#dashboardUrl')) === base, 'Dashboard-URL ist mit der aktuellen Adresse vorbelegt');
check(await page.getByText(`${base}/api/auth/callback`).isVisible(), 'Redirect-URL wird zum Kopieren angezeigt');
await page.getByRole('button', { name: 'Redirect prüfen' }).click();
await page.getByText('noch nicht eingetragen').waitFor();
check(true, 'Fehlende Redirect-URL im Developer Portal wird gemeldet');
await shot('22-setup-adresse');
await page.getByRole('button', { name: 'Weiter' }).click();

// Schritt 4: Abschluss – keine Twitch-/YouTube-/KI-Schlüssel mehr
await page.getByRole('heading', { name: 'Alles bereit' }).waitFor();
check((await page.locator('input[name*="twitch" i], input[name*="youtube" i], input[name*="anthropic" i]').count()) === 0, 'Assistent fragt keine Twitch-/YouTube-/KI-Schlüssel ab');
await page.getByRole('button', { name: 'Speichern & Bot starten' }).click();
await page.getByRole('heading', { name: /Fast geschafft/ }).waitFor();
check(true, 'Speichern klappt, Abschluss-Schritt erscheint');
await shot('23-setup-fertig');

// Schritt 5: Login → Instanz-Admin
await page.getByRole('link', { name: 'Mit Discord anmelden' }).click();
await page.waitForURL(/\/servers/);
check(page.url().includes('willkommen=1'), 'Login über Discord klappt und markiert die Ersteinrichtung');
check(await page.getByText('Einrichtung abgeschlossen').isVisible(), 'Willkommens-Hinweis erscheint');
check(await page.getByRole('link', { name: 'System' }).first().isVisible(), 'Instanz-Admin sieht den Link „System“');
check(await page.getByText('Philips Server').isVisible(), 'Server aus dem Discord-Login werden gelistet (zum Einladen)');
await shot('24-setup-willkommen');

// Danach: Assistent gesperrt, System-Seite erreichbar
await page.goto(`${base}/setup`);
check(!page.url().endsWith('/setup'), 'Assistent ist nach der Einrichtung gesperrt');
await page.goto(`${base}/system`);
check(await page.getByRole('heading', { name: 'System' }).isVisible(), 'System-Seite öffnet für den Instanz-Admin');
check(await page.getByText('••••••OKEN').isVisible(), 'Token wird nur maskiert angezeigt');
await shot('25-system');

// Ein fremder Browser ohne Login kommt nicht an die System-Seite
const other = await browser.newPage();
await other.goto(`${base}/system`);
check(!other.url().endsWith('/system'), 'Ohne Login keine System-Seite');

await browser.close();
if (failed) {
  console.error('\nEinrichtungs-Test FEHLGESCHLAGEN');
  process.exit(1);
}
console.log('\nEinrichtungs-Test bestanden');
