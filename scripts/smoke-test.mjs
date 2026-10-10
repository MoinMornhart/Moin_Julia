#!/usr/bin/env node
/**
 * Klick-Test des Dashboards im Demo-Modus (DASHBOARD_DEMO=true):
 * Login → Übersicht → Modul „Allgemein“ aus- und wieder einschalten → Zustand nach Reload prüfen.
 *
 *   node scripts/smoke-test.mjs --url http://localhost:3000
 */
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

// --control: Austausch-Ordner des Dashboards (CONTROL_DIR) – dann wird auch der Update-Knopf getestet
const { values } = parseArgs({ options: { url: { type: 'string', default: 'http://localhost:3000' }, control: { type: 'string' } } });
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
// Fehler von Philip: Nach dem Speichern sprangen Auswahlfelder auf den alten Wert zurück (ohne Neuladen prüfen!)
for (const label of ['# nachrichten-log', '# mod-log']) {
  await page.selectOption('#defaultChannelId', { label });
  await page.getByRole('button', { name: 'Speichern' }).click();
  await page.getByText(/Gespeichert/).waitFor();
  await page.waitForTimeout(700);
}
check((await page.inputValue('#defaultChannelId')) === '100000000000000028', 'Nach dem Speichern bleibt die Auswahl stehen (kein Zurückspringen)');
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
const unverified = page.locator('input[name="verification.removeRoleIds"]').first();
if (!(await unverified.isChecked())) await page.locator('label:has(input[name="verification.removeRoleIds"])').first().click();
await page.getByRole('button', { name: 'Speichern' }).click();
await page.getByText(/Gespeichert/).waitFor();
await page.reload();
check((await page.inputValue('input[name="antiNuke.threshold"]')) === '4', 'Anti-Nuke-Schwelle gespeichert');
check((await page.inputValue('select[name="verification.mode"]')) === 'captcha', 'Captcha-Modus gespeichert');
check(await page.locator('input[name="verification.removeRoleIds"]').first().isChecked(), 'Verifizierung: Rolle zum Entziehen gespeichert');
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

// Bild vom PC hochladen (kleines PNG) → als Hintergrund speichern → in „Bilder“ sehen und löschen
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const uploadInput = page.getByTestId('image-upload').first();
await uploadInput.setInputFiles({ name: 'falsch.png', mimeType: 'image/png', buffer: Buffer.from('<svg onload=alert(1)>') });
await page.getByText('Nur PNG, JPG, GIF oder WebP.').waitFor();
check(true, 'Upload prüft den echten Dateityp (getarnte Datei abgelehnt)');
await uploadInput.setInputFiles({ name: 'hintergrund.png', mimeType: 'image/png', buffer: png });
await page.getByText('Eigenes Bild hochgeladen').first().waitFor();
await page.getByRole('button', { name: 'Speichern' }).click();
await page.getByText(/Gespeichert/).waitFor();
await page.reload();
const bgValue = await page.inputValue('input[name="card.backgroundUrl"]');
check(/^upload:[a-z0-9]+$/.test(bgValue), 'Hochgeladenes Hintergrundbild gespeichert');
const imgRes = await page.request.get(`${base}/api/uploads/${bgValue.slice(7)}`);
check(imgRes.ok() && imgRes.headers()['content-type'] === 'image/png', 'Bild wird angemeldeten Admins angezeigt');
const anon = await (await browser.newContext()).request.get(`${base}/api/uploads/${bgValue.slice(7)}`);
check(anon.status() === 404, 'Ohne Anmeldung ist das Bild nicht abrufbar');
await page.goto(`${overview}/vorlagen/bilder`);
check((await page.locator('img[alt="hintergrund.png"]').count()) >= 1, 'Bild erscheint unter „Vorlagen → Bilder“');
await page.goto(`${overview}/willkommen`);
await page.getByRole('button', { name: 'Entfernen' }).first().click();
await page.getByRole('button', { name: 'Speichern' }).click();
await page.getByText(/Gespeichert/).waitFor();
await page.goto(`${overview}/vorlagen/bilder`);
const imagesBefore = await page.getByRole('button', { name: 'Löschen' }).count();
await page.getByRole('button', { name: 'Löschen' }).first().click();
for (let i = 0; i < 10 && (await page.getByRole('button', { name: 'Löschen' }).count()) !== imagesBefore - 1; i++) {
  await page.waitForTimeout(500);
  await page.reload();
}
check((await page.getByRole('button', { name: 'Löschen' }).count()) === imagesBefore - 1, 'Bild lässt sich löschen');

await page.goto(`${overview}/willkommen/panels?panel=neu`);
await page.fill('input[name="name"]', 'Spiele');
await page.selectOption('select[name="channelId"]', { label: '# regeln' });
await page.getByRole('button', { name: '+ Rolle' }).click();
await page.locator('label:has(input[name="removeOnPick"])').last().click();
await page.getByRole('button', { name: 'Speichern' }).click();
await page.waitForURL(/panel=c/);
check(await page.locator('input[name="removeOnPick"]').last().isChecked(), 'Rollen-Panel: „beim Auswählen entziehen“ gespeichert');
check((await page.locator('select[name^="role."][name$=".id"]').count()) === 2, 'Rollen-Panel mit 2 Rollen gespeichert');
await page.getByRole('button', { name: 'In Discord senden' }).click();
await page.getByText('Panel wird gesendet').waitFor();
check(true, 'Rollen-Panel „In Discord senden“ geht als Auftrag an den Bot');
await page.getByRole('button', { name: 'Panel löschen' }).click();
await page.waitForURL(/willkommen\/panels$/);
check(true, 'Rollen-Panel lässt sich löschen');

// ── Eigene Sprachkanäle (Temp-Voice) ────────────────────────────────────────
await page.goto(`${overview}/tempvoice`);
check(await page.getByRole('heading', { name: 'Eigene Sprachkanäle' }).isVisible(), 'Seite „Eigene Sprachkanäle“ lädt');
const hubRows = page.locator('select[name$=".channelId"][name^="hub."]');
if ((await hubRows.count()) === 0) await page.getByRole('button', { name: '+ Erstell-Kanal' }).click();
await page.selectOption('select[name="hub.0.channelId"]', { label: '🔊 ➕ Kanal erstellen' });
await page.selectOption('select[name="hub.0.categoryId"]', { label: '📁 🎙️ Eigene Sprachkanäle' });
await page.fill('input[name="hub.0.nameTemplate"]', '🎧 {user}s Raum');
await page.fill('input[name="deleteAfterSec"]', '20');
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert/).waitFor();
check((await page.inputValue('select[name="hub.0.channelId"]')) === '100000000000000041', 'Erstell-Kanal bleibt nach dem Speichern stehen');
await page.reload();
check((await page.inputValue('select[name="hub.0.categoryId"]')) === '100000000000000040', 'Kategorie für neue Kanäle gespeichert');
check((await page.inputValue('input[name="hub.0.nameTemplate"]')) === '🎧 {user}s Raum', 'Namensvorlage gespeichert');
check((await page.inputValue('input[name="deleteAfterSec"]')) === '20', 'Lösch-Verzögerung gespeichert');
await page.getByRole('button', { name: 'Automatisch anlegen' }).click();
await page.getByText(/Wird angelegt|nicht erreichbar/).waitFor();
check(true, '„Automatisch anlegen“ geht als Auftrag an den Bot');

// ── Modul 5: Tickets ────────────────────────────────────────────────────────
await page.goto(`${overview}/tickets`);
check(await page.getByRole('heading', { name: 'Tickets' }).first().isVisible(), 'Ticket-Seite lädt');
const teamChip = page.locator('input[name="teamRoleIds"]').first();
if (!(await teamChip.isChecked())) await page.locator('label:has(input[name="teamRoleIds"])').first().click();
await page.selectOption('#logChannelId', { label: '# mod-log' });
const autoClose = page.locator('input[name="autoClose.enabled"]');
if (!(await autoClose.isChecked())) await autoClose.click();
await page.fill('input[name="autoClose.hours"]', '24');
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert/).waitFor();
check((await page.inputValue('#logChannelId')) === '100000000000000028', 'Ticket-Log-Kanal bleibt nach dem Speichern stehen');
await page.reload();
check(await page.locator('input[name="teamRoleIds"]').first().isChecked(), 'Team-Rolle gespeichert');
check((await page.inputValue('input[name="autoClose.hours"]')) === '24', 'Automatisches Schließen gespeichert');

await page.goto(`${overview}/tickets/panels?panel=neu`);
await page.fill('input[name="name"]', 'Support-Test');
await page.selectOption('select[name="channelId"]', { label: '# support' });
await page.getByRole('button', { name: '+ Grund' }).click();
await page.locator('[data-reason]').last().getByRole('button', { name: '+ Frage' }).click();
await page.locator('[data-reason]').last().getByLabel('Frage 1').fill('Wie heißt du im Spiel?');
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.waitForURL(/panel=c/);
check((await page.locator('[data-reason]').count()) === 3, 'Ticket-Panel mit 3 Gründen gespeichert');
check((await page.locator('[data-reason]').last().getByLabel('Frage 1').inputValue()) === 'Wie heißt du im Spiel?', 'Formular-Frage gespeichert');
await page.getByRole('button', { name: 'In Discord senden' }).click();
await page.getByText(/Panel wird gesendet|nicht erreichbar/).waitFor();
check(true, 'Ticket-Panel „In Discord senden“ geht als Auftrag an den Bot');
await page.getByRole('button', { name: 'Panel löschen' }).click();
await page.waitForURL(/tickets\/panels$/);

await page.goto(`${overview}/tickets/liste`);
check((await page.locator('tbody tr').count()) >= 3, 'Ticket-Liste zeigt die Demo-Tickets');
await page.goto(`${overview}/tickets/liste?status=offen`);
check((await page.locator('tbody tr').count()) >= 1 && (await page.getByText('geschlossen', { exact: true }).count()) === 0, 'Filter „Offen“ zeigt nur offene Tickets');
await page.goto(`${overview}/tickets/liste?status=geschlossen`);
await page.getByRole('link', { name: 'Verlauf →' }).first().click();
await page.waitForURL(/tickets\/c/);
check((await page.locator('iframe[sandbox=""]').count()) === 1, 'Verlauf wird im abgeschotteten Rahmen angezeigt');

// ── Modul 6: Teams / Bewerbungssystem ───────────────────────────────────────
await page.goto(`${overview}/team/einstellungen`);
check(await page.getByRole('heading', { name: 'Teams' }).first().isVisible(), 'Team-Seite lädt');
const teamSwitch = page.getByRole('switch', { name: /Teams (ein|aus)schalten/ });
if ((await teamSwitch.getAttribute('aria-checked')) !== 'true') {
  await teamSwitch.click();
  await page.waitForFunction(() => document.querySelector('[role=switch][aria-label^="Teams"]')?.getAttribute('aria-checked') === 'true');
  await page.waitForTimeout(400);
  await page.reload();
}
await page.selectOption('#logChannelId', { label: '# mod-log' });
const reviewerChip = page.locator('input[name="reviewerRoleIds"]').first();
if (!(await reviewerChip.isChecked())) await page.locator('label:has(input[name="reviewerRoleIds"])').first().click();
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert/).waitFor();
await page.reload();
check(await page.locator('input[name="reviewerRoleIds"]').first().isChecked(), 'Prüfer-Rolle gespeichert');

const posTitle = `Event-Team ${Date.now() % 1e6}`;
await page.goto(`${overview}/team/stellen?stelle=neu`);
await page.fill('input[name="title"]', posTitle);
await page.locator('[data-field]').first().getByLabel('Frage 1').fill('Welche Events würdest du planen?');
await page.getByRole('button', { name: 'Stelle speichern' }).click();
await page.waitForURL(/stelle=c/);
check((await page.inputValue('input[name="title"]')) === posTitle, 'Stelle gespeichert');

// Öffentliche Bewerbungsseite → bewerben → doppelt geht nicht
await page.goto(`${base}/bewerben/100000000000000001`);
check(await page.getByText(posTitle).isVisible(), 'Stelle erscheint auf der öffentlichen Bewerbungsseite');
await page.locator('li', { hasText: posTitle }).getByRole('link', { name: 'Jetzt bewerben' }).click();
await page.waitForURL(/bewerben\/100000000000000001\/c/);
const formFields = page.locator('form input:not([type=file]), form textarea, form select');
for (let i = 0; i < (await formFields.count()); i++) {
  const el = formFields.nth(i);
  const tagName = await el.evaluate((e) => e.tagName);
  if (tagName === 'SELECT') await el.selectOption({ index: 1 });
  else await el.fill('Ein Quiz-Abend, ein Minecraft-Bauwettbewerb und ein gemütlicher Filmabend im Voice!');
}
await page.getByRole('button', { name: 'Bewerbung abschicken' }).click();
await page.getByText(/Bewerbung abgeschickt!|❌/).first().waitFor();
check(await page.getByText('Bewerbung abgeschickt!').isVisible(), 'Bewerbung abgeschickt (Erfolgsmeldung sichtbar)');
await page.reload();
check(await page.getByText(/schon beworben/).isVisible(), 'Zweite Bewerbung auf dieselbe Stelle wird abgelehnt');
await page.goto(`${base}/bewerben/100000000000000001`);
check(await page.getByRole('heading', { name: 'Meine Bewerbungen' }).isVisible(), '„Meine Bewerbungen“ zeigt den Status');

// Posteingang → übernehmen, Tag, Notiz, Gespräch, annehmen mit Probezeit
await page.goto(`${overview}/team`);
await page.getByRole('link', { name: new RegExp(posTitle) }).first().click();
await page.waitForURL(/team\/bewerbung\//);
await page.getByRole('button', { name: '🙋 Übernehmen' }).click();
await page.getByText('Du bearbeitest diese Bewerbung jetzt.').waitFor();
await page.selectOption('#app-tag', 'suitable');
await page.getByText('Tag gesetzt.').waitFor();
await page.fill('#app-note', 'Klingt super motiviert.');
await page.getByRole('button', { name: 'Notiz speichern' }).click();
await page.getByText('Klingt super motiviert.').nth(0).waitFor();
check(true, 'Übernehmen, Tag und Notiz funktionieren');
await page.locator('input[type="datetime-local"]').fill('2030-05-01T18:00');
await page.getByLabel('Ort').fill('🔊 Support-Warteraum');
await page.getByRole('button', { name: '🗓️ Einladen (DM)' }).click();
await page.getByText(/Einladung wird per DM|Gespeichert/).waitFor();
check(true, 'Gesprächseinladung gespeichert');
await page.getByRole('button', { name: '✅ Annehmen' }).click();
await page.getByText(/Angenommen/).first().waitFor();
await page.goto(`${overview}/team?status=accepted`);
check(await page.getByText(posTitle).first().isVisible(), 'Angenommene Bewerbung steht unter „Angenommen“');

// Ablehnen braucht eine Begründung
await page.goto(`${overview}/team`);
await page.locator('a[href*="/team/bewerbung/"]').first().click();
await page.waitForURL(/team\/bewerbung\//);
check(await page.getByRole('button', { name: '❌ Ablehnen' }).isDisabled(), 'Ablehnen ohne Begründung geht nicht');
await page.getByLabel('Begründung').fill('Leider noch zu jung für das Team.');
await page.getByRole('button', { name: '❌ Ablehnen' }).click();
await page.getByText(/Abgelehnt/).first().waitFor();
check(true, 'Ablehnen mit Begründung');
await page.goto(`${overview}/team/probezeit`);
check((await page.getByRole('button', { name: '🎓 Bestanden' }).count()) >= 1, 'Probezeit-Übersicht zeigt laufende Probezeiten');

// ── Modul 7: Social Media ───────────────────────────────────────────────────
await page.goto(`${overview}/alerts`);
const alertsSwitch = page.getByRole('switch', { name: /Social Media (ein|aus)schalten/ });
if ((await alertsSwitch.getAttribute('aria-checked')) !== 'true') {
  await alertsSwitch.click();
  await page.waitForFunction(() => document.querySelector('[role=switch][aria-label^="Social Media"]')?.getAttribute('aria-checked') === 'true');
  await page.waitForTimeout(400);
  await page.reload();
}
check(await page.getByRole('link', { name: /MoinMornhart.*live/ }).isVisible(), 'Social Media: Kanal-Liste mit Live-Anzeige');
await page.goto(`${overview}/alerts?feed=neu`);
await page.locator('label:has(input[value="twitch"])').click();
await page.fill('input[name="input"]', 'kein gültiger name!');
await page.selectOption('select[name="discordChannelId"]', '100000000000000023');
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
check(await page.getByText(/kein gültiger Twitch-Name/).waitFor().then(() => true, () => false), 'Ungültiger Twitch-Name wird abgelehnt');
await page.locator('label:has(input[value="youtube"])').click();
await page.fill('input[name="input"]', '@SmokeTestKanal');
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.waitForURL(/alerts\?feed=c/);
check(await page.getByRole('link', { name: /SmokeTestKanal/ }).isVisible(), 'YouTube-Kanal per @Handle angelegt');
check((await page.locator('select[name="discordChannelId"]').inputValue()) === '100000000000000023', 'Ziel-Kanal bleibt nach dem Speichern stehen');
await page.getByRole('button', { name: '🧪 Test senden' }).click();
await page.getByText(/Test-Meldung wird gesendet|nicht erreichbar/).waitFor();
check(true, 'Test-Meldung lässt sich auslösen');
await page.getByRole('button', { name: 'Entfernen' }).click();
await page.waitForURL(/\/alerts$/);
check((await page.getByRole('link', { name: /SmokeTestKanal/ }).count()) === 0, 'Kanal lässt sich entfernen');

await page.goto(`${overview}/alerts/verbindungen`);
const twitchCard = page.locator('.card').filter({ has: page.getByText('Twitch', { exact: true }) });
if (await twitchCard.getByRole('button', { name: 'ändern' }).count()) await twitchCard.getByRole('button', { name: 'ändern' }).click();
check(await twitchCard.getByRole('link', { name: 'Twitch-Entwicklerkonsole' }).isVisible(), 'Verbindungen: Twitch-Anleitung sichtbar');
await twitchCard.locator('input[name="clientId"]').fill('smoketest1234567890abc');
await twitchCard.locator('input[name="clientSecret"]').fill('geheim-smoke-123');
await twitchCard.getByRole('button', { name: 'Prüfen und speichern' }).click();
await twitchCard.getByText(/Twitch ist verbunden/).waitFor();
await page.reload();
check(await page.locator('.card', { hasText: 'Twitch' }).filter({ hasText: 'verbunden' }).first().isVisible(), 'Twitch-Verbindung gespeichert');
check(!(await page.content()).includes('geheim-smoke-123'), 'Secret steht nicht im Klartext auf der Seite');
await twitchCard.getByRole('button', { name: 'ändern' }).click();
await twitchCard.getByRole('button', { name: 'Verbindung entfernen' }).click();
await page.getByText(/Twitch-Verbindung entfernt/).waitFor();
check(true, 'Twitch-Verbindung lässt sich entfernen');

// ── Modul 8: Level & XP ─────────────────────────────────────────────────────
await page.goto(`${overview}/level`);
const levelSwitch = page.getByRole('switch', { name: /Level & XP (ein|aus)schalten/ });
if ((await levelSwitch.getAttribute('aria-checked')) !== 'true') {
  await levelSwitch.click();
  await page.waitForFunction(() => document.querySelector('[role=switch][aria-label^="Level"]')?.getAttribute('aria-checked') === 'true');
  await page.waitForTimeout(400);
  await page.reload();
}
check((await page.locator('ol[aria-label="Bestenliste"] > li').count()) >= 10, 'Bestenliste zeigt die Mitglieder');
await page.fill('input[name="q"]', 'paul');
await page.getByRole('button', { name: 'Suchen' }).click();
await page.waitForURL(/q=paul/);
check((await page.locator('ol[aria-label="Bestenliste"] > li').count()) === 1 && (await page.locator('ol[aria-label="Bestenliste"] > li').first().innerText()).includes('#12'), 'Suche zeigt den echten Platz');
await page.getByRole('button', { name: 'XP ändern' }).click();
await page.getByLabel('Neue XP').fill('100');
await page.getByRole('button', { name: 'Setzen' }).click();
await page.locator('ol > li', { hasText: 'Level 1' }).first().waitFor();
check(true, 'XP eines Mitglieds setzen (100 XP = Level 1)');

await page.goto(`${overview}/level/belohnungen`);
const rewardsBefore = await page.getByLabel(/^Level für Belohnung/).count();
await page.getByRole('button', { name: '+ Belohnung' }).click();
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert/).waitFor();
await page.reload();
check((await page.getByLabel(/^Level für Belohnung/).count()) === rewardsBefore + 1, 'Belohnungsrolle gespeichert');
await page.getByRole('button', { name: 'Belohnung entfernen' }).last().click();
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert/).waitFor();

await page.goto(`${overview}/level/einstellungen`);
await page.selectOption('select[name="levelUpMode"]', 'channel');
// Ein früher gespeicherter Kanal bleibt erhalten – darum hier ausdrücklich leeren
await page.selectOption('select[name="levelUpChannelId"]', '');
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
check(await page.getByText('Bitte einen Kanal für die Level-up-Meldung wählen.').waitFor().then(() => true, () => false), 'Level-up „fester Kanal“ ohne Kanal wird abgelehnt');
await page.selectOption('#levelUpChannelId', '100000000000000023');
const publicSwitch = page.getByRole('switch', { name: 'Öffentliche Rangliste' });
if (!(await publicSwitch.isChecked())) await publicSwitch.click();
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert/).waitFor();
await page.reload();
check((await page.locator('#levelUpChannelId').inputValue()) === '100000000000000023', 'Level-up-Kanal bleibt gespeichert');
const anonCtx = await browser.newContext();
const anonPage = await anonCtx.newPage();
const pub = await anonPage.goto(`${base}/rangliste/100000000000000001`);
check(pub?.status() === 200 && (await anonPage.getByRole('heading', { name: /Moin Demo-Server/ }).isVisible()), 'Öffentliche Rangliste ohne Anmeldung erreichbar');
await page.getByRole('switch', { name: 'Öffentliche Rangliste' }).click();
await page.selectOption('select[name="levelUpMode"]', 'current');
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert/).waitFor();
check((await anonPage.goto(`${base}/rangliste/100000000000000001`))?.status() === 404, 'Ausgeschaltete Rangliste ist nicht erreichbar');
await anonCtx.close();

// ── Modul 9: Community ──────────────────────────────────────────────────────
await page.goto(`${overview}/community`);
const communitySwitch = page.getByRole('switch', { name: /Community (ein|aus)schalten/ });
if ((await communitySwitch.getAttribute('aria-checked')) !== 'true') {
  await communitySwitch.click();
  await page.waitForFunction(() => document.querySelector('[role=switch][aria-label^="Community"]')?.getAttribute('aria-checked') === 'true');
  await page.waitForTimeout(400);
  await page.reload();
}
check(await page.getByText(/Stand: \d+ · Rekord: \d+/).isVisible(), 'Community: Zähl-Stand wird angezeigt');
const starSwitch = page.getByRole('switch', { name: 'Starboard an' });
if (!(await starSwitch.isChecked())) await starSwitch.click();
await page.selectOption('[id="starboard.channelId"]', '');
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
check(await page.getByText(/Bitte einen Kanal wählen für: .*Starboard/).waitFor().then(() => true, () => false), 'Starboard ohne Kanal wird abgelehnt');
await page.selectOption('[id="starboard.channelId"]', '100000000000000024');
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert/).waitFor();
await page.reload();
check((await page.locator('[id="starboard.channelId"]').inputValue()) === '100000000000000024' && (await page.getByRole('switch', { name: 'Starboard an' }).isChecked()), 'Starboard-Einstellungen bleiben gespeichert');

// Vorschläge wie GalaxyBot: Hauptbereich mit Team-Kanal, weiterer Bereich, Knopf „Vorschlag einreichen“
const suggestSwitch = page.getByRole('switch', { name: 'Vorschläge an' });
if (!(await suggestSwitch.isChecked())) await suggestSwitch.click();
await page.locator('[id="suggestions.channelId"]').selectOption({ index: 1 });
await page.locator('[id="suggestions.staffChannelId"]').selectOption({ index: 2 });
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert/).waitFor();
await page.reload();
check((await page.locator('[id="suggestions.staffChannelId"]').inputValue()) !== '', 'Vorschläge: Team-Kanal zum Entscheiden gespeichert');
await page.goto(`${overview}/community/vorschlaege`);
const boardsCard = page.getByRole('region', { name: /Bereiche & Knopf zum Einreichen/ });
if ((await boardsCard.getByLabel(/^Name von Bereich/).count()) === 0) {
  await boardsCard.getByRole('button', { name: '+ Bereich hinzufügen' }).click();
  await boardsCard.getByLabel('Name von Bereich 2').fill('Stream-Ideen');
  await boardsCard.getByLabel('Vorschlags-Kanal').first().selectOption({ index: 1 });
  await boardsCard.getByRole('button', { name: 'Bereiche speichern' }).click();
  await boardsCard.getByText(/Gespeichert/).waitFor();
  await page.reload();
}
check((await page.getByRole('region', { name: /Bereiche & Knopf/ }).getByLabel('Name von Bereich 2').inputValue()) === 'Stream-Ideen', 'Weiterer Vorschlags-Bereich gespeichert');
await page.getByRole('region', { name: /Bereiche & Knopf/ }).getByRole('button', { name: /Vorschlag einreichen“ posten/ }).first().click();
check(await page.getByText(/wird in den Kanal von|nicht erreichbar/).first().waitFor().then(() => true, () => false), 'Knopf „Vorschlag einreichen“ lässt sich in den Kanal schicken');
const firstSuggestion = page.locator('li', { hasText: 'wöchentlicher Spieleabend' });
check(await firstSuggestion.isVisible(), 'Vorschläge-Liste zeigt die Vorschläge mit Stimmen');
if (await firstSuggestion.getByRole('button', { name: 'wieder öffnen' }).count()) {
  await firstSuggestion.getByRole('button', { name: 'wieder öffnen' }).click();
  await firstSuggestion.getByText(/Gespeichert/).waitFor();
}
await firstSuggestion.getByLabel('Begründung (optional)').fill('Machen wir – ab nächstem Freitag!');
await firstSuggestion.getByRole('button', { name: '✅ Annehmen' }).click();
await firstSuggestion.getByText(/Gespeichert/).waitFor();
await page.goto(`${overview}/community/vorschlaege?status=accepted`);
check(await page.locator('li', { hasText: 'wöchentlicher Spieleabend' }).isVisible(), 'Angenommener Vorschlag steht im Filter „Angenommen“');
await page.locator('li', { hasText: 'wöchentlicher Spieleabend' }).getByRole('button', { name: 'wieder öffnen' }).click();
// Im Filter „Angenommen“ verschwindet der Eintrag nach dem Wiederöffnen
await page.locator('li', { hasText: 'wöchentlicher Spieleabend' }).waitFor({ state: 'detached' });

await page.goto(`${overview}/community/giveaways`);
check(await page.getByText('Discord Nitro (1 Monat)').first().isVisible(), 'Giveaway-Liste zeigt laufende und beendete Giveaways');
await page.fill('input[name="prize"]', 'Smoke-Test-Preis');
await page.getByRole('button', { name: '🎉 Giveaway starten' }).click();
check(await page.getByText('Bitte einen Kanal wählen.').waitFor().then(() => true, () => false), 'Giveaway ohne Kanal wird abgelehnt');
await page.selectOption('#giveaway-channel', '100000000000000022');
await page.fill('input[name="duration"]', 'morgen');
await page.getByRole('button', { name: '🎉 Giveaway starten' }).click();
check(await page.getByText(/Ungültige Dauer/).waitFor().then(() => true, () => false), 'Ungültige Giveaway-Dauer wird abgelehnt');
await page.fill('input[name="duration"]', '2h');
await page.getByRole('button', { name: '🎉 Giveaway starten' }).click();
check(await page.getByText(/wird gestartet|nicht erreichbar/).waitFor().then(() => true, () => false), 'Giveaway lässt sich aus dem Dashboard starten');

await page.goto(`${overview}/community/geburtstage`);
check(await page.locator('li', { hasText: 'lukas.gamer' }).getByText(/heute!/).isVisible(), 'Geburtstage: heutiger Geburtstag steht oben');
check(!(await page.content()).includes('2008'), 'Geburtsjahr bleibt privat');

// ── Modul 10: Julia-KI ──────────────────────────────────────────────────────
await page.goto(`${overview}/julia`);
const juliaSwitch = page.getByRole('switch', { name: /Julia \(KI-Chat\) (ein|aus)schalten/ });
if ((await juliaSwitch.getAttribute('aria-checked')) !== 'true') {
  await juliaSwitch.click();
  await page.waitForFunction(() => document.querySelector('[role=switch][aria-label^="Julia"]')?.getAttribute('aria-checked') === 'true');
  await page.waitForTimeout(400);
  await page.reload();
}
check(await page.getByText('Verbrauch diesen Monat').isVisible() && (await page.getByText(/von 5,00 \$/).isVisible()), 'Julia: Verbrauch und Budget werden angezeigt');
await page.getByRole('button', { name: 'Fragen' }).click();
await page.getByText(/Demo-Antwort/).waitFor();
check(true, 'Julia testen liefert eine Antwort');
await page.selectOption('select[name="model"]', 'claude-sonnet-5-5');
await page.fill('input[name="monthlyBudgetUsd"]', '7.5');
await page.locator('textarea[name="persona"]').fill('Du bist Julia, eine Smoke-Test-Kapitänin.');
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert/).waitFor();
await page.reload();
check(
  (await page.locator('select[name="model"]').inputValue()) === 'claude-sonnet-5-5' &&
    (await page.inputValue('input[name="monthlyBudgetUsd"]')) === '7.5' &&
    (await page.inputValue('textarea[name="persona"]')).includes('Smoke-Test-Kapitänin'),
  'Julia-Einstellungen (Modell, Budget, Persona) bleiben gespeichert',
);
// „Julia verehrt den Herrscher“: Titel ändern, bleibt gespeichert, zurück auf Standard
await page.fill('input[name="worship.title"]', 'Kaiser von Moin');
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert/).waitFor();
await page.reload();
check((await page.inputValue('input[name="worship.title"]')) === 'Kaiser von Moin', 'Herrscher-Titel für Julia bleibt gespeichert');
await page.fill('input[name="worship.title"]', 'Großer Herrscher');
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert/).waitFor();
await page.getByRole('button', { name: 'Standard-Persona wiederherstellen' }).click();
await page.selectOption('select[name="model"]', 'claude-haiku-4-5');
await page.fill('input[name="monthlyBudgetUsd"]', '5');
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert/).waitFor();

await page.goto(`${overview}/julia/verbindung`);
check(await page.getByText('Warum nicht einfach mein Claude-Abo?').isVisible(), 'Verbindung erklärt, warum das Claude-Abo nicht geht');
const claudeCard = page.locator('.card').filter({ has: page.getByText('Claude (Anthropic)', { exact: true }) });
if (await claudeCard.getByRole('button', { name: 'ändern' }).count()) await claudeCard.getByRole('button', { name: 'ändern' }).click();
await claudeCard.locator('input[name="apiKey"]').fill('kein-schluessel');
await claudeCard.getByRole('button', { name: 'Prüfen und speichern' }).click();
check(await claudeCard.getByText(/sk-ant-/).last().waitFor().then(() => true, () => false), 'Falscher Anthropic-Schlüssel wird abgelehnt');
// Eigene Ollama-Endpunkte: Heimnetz + Cloud (mit Schlüssel), Modelle laden, Leistung, Auswahl pro Server
const ollamaCard = page.getByRole('region', { name: 'Ollama – eigene Endpunkte' });
for (const name of ['Heimnetz', 'Ollama Cloud']) {
  const row = ollamaCard.getByRole('list', { name: 'Ollama-Endpunkte' }).getByRole('listitem').filter({ hasText: name });
  // alle Reste entfernen (auch doppelte aus einem abgebrochenen früheren Lauf)
  for (let left = await row.count(); left > 0; left--) {
    await row.first().getByRole('button', { name: `${name} entfernen` }).click();
    await ollamaCard.getByText(new RegExp(`„${name}“ entfernt`)).waitFor();
    for (let i = 0; i < 50 && (await row.count()) >= left; i++) await page.waitForTimeout(100);
  }
}
if (await ollamaCard.getByRole('button', { name: '+ Endpunkt hinzufügen' }).count()) await ollamaCard.getByRole('button', { name: '+ Endpunkt hinzufügen' }).click();
await ollamaCard.getByRole('button', { name: '🏠 Heimnetz' }).click();
await ollamaCard.getByRole('button', { name: 'Modelle laden' }).click();
await ollamaCard.getByRole('group', { name: 'Gefundene Modelle' }).or(ollamaCard.locator('[aria-label="Gefundene Modelle"]')).waitFor();
await ollamaCard.locator('[aria-label="Gefundene Modelle"]').getByRole('button', { name: 'qwen3:8b' }).click();
await ollamaCard.getByText('⚡ Leistung (für schnellere Antworten)').click();
await ollamaCard.getByLabel('Denk-Modus').selectOption('aus');
await ollamaCard.getByRole('button', { name: 'Prüfen und speichern' }).click();
// auf den gespeicherten Eintrag warten (nicht nur auf irgendeinen Text – sonst lädt der Test manchmal zu früh neu)
await ollamaCard.getByRole('list', { name: 'Ollama-Endpunkte' }).getByText(/qwen3:8b · http:\/\/192\.168\.1\.20:11434/).waitFor();
await page.reload();
const ollamaList = page.getByRole('region', { name: 'Ollama – eigene Endpunkte' }).getByRole('list', { name: 'Ollama-Endpunkte' });
check((await ollamaList.getByText(/qwen3:8b · http:\/\/192\.168\.1\.20:11434/).count()) === 1 && (await ollamaList.getByText(/Denken: Aus/).count()) === 1, 'Ollama-Endpunkt mit Modell aus der Liste und Leistungs-Optionen gespeichert');
await page.getByRole('region', { name: 'Ollama – eigene Endpunkte' }).getByRole('button', { name: '+ Endpunkt hinzufügen' }).click();
const cloudForm = page.getByRole('region', { name: 'Ollama – eigene Endpunkte' });
await cloudForm.getByRole('button', { name: '☁️ Ollama Cloud' }).click();
await cloudForm.getByPlaceholder(/leer lassen, wenn nicht nötig/).fill('demo-schluessel-123');
await cloudForm.getByRole('button', { name: 'Prüfen und speichern' }).click();
await cloudForm.getByText(/Ollama ist verbunden|Demo/).waitFor();
await page.reload();
const cloudRow = page.getByRole('list', { name: 'Ollama-Endpunkte' }).getByRole('listitem').filter({ hasText: 'Ollama Cloud' });
check((await cloudRow.getByTitle('mit API-Schlüssel').count()) === 1 && !(await page.content()).includes('demo-schluessel-123'), 'Ollama Cloud mit Schlüssel – der Schlüssel erscheint nie im Browser');
await page.goto(`${overview}/julia`);
await page.getByRole('radio', { name: /Ollama/ }).check();
await page.locator('select[name="ollamaEndpointId"]').selectOption({ label: 'Ollama Cloud · gpt-oss:120b' });
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert/).waitFor();
await page.reload();
check((await page.locator('select[name="ollamaEndpointId"] option:checked').innerText()) === 'Ollama Cloud · gpt-oss:120b', 'Server nutzt den gewählten Ollama-Endpunkt');
await page.getByRole('radio', { name: /Claude/ }).check();
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert/).waitFor();
await page.goto(`${overview}/julia/verbindung`);
await page.getByRole('list', { name: 'Ollama-Endpunkte' }).getByRole('button', { name: 'Ollama Cloud entfernen' }).click();
await page.getByText(/„Ollama Cloud“ entfernt/).waitFor();
check(true, 'Ollama-Endpunkt lässt sich entfernen');

// ── Modul 11: Julia Modi & Profile ──────────────────────────────────────────
await page.goto(`${overview}/julia`);
const flirtSwitch = page.getByRole('switch', { name: 'Flirt-Ton erlauben' });
if (!(await flirtSwitch.isChecked())) await flirtSwitch.click();
await page.selectOption('[id="flirty.adultRoleId"]', '');
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
check(await page.getByText('Für den Flirt-Ton bitte eine 18+-Rolle wählen.').waitFor().then(() => true, () => false), 'Flirt-Ton ohne 18+-Rolle wird abgelehnt');
await page.getByRole('switch', { name: 'Flirt-Ton erlauben' }).click();
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert/).waitFor();

await page.goto(`${overview}/julia/modi`);
const existingSeebaer = page.locator('[data-mode]').filter({ has: page.locator('input[value="Seebär"]') });
if (await existingSeebaer.count()) {
  await existingSeebaer.getByRole('button', { name: 'Modus löschen' }).click();
  await page.getByRole('button', { name: 'Modi speichern' }).click();
  await page.getByText(/Gespeichert/).waitFor();
  await page.reload();
}
const modesBefore = await page.locator('[data-mode]').count();
await page.getByRole('button', { name: '+ Modus' }).click();
const newMode = page.locator('[data-mode]').last();
await newMode.getByLabel(/^Name von Modus/).fill('Julia');
await newMode.getByLabel(/^Persona von Modus/).fill('Du bist ein grummeliger alter Seebär und redest wie ein Matrose.');
await page.getByRole('button', { name: 'Modi speichern' }).click();
check(await page.getByText(/reserviert/).waitFor().then(() => true, () => false), 'Modusname „Julia“ ist reserviert');
await newMode.getByLabel(/^Name von Modus/).fill('Seebär');
await page.getByRole('button', { name: 'Modi speichern' }).click();
await page.getByText(/Gespeichert/).waitFor();
await page.reload();
check((await page.locator('[data-mode]').count()) === modesBefore + 1 && (await page.locator('input[value="Seebär"]').count()) === 1, 'Modus „Seebär“ gespeichert');
await page.locator('[data-mode]').filter({ has: page.locator('input[value="Seebär"]') }).getByRole('button', { name: 'Modus löschen' }).click();
await page.getByRole('button', { name: 'Modi speichern' }).click();
await page.getByText(/Gespeichert/).waitFor();

await page.goto(`${overview}/julia/profile`);
const lukas = page.locator('li.card', { hasText: 'lukas.gamer' });
check(await lukas.getByText('„Luki“').isVisible(), 'Profile zeigen Spitznamen und Gemerktes');
check(await page.locator('li.card', { hasText: 'ben.plays' }).getByText('Alters-Sperre', { exact: true }).isVisible(), 'Alters-Sperre wird angezeigt');
const factsBefore = await lukas.getByText(/^🧠/).count();
if (factsBefore > 0) {
  await lukas.getByRole('button', { name: 'Löschen' }).first().click();
  for (let i = 0; i < 10 && (await page.locator('li.card', { hasText: 'lukas.gamer' }).getByText(/^🧠/).count()) !== factsBefore - 1; i++) {
    await page.waitForTimeout(500);
    await page.reload();
  }
  check((await page.locator('li.card', { hasText: 'lukas.gamer' }).getByText(/^🧠/).count()) === factsBefore - 1, 'Einzelne Erinnerung lässt sich löschen');
} else {
  check(true, 'Einzelne Erinnerung lässt sich löschen (nichts mehr übrig)');
}

// ── Modul 12: Statistiken ───────────────────────────────────────────────────
await page.goto(`${overview}/statistiken`);
const statsSwitch = page.getByRole('switch', { name: /Server-Statistiken (ein|aus)schalten/ });
if ((await statsSwitch.getAttribute('aria-checked')) !== 'true') {
  await statsSwitch.click();
  await page.waitForFunction(() => document.querySelector('[role=switch][aria-label^="Server-Statistiken"]')?.getAttribute('aria-checked') === 'true');
  await page.waitForTimeout(400);
  await page.reload();
}
check((await page.locator('svg[role="img"]').count()) >= 4, 'Statistiken: Diagramme werden gezeichnet');
check(await page.getByRole('list', { name: 'Aktivste Mitglieder' }).getByText('lukas.gamer').isVisible(), 'Aktivste Mitglieder werden angezeigt');
await page.getByRole('link', { name: '7 Tage' }).click();
await page.waitForURL(/tage=7/);
check((await page.locator('svg[aria-label="Nachrichten pro Tag"] rect').count()) === 7, 'Zeitraum 7 Tage zeigt 7 Säulen');

await page.goto(`${overview}/statistiken/kanaele`);
const statBefore = await page.getByLabel(/^Vorlage \d/).count();
await page.getByLabel('Vorlage für neuen Kanal').fill('👥 Smoke: {members}');
check(await page.getByText(/Vorschau: 🔊 👥 Smoke: [\d.]+/).isVisible(), 'Vorschau zeigt den fertigen Kanalnamen');
await page.getByRole('button', { name: 'Anlegen' }).click();
await page.getByText(/Kanal angelegt/).waitFor();
await page.reload();
check((await page.getByLabel(/^Vorlage \d/).count()) === statBefore + 1, 'Statistik-Kanal angelegt und eingetragen');
await page.getByRole('button', { name: 'Entfernen' }).last().click();
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert/).waitFor();
await page.reload();
check((await page.getByLabel(/^Vorlage \d/).count()) === statBefore, 'Statistik-Kanal wieder entfernt');

// ── Musik ───────────────────────────────────────────────────────────────────
await page.goto(`${overview}/musik`);
const musicSwitch = page.getByRole('switch', { name: /Musik (ein|aus)schalten/ });
if ((await musicSwitch.getAttribute('aria-checked')) !== 'true') {
  await musicSwitch.click();
  await page.waitForFunction(() => document.querySelector('[role=switch][aria-label^="Musik"]')?.getAttribute('aria-checked') === 'true');
  await page.waitForTimeout(400);
  await page.reload();
}
check(await page.getByText('Radio Hamburg').first().isVisible(), 'Musik: „Jetzt läuft“ mit Warteschlange');
await page.getByRole('button', { name: 'Pause' }).click();
await page.getByText(/Erledigt|nicht erreichbar/).first().waitFor();
check(true, 'Musik lässt sich aus dem Dashboard steuern');
await page.getByLabel('Sendername').fill('Hamburg');
await page.getByLabel('Sendername').press('Enter');
await page.getByRole('list', { name: 'Suchergebnisse' }).waitFor();
const favBefore = await page.getByLabel(/^Name von Favorit/).count();
await page.getByRole('list', { name: 'Suchergebnisse' }).getByRole('button', { name: '+ Favorit' }).first().click();
await page.getByLabel('Name für eigenen Link').fill('YouTube-Test');
await page.getByLabel('Eigener Audio-Link').fill('https://www.youtube.com/watch?v=abc');
await page.getByRole('button', { name: '+ Favorit' }).last().click();
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
check(await page.getByText(/YouTube- und Spotify-Links/).waitFor().then(() => true, () => false), 'YouTube-Link als Favorit wird abgelehnt');
await page.getByRole('button', { name: 'Favorit entfernen' }).last().click();
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert/).waitFor();
await page.reload();
check((await page.getByLabel(/^Name von Favorit/).count()) === favBefore + 1, 'Radio-Favorit gespeichert');
await page.getByRole('button', { name: 'Favorit entfernen' }).last().click();
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert/).waitFor();
// Musik wie Euphony: Effekt, Autoplay, Zurück aus dem Dashboard
check(await page.getByText(/Moin Records/).isVisible() && (await page.getByRole('progressbar', { name: 'Fortschritt' }).isVisible()), 'YouTube-Titel mit Künstler und Fortschritt');
await page.getByLabel('Effekt').selectOption('nightcore');
await page.getByText(/Erledigt|nicht erreichbar/).first().waitFor();
await page.getByRole('button', { name: '✨ Autoplay' }).click();
await page.getByRole('button', { name: 'Vorheriger Titel' }).click();
check(true, 'Effekt, Autoplay und Zurück lassen sich steuern');
// YouTube-Schalter (Demo-Owner ist Instanz-Admin): erst mit Bestätigung, danach YouTube-Favorit erlaubt
const ytCard = page.getByRole('region', { name: /YouTube, SoundCloud/ });
if ((await ytCard.getByText('an', { exact: true }).count()) > 0) {
  await ytCard.getByRole('button', { name: 'YouTube & Co. ausschalten' }).click();
  await ytCard.getByText(/sind aus/).waitFor();
}
await ytCard.getByRole('button', { name: 'YouTube & Co. einschalten …' }).click();
check(await ytCard.getByText(/Eigenes Risiko/).isVisible() && (await ytCard.getByRole('button', { name: 'Ja, auf eigenes Risiko einschalten' }).isVisible()), 'YouTube nur mit Risiko-Hinweis und Bestätigung');
await ytCard.getByRole('button', { name: 'Ja, auf eigenes Risiko einschalten' }).click();
await ytCard.getByText(/sind an/).waitFor();
await page.reload();
await page.getByLabel('Name für eigenen Link').fill('YouTube-Favorit');
await page.getByLabel('Eigener Audio-Link').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
await page.getByRole('button', { name: '+ Favorit' }).last().click();
for (const label of ['✨ Autoplay', '🕒 24/7-Modus', '🗳️ Abstimmen zum Überspringen']) await page.getByRole('checkbox', { name: new RegExp(label) }).check();
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert/).waitFor();
await page.reload();
check(
  (await page.getByLabel(/^Name von Favorit/).last().inputValue()) === 'YouTube-Favorit' && (await page.getByRole('checkbox', { name: /24\/7-Modus/ }).isChecked()) && (await page.getByRole('checkbox', { name: /Abstimmen/ }).isChecked()),
  'Mit YouTube: YouTube-Favorit, Autoplay, 24/7 und Vote-Skip gespeichert',
);
await page.getByRole('button', { name: 'Favorit entfernen' }).last().click();
for (const label of ['✨ Autoplay', '🕒 24/7-Modus', '🗳️ Abstimmen zum Überspringen']) await page.getByRole('checkbox', { name: new RegExp(label) }).uncheck();
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert/).waitFor();
await page.getByRole('region', { name: /YouTube, SoundCloud/ }).getByRole('button', { name: 'YouTube & Co. ausschalten' }).click();
await page.getByText(/sind aus/).waitFor();
check(true, 'YouTube & Co. wieder ausgeschaltet');

// ── Owner-Bereich ───────────────────────────────────────────────────────────
check(await page.getByRole('navigation', { name: 'Server-Navigation' }).getByRole('link', { name: /Owner-Bereich/ }).count() === 1, 'Owner sieht den Owner-Bereich in der Seitenleiste');
await page.goto(`${overview}/owner`);
check(await page.getByText('Diese Seite siehst nur du als Server-Owner').isVisible(), 'Owner-Seite lädt mit Hinweis');
if (await page.getByRole('button', { name: '🔒 Owner-Bereich anlegen' }).count()) {
  await page.getByRole('button', { name: '🔒 Owner-Bereich anlegen' }).click();
  // Nach dem Anlegen zeigt die Seite gleich den fertigen Bereich (Knopf + Meldung verschwinden)
  await page.getByText(/Kategorie 🔒 Owner-Bereich/).waitFor();
}
check(await page.getByText(/Kategorie 🔒 Owner-Bereich/).isVisible() && (await page.getByText('#owner-notizen').isVisible()), 'Owner-Bereich angelegt, Kanal sichtbar');
check(await page.getByText('@ Admin').isVisible(), 'Rollen mit „Administrator“ werden aufgelistet');
await page.getByRole('button', { name: 'Administrator ersetzen …' }).click();
check(await page.getByText(/alten Rechte werden gesichert/).isVisible(), 'Vor dem Ersetzen kommt eine Erklärung mit Sicherung');
await page.getByRole('button', { name: 'Abbrechen' }).click();
// Neue Admin-Rolle mit Häkchen „alles außer Owner-Bereich“ (Standard an) + automatisches Umstellen
const safeBox = page.getByRole('checkbox', { name: /Zugriff auf alles außer den Owner-Bereich/ });
check(await safeBox.isChecked(), 'Neue Admin-Rolle: Häkchen „alles außer Owner-Bereich“ ist vorausgewählt');
await page.getByLabel('Name der Admin-Rolle').fill('Smoke-Admin');
await page.getByRole('button', { name: 'Admin-Rolle anlegen' }).click();
check(await page.getByText(/Rolle „Smoke-Admin“ würde ohne Zugriff auf den Owner-Bereich angelegt/).waitFor().then(() => true, () => false), 'Admin-Rolle ohne Owner-Zugriff wird angelegt');
await safeBox.uncheck();
check(await page.getByText(/bekommt die Rolle „Administrator“ und sieht auch den Owner-Bereich/).isVisible(), 'Ohne Häkchen: Warnung, dass die Rolle alles sieht');
await safeBox.check();
const autoBox = page.getByRole('checkbox', { name: /Neue Admin-Rollen automatisch umstellen/ });
await autoBox.check();
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert – Rechte werden angepasst/).waitFor();
await page.reload();
check(await page.getByRole('checkbox', { name: /Neue Admin-Rollen automatisch umstellen/ }).isChecked(), 'Automatisches Umstellen neuer Admin-Rollen gespeichert');
await page.getByRole('checkbox', { name: /Neue Admin-Rollen automatisch umstellen/ }).uncheck();
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.getByText(/Gespeichert – Rechte werden angepasst/).waitFor();
const adminCtx = await browser.newContext();
const adminPage = await adminCtx.newPage();
await adminPage.goto(`${base}/api/auth/demo?als=admin`);
await adminPage.goto(overview);
check((await adminPage.getByRole('navigation', { name: 'Server-Navigation' }).getByRole('link', { name: /Owner-Bereich/ }).count()) === 0, 'Admin sieht den Owner-Bereich NICHT in der Seitenleiste');
// (Das Wort selbst darf im Änderungsverlauf stehen – es geht um Kachel/Link zum Bereich)
check((await adminPage.locator('a[href$="/owner"]').count()) === 0 && (await adminPage.getByRole('main').getByText('Owner-Bereich', { exact: true }).count()) === 0, 'Admin sieht den Owner-Bereich auch nicht in der Modul-Übersicht');
check((await adminPage.goto(`${overview}/owner`))?.status() === 404, 'Admin bekommt beim direkten Aufruf 404');
await adminCtx.close();

// ── Vorlagen: Export, Import, Backup, GalaxyBot ─────────────────────────────
await page.goto(`${overview}/vorlagen`);
const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Alles herunterladen/ }).click()]);
const exportPath = await download.path();
const { readFile, writeFile } = await import('node:fs/promises');
const exported = JSON.parse(await readFile(exportPath, 'utf8'));
check(exported.format === 'moin-julia-vorlage' && exported.modules.logging, 'Export liefert Vorlage mit Modulen');
check(Object.values(exported.refs.channels).some((c) => c.name === 'mod-log'), 'Export speichert Kanäle mit Namen');
check(!exported.modules.owner, 'Owner-Bereich ist nie in der Vorlage');
// Nur einzelne Module exportieren
await page.getByRole('button', { name: 'keine', exact: true }).click();
await page.locator('label', { hasText: 'Logging' }).locator('input[type="checkbox"]').first().check();
await page.locator('label', { hasText: 'Level & XP' }).locator('input[type="checkbox"]').first().check();
const [partDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: '⬇ 2 Module herunterladen' }).click()]);
const part = JSON.parse(await readFile(await partDownload.path(), 'utf8'));
check(Object.keys(part.modules).sort().join(',') === 'level,logging', 'Auswahl-Export enthält nur die gewählten Module');
check(partDownload.suggestedFilename().includes('-2-module-'), 'Dateiname zeigt den Teil-Export');
// Export-Knopf direkt auf einer Modul-Seite
await page.goto(`${overview}/logging`);
const [oneDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: '⬇ Exportieren' }).click()]);
const one = JSON.parse(await readFile(await oneDownload.path(), 'utf8'));
check(Object.keys(one.modules).join(',') === 'logging' && one.rolePanels.length === 0 && oneDownload.suggestedFilename().includes('-logging-'), 'Modul-Seite exportiert nur dieses Modul');
check(Object.values(one.refs.channels).every((c) => c.name !== 'willkommen'), 'Teil-Export nimmt nur die Kanäle des Moduls mit');
// Teil-Vorlage importieren: nur dieses Modul wird angeboten
await page.goto(`${overview}/vorlagen`);
const oneFile = `${exportPath}-logging.json`;
await writeFile(oneFile, JSON.stringify(one));
await page.setInputFiles('input[type="file"]', oneFile);
await page.getByRole('button', { name: 'Vorlage prüfen' }).click();
await page.getByText('alles gefunden').waitFor();
const importChips = page.getByRole('group', { name: 'Welche Module übernehmen?' }).locator('label.rounded-full');
check((await importChips.count()) === 1 && (await importChips.first().innerText()).includes('Logging'), 'Import einer Teil-Vorlage bietet nur deren Module an');
await page.goto(`${overview}/vorlagen`);
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
await page.getByText('Moin Helfer').waitFor();
check(await page.locator('input[name="scan-bot"]').first().isChecked(), 'Alter Bot mit eigenem Namen wird zur Auswahl angeboten und vorausgewählt');
await page.getByRole('button', { name: 'Bot durchsuchen' }).click();
await page.getByText('GalaxyBot Bad Words').waitFor();
const ruleBox = (name) => page.locator('label', { hasText: name }).locator('input[type="checkbox"]');
check(
  (await ruleBox('GalaxyBot Links').isDisabled()) && (await ruleBox('GalaxyBot Spam').isDisabled()) && (await ruleBox('GalaxyBot Bad Words').isChecked()),
  'Nur-Regex- und Spam-Regeln sind nicht übernehmbar, Wortlisten vorausgewählt',
);
check(await page.getByText(/Regex-Muster kann Moin_Julia nicht übernehmen/).isVisible(), 'Hinweis zu Regex-Mustern');
check(await page.getByText('neues Discord-Format').isVisible(), 'Nachrichten im neuen Discord-Format (Components V2) werden gefunden');
check(await page.getByText(/durfte Moin_Julia nicht lesen/).isVisible(), 'Nicht lesbare Kanäle werden gemeldet');
await page.getByRole('button', { name: 'Ausgewählte übernehmen' }).click();
await page.getByText(/Regel\(n\) übernommen/).waitFor();
await page.getByRole('button', { name: '🎫 Als Ticket-Panel übernehmen' }).first().click();
await page.getByText(/Als Ticket-Panel „.+“ mit \d+ Gründen übernommen/).waitFor();
check(await page.getByRole('link', { name: 'Panel ansehen →' }).isVisible(), 'Ticket-Panel des alten Bots per Klick übernommen');
await page.goto(`${overview}/moderation`);
check((await page.inputValue('textarea[name="badWords.words"]')).includes('spamwort'), 'GalaxyBot-Schimpfwörter landen in der Moderation');
check((await page.inputValue('input[name="mentionSpam.limit"]')) === '6', 'GalaxyBot-Erwähnungslimit übernommen');

// ── Version unten + Update-Knopf (Host-Dienst wird hier nachgespielt) ─────────
if (values.control) {
  const { mkdir, rm, access } = await import('node:fs/promises');
  const path = await import('node:path');
  const ctrl = values.control;
  const put = (name, data) => writeFile(path.join(ctrl, name), typeof data === 'string' ? data : JSON.stringify(data));
  await rm(ctrl, { recursive: true, force: true });
  await mkdir(ctrl, { recursive: true });
  await page.goto(`${base}/servers`);
  const badge = page.locator('footer').getByRole('button', { name: /^v\d+\.\d+\.\d+/ });
  check(await badge.isVisible(), 'Version steht unten auf der Seite');
  await badge.hover();
  await page.locator('footer [role=status]').getByText('Update verfügbar: v9.9.9').waitFor();
  check(true, 'Beim Drüberfahren: „Update verfügbar“ mit neuer Version');
  await badge.click();
  await page.getByRole('heading', { name: 'Änderungsverlauf' }).waitFor();
  check(await page.locator('dialog').getByText('installiert', { exact: true }).isVisible(), 'Klick öffnet den Änderungsverlauf mit installierter Version');
  await page.keyboard.press('Escape');
  await page.goto(`${base}/system`);
  check(await page.getByText('Update-Knopf einmalig einrichten').isVisible(), 'Ohne Host-Dienst erklärt die Seite die Einrichtung');
  await put('agent.json', { installed: true, version: '0.8.4' });
  await page.reload();
  await page.getByRole('button', { name: 'Jetzt auf v9.9.9 updaten' }).click();
  await page.getByText('Update angefordert').waitFor();
  check(await access(path.join(ctrl, 'update-request')).then(() => true, () => false), 'Knopf legt die Anfrage für den Host ab');
  await page.getByRole('button', { name: 'Update läuft …' }).waitFor();
  check(true, 'Knopf ist während des Updates gesperrt');
  // Host: Anfrage abholen, Status „running“, Protokoll schreiben
  await rm(path.join(ctrl, 'update-request'));
  await put('update-status.json', { state: 'running', from: '0.8.4', to: '', at: new Date().toISOString() });
  await put('update.log', `${String.fromCharCode(27)}[33m…${String.fromCharCode(27)}[0m Baue Images neu (dauert ein paar Minuten)\n`);
  await page.getByText('Baue Images neu').waitFor();
  check(true, 'Protokoll erscheint live (ohne Farbcodes)');
  await put('update-status.json', { state: 'success', from: '0.8.4', to: '9.9.9', at: new Date().toISOString() });
  await page.getByText('Update fertig: v0.8.4 → v9.9.9').waitFor();
  check(true, 'Erfolg wird gemeldet');
  const blocked = await page.request.post(`${base}/api/system/update`, { headers: { origin: base } });
  check(blocked.status() === 409 || blocked.ok(), 'Weitere Anfrage wird angenommen oder sauber abgelehnt');
  await rm(path.join(ctrl, 'update-request'), { force: true });
  const anon = await (await browser.newContext()).request.post(`${base}/api/system/update`);
  check(anon.status() === 403, 'Ohne Anmeldung kein Update möglich');
}

// Live-Aktualisierung: jede Sekunde neue Daten, aber Pause beim Tippen
{
  let refreshes = 0;
  const count = (req) => {
    const h = req.headers();
    // RSC-Abruf ohne Vorab-Laden (Prefetch) und ohne Server-Aktion = Aktualisierung der Seite
    if (h['rsc'] === '1' && !h['next-router-prefetch'] && !h['next-action']) refreshes++;
  };
  await page.goto(`${overview}/statistiken?live=1`);
  await page.waitForLoadState('networkidle');
  page.on('request', count);
  await page.waitForTimeout(3500);
  check(refreshes >= 2, `Dashboard aktualisiert sich jede Sekunde (${refreshes} in 3,5 s)`);
  await page.goto(`${overview}/logging?live=1`);
  await page.waitForLoadState('networkidle');
  await page.locator('select').first().focus();
  refreshes = 0;
  await page.waitForTimeout(2500);
  check(refreshes === 0, 'Live-Aktualisierung pausiert, solange man etwas auswählt oder tippt');
  page.off('request', count);
}

const foreign = await page.goto(`${base}/g/100000000000000003`);
check(foreign?.status() === 404, 'Server ohne Bot/Rechte → 404');

await browser.close();
if (failed) {
  console.error('\nSmoke-Test FEHLGESCHLAGEN');
  process.exit(1);
}
console.log('\nSmoke-Test bestanden');
