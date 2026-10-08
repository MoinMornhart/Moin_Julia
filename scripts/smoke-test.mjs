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

const plannedCards = page.locator('li', { hasText: 'Kommt in Modul' });
if ((await plannedCards.count()) > 0) {
  const name = (await plannedCards.first().locator('h3').textContent())?.trim();
  check(await plannedCards.first().getByRole('switch').isDisabled(), `Geplantes Modul „${name}“ lässt sich noch nicht schalten`);
}

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

// ── Modul 1: Logging ────────────────────────────────────────────────────────
await page.goto(`${overview}/logging`);
check(await page.getByRole('heading', { name: 'Logging' }).isVisible(), 'Logging-Seite lädt');
await page.selectOption('#defaultChannelId', { label: '# mod-log' });
await page.selectOption('select[name="cat.messages.channelId"]', { label: '# nachrichten-log' });
const voice = page.locator('input[name="cat.voice.enabled"]');
if (await voice.isChecked()) await voice.click();
await page.getByRole('button', { name: 'Speichern' }).click();
await page.getByText(/Gespeichert/).waitFor();
await page.reload();
check((await page.inputValue('#defaultChannelId')) === '100000000000000028', 'Standard-Log-Kanal gespeichert');
check(
  (await page.inputValue('select[name="cat.messages.channelId"]')) === '100000000000000029',
  'Eigener Kanal für Nachrichten gespeichert',
);
check(!(await page.locator('input[name="cat.voice.enabled"]').isChecked()), 'Kategorie Voice ausgeschaltet gespeichert');
const logSwitch = page.getByRole('switch', { name: /Logging (ein|aus)schalten/ });
if ((await logSwitch.getAttribute('aria-checked')) !== 'true') {
  await logSwitch.click();
  await page.waitForFunction(() => document.querySelector('[role=switch][aria-label^="Logging"]')?.getAttribute('aria-checked') === 'true');
}
await page.waitForTimeout(400);
await page.reload();
check((await page.getByRole('switch', { name: /Logging (ein|aus)schalten/ }).getAttribute('aria-checked')) === 'true', 'Logging-Modul eingeschaltet');
// Zurücksetzen, damit der Test wiederholbar ist
await page.locator('input[name="cat.voice.enabled"]').click();
await page.getByRole('button', { name: 'Speichern' }).click();
await page.getByText(/Gespeichert/).waitFor();

// ── Modul 2: Moderation ─────────────────────────────────────────────────────
await page.goto(`${overview}/moderation`);
check(await page.getByRole('heading', { name: 'Moderation' }).isVisible(), 'Moderations-Seite lädt');
await page.selectOption('#modLogChannelId', { label: '# mod-log' });
const badWords = page.locator('input[name="badWords.enabled"]');
if (!(await badWords.isChecked())) await badWords.click();
await page.fill('textarea[name="badWords.words"]', 'doofwort\n*schimpf*');
await page.getByRole('button', { name: '+ Stufe hinzufügen' }).click();
await page.getByRole('button', { name: 'Speichern' }).click();
await page.getByText(/Gespeichert/).waitFor();
await page.reload();
check((await page.inputValue('#modLogChannelId')) === '100000000000000028', 'Mod-Log-Kanal gespeichert');
check((await page.inputValue('textarea[name="badWords.words"]')) === 'doofwort\n*schimpf*', 'Schimpfwort-Liste gespeichert');
check((await page.locator('input[name^="esc."][name$=".warns"]').count()) === 3, 'Dritte Eskalationsstufe gespeichert');
// Aufräumen: dritte Stufe wieder entfernen
await page.getByRole('button', { name: 'Entfernen' }).last().click();
await page.getByRole('button', { name: 'Speichern' }).click();
await page.getByText(/Gespeichert/).waitFor();

await page.goto(`${overview}/moderation/faelle`);
check((await page.locator('tbody tr').count()) === 6, 'Fall-Liste zeigt die 6 Demo-Fälle');
await page.goto(`${overview}/moderation/faelle?q=lukas`);
check((await page.locator('tbody tr').count()) === 4, 'Suche nach „lukas“ findet 4 Fälle');
await page.goto(`${overview}/moderation/faelle?typ=BAN`);
check((await page.locator('tbody tr').count()) === 1, 'Filter „Bann“ findet 1 Fall');

// ── Modul 3: Server-Schutz ──────────────────────────────────────────────────
await page.goto(`${overview}/schutz`);
check(await page.getByRole('heading', { name: 'Server-Schutz' }).isVisible(), 'Schutz-Seite lädt');
await page.selectOption('#alertChannelId', { label: '# mod-chat' });
for (const name of ['antiNuke.enabled', 'verification.enabled']) {
  const box = page.locator(`input[name="${name}"]`);
  if (!(await box.isChecked())) await box.click();
}
await page.fill('input[name="antiNuke.threshold"]', '4');
await page.selectOption('select[name="verification.roleId"]', { label: '@ Community' });
await page.selectOption('select[name="verification.channelId"]', { label: '# regeln' });
await page.selectOption('select[name="verification.mode"]', 'captcha');
await page.getByRole('button', { name: 'Speichern' }).click();
await page.getByText(/Gespeichert/).waitFor();
await page.reload();
check((await page.inputValue('input[name="antiNuke.threshold"]')) === '4', 'Anti-Nuke-Schwelle gespeichert');
check((await page.inputValue('select[name="verification.mode"]')) === 'captcha', 'Captcha-Modus gespeichert');
check(await page.locator('input[name="antiNuke.enabled"]').isChecked(), 'Anti-Nuke eingeschaltet gespeichert');
await page.getByRole('button', { name: 'Panel jetzt in den Kanal senden' }).click();
await page.getByText('Panel wird gesendet').waitFor();
check(true, '„Panel senden“ geht als Auftrag an den Bot');

// ── Modul 4: Willkommen & Rollen ────────────────────────────────────────────
await page.goto(`${overview}/willkommen`);
check(await page.getByRole('heading', { name: 'Willkommen & Rollen' }).isVisible(), 'Willkommen-Seite lädt');
const welcomeOn = page.locator('input[name="welcome.enabled"]');
if (!(await welcomeOn.isChecked())) await welcomeOn.click();
await page.selectOption('select[name="welcome.channelId"]', { label: '# allgemein' });
await page.selectOption('select[name="card.style"]', 'mint');
const firstTitle = page.locator('input[maxlength="256"]').first();
await firstTitle.fill('Moin {user.name}!');
check(await page.getByText('Moin Anna!').first().isVisible(), 'Live-Vorschau ersetzt Platzhalter sofort');
await page.getByRole('button', { name: 'Speichern' }).click();
await page.getByText(/Gespeichert/).waitFor();
await page.reload();
check((await page.inputValue('select[name="card.style"]')) === 'mint', 'Bild-Stil gespeichert');
check((await page.locator('input[maxlength="256"]').first().inputValue()) === 'Moin {user.name}!', 'Embed-Titel gespeichert');

await page.goto(`${overview}/willkommen/panels?panel=neu`);
await page.fill('input[name="name"]', 'Spiele');
await page.selectOption('select[name="channelId"]', { label: '# regeln' });
await page.getByRole('button', { name: '+ Rolle' }).click();
await page.getByRole('button', { name: 'Speichern' }).click();
await page.waitForURL(/panel=c/);
check((await page.locator('select[name^="role."][name$=".id"]').count()) === 2, 'Rollen-Panel mit 2 Rollen gespeichert');
await page.getByRole('button', { name: 'In Discord senden' }).click();
await page.getByText('Panel wird gesendet').waitFor();
check(true, 'Rollen-Panel „In Discord senden“ geht als Auftrag an den Bot');
await page.getByRole('button', { name: 'Panel löschen' }).click();
await page.waitForURL(/willkommen\/panels$/);
check(true, 'Rollen-Panel lässt sich löschen');

// ── Vorlagen: Export, Import, Backup, GalaxyBot ─────────────────────────────
await page.goto(`${overview}/vorlagen`);
const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Vorlage herunterladen/ }).click()]);
const exportPath = await download.path();
const { readFile, writeFile } = await import('node:fs/promises');
const exported = JSON.parse(await readFile(exportPath, 'utf8'));
check(exported.format === 'moin-julia-vorlage' && exported.modules.logging, 'Export liefert Vorlage mit Modulen');
check(Object.values(exported.refs.channels).some((c) => c.name === 'mod-log'), 'Export speichert Kanäle mit Namen');
const tmpFile = `${exportPath}.json`;
await writeFile(tmpFile, JSON.stringify(exported));
await page.setInputFiles('input[type="file"]', tmpFile);
await page.getByRole('button', { name: 'Vorlage prüfen' }).click();
await page.getByText('alles gefunden').waitFor();
check(true, 'Import ordnet alle Kanäle/Rollen per Name zu');
await page.getByRole('button', { name: 'Jetzt übernehmen' }).click();
await page.getByText(/Übernommen:/).waitFor();
check(true, 'Import übernimmt die Module');
await page.goto(`${overview}/vorlagen/sicherungen`);
check((await page.getByRole('button', { name: 'Wiederherstellen' }).count()) >= 1, 'Vor dem Import wurde ein Backup angelegt');
await page.getByRole('button', { name: 'Wiederherstellen' }).first().click();
await page.getByText('Backup wiederhergestellt').waitFor();
check(true, 'Backup lässt sich wiederherstellen');
await page.goto(`${overview}/vorlagen/galaxybot`);
await page.getByRole('button', { name: 'GalaxyBot-Spuren suchen' }).click();
await page.getByText('GalaxyBot Bad Words').waitFor();
await page.getByRole('button', { name: 'Ausgewählte übernehmen' }).click();
await page.getByText(/Regel\(n\) übernommen/).waitFor();
await page.goto(`${overview}/moderation`);
check((await page.inputValue('textarea[name="badWords.words"]')).includes('spamwort'), 'GalaxyBot-Schimpfwörter landen in der Moderation');
check((await page.inputValue('input[name="mentionSpam.limit"]')) === '6', 'GalaxyBot-Erwähnungslimit übernommen');

const foreign = await page.goto(`${base}/g/100000000000000003`);
check(foreign?.status() === 404, 'Server ohne Bot/Rechte → 404');

await browser.close();
if (failed) {
  console.error('\nSmoke-Test FEHLGESCHLAGEN');
  process.exit(1);
}
console.log('\nSmoke-Test bestanden');
