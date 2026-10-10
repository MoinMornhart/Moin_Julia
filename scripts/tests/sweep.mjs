// ─────────────────────────────────────────────────────────────────────────────
//  Qualitäts-Rundgang (Dashboard im Demo-Modus): alle Seiten auf Desktop und Handy (390 px)
//  auf HTTP-Status, Konsolenfehler, seitliches Scrollen und Barrierefreiheit (axe, WCAG 2 A/AA,
//  nur ernste Funde) prüfen.
//
//    node scripts/tests/sweep.mjs --url http://localhost:3000
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

const { values } = parseArgs({ options: { url: { type: 'string', default: 'http://localhost:3000' } } });
const base = values.url.replace(/\/+$/, '');
const g = '/g/100000000000000001';
const axe = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const routes = [
  '/', '/bauprotokoll', '/servers', '/system',
  g, `${g}/einstellungen`, `${g}/logging`, `${g}/moderation`, `${g}/moderation/faelle`, `${g}/schutz`,
  `${g}/willkommen`, `${g}/willkommen/panels`, `${g}/tempvoice`, `${g}/tickets`, `${g}/tickets/liste`, `${g}/tickets/panels`,
  `${g}/team`, `${g}/team/stellen`, `${g}/team/probezeit`, `${g}/team/einstellungen`,
  `${g}/alerts`, `${g}/alerts/verbindungen`, `${g}/level`, `${g}/level/belohnungen`, `${g}/level/einstellungen`,
  `${g}/community`, `${g}/community/vorschlaege`, `${g}/community/giveaways`, `${g}/community/geburtstage`,
  `${g}/julia`, `${g}/julia/modi`, `${g}/julia/profile`, `${g}/julia/verbindung`,
  `${g}/statistiken`, `${g}/statistiken/kanaele`, `${g}/musik`, `${g}/owner`,
  `${g}/vorlagen`, `${g}/vorlagen/bilder`, `${g}/vorlagen/galaxybot`, `${g}/vorlagen/sicherungen`,
  '/bewerben/100000000000000001',
];

const browser = await chromium.launch();
const problems = [];
const axeSummary = new Map();
for (const [vp, label] of [[{ width: 1440, height: 900 }, 'desktop'], [{ width: 390, height: 844 }, 'mobil']]) {
  const ctx = await browser.newContext({ viewport: vp, colorScheme: 'dark', locale: 'de-DE' });
  const page = await ctx.newPage();
  let errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`));
  await page.goto(`${base}/api/auth/demo`);
  for (const r of routes) {
    errors = [];
    const res = await page.goto(base + r, { waitUntil: 'networkidle' });
    const status = res?.status() ?? 0;
    if (status !== 200) problems.push(`${label} ${r}: HTTP ${status}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 0) problems.push(`${label} ${r}: ${overflow}px seitliches Scrollen`);
    // Bereiche, die nur um wenige Pixel überstehen → Windows zeigt dort eine winzige Scrollleiste (▲ ▼)
    const mini = await page.evaluate(() =>
      [...document.querySelectorAll('body *')]
        .filter((el) => {
          const cs = getComputedStyle(el);
          const dy = el.scrollHeight - el.clientHeight;
          const dx = el.scrollWidth - el.clientWidth;
          return (/(auto|scroll)/.test(cs.overflowY) && dy > 0 && dy <= 8) || (/(auto|scroll)/.test(cs.overflowX) && dx > 0 && dx <= 8);
        })
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 4).join('.')}`),
    );
    if (mini.length) problems.push(`${label} ${r}: Mini-Scrollleiste bei ${[...new Set(mini)].join(', ')}`);
    const relevant = errors.filter((e) => !/favicon|cdn\.discordapp|Failed to load resource/.test(e));
    if (relevant.length) problems.push(`${label} ${r}: Konsole: ${relevant.join(' | ')}`);
    if (label === 'desktop') {
      await page.waitForTimeout(1500); // Einblend-Animationen abwarten, sonst misst axe halbtransparente Texte
      await page.addScriptTag({ content: axe });
      const result = await page.evaluate(async () => {
        // @ts-ignore
        const r = await window.axe.run(document, { resultTypes: ['violations'], runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
        return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
      });
      for (const v of result) {
        const key = `${v.id} (${v.impact}): ${v.help}`;
        const list = axeSummary.get(key) ?? [];
        list.push(`${r} → ${v.nodes.join(' ; ')}`);
        axeSummary.set(key, list);
      }
    }
  }
  await ctx.close();
}
await browser.close();
console.log(`Seiten: ${routes.length} × 2`);
console.log(problems.length ? `PROBLEME:\n${problems.join('\n')}` : 'Keine HTTP-, Konsolen- oder Layout-Probleme.');
console.log(axeSummary.size ? 'AXE:' : 'axe: keine ernsten Funde.');
for (const [k, v] of axeSummary) console.log(`- ${k}\n    ${v.slice(0, 4).join('\n    ')}${v.length > 4 ? `\n    … +${v.length - 4} Seiten` : ''}`);
process.exit(problems.length || axeSummary.size ? 1 : 0);
