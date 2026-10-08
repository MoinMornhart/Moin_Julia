/**
 * Zeichnet die Beispiel-Embeds eines Moduls im Discord-Look als PNG (fürs Bauprotokoll).
 *
 *   pnpm --filter @moin/bot exec tsx ../../scripts/embed-preview.ts --module logging --out ../../docs/bauprotokoll/img/03-logging
 *
 * Jedes Modul liefert dafür in apps/bot/src/modules/<modul>/preview.ts die Funktion previewEmbeds().
 */
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

interface Embed {
  color?: number;
  title?: string;
  description?: string;
  url?: string;
  author?: { name: string };
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
  thumbnail?: { url: string };
}

const { values } = parseArgs({ options: { module: { type: 'string' }, out: { type: 'string' } } });
if (!values.module || !values.out) {
  console.error('Aufruf: --module <id> --out <ordner>');
  process.exit(1);
}

const modulePath = path.resolve(import.meta.dirname, '../apps/bot/src/modules', values.module, 'preview.ts');
const mod = (await import(pathToFileURL(modulePath).href)) as {
  previewEmbeds: () => { caption: string; embeds: Embed[]; buttons?: { label: string; emoji?: string; style?: 'secondary' | 'success' | 'danger' }[][] }[];
  previewNames?: Record<string, string>;
};
const names = mod.previewNames ?? {};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Discord-Markdown in einfaches HTML (nur was die Embeds nutzen). */
function md(text: string): string {
  let html = esc(text);
  html = html.replace(/&lt;t:(\d+):[fR]&gt; \(&lt;t:\d+:R&gt;\)/g, (_m, unix: string) =>
    new Date(Number(unix) * 1000).toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Berlin' }),
  );
  html = html.replace(/&lt;t:(\d+):([tTdDfFR])&gt;/g, (_m, unix: string, style: string) => {
    const opts: Intl.DateTimeFormatOptions =
      style === 't' ? { timeStyle: 'short' } : style === 'd' ? { dateStyle: 'short' } : { dateStyle: 'long', timeStyle: 'short' };
    return new Date(Number(unix) * 1000).toLocaleString('de-DE', { ...opts, timeZone: 'Europe/Berlin' });
  });
  html = html.replace(/&lt;@&amp;(\d+)&gt;/g, (_m, id: string) => `<span class="mention">@${names[id] ?? 'Rolle'}</span>`);
  html = html.replace(/&lt;@(\d+)&gt;/g, (_m, id: string) => `<span class="mention">@${names[id] ?? 'User'}</span>`);
  html = html.replace(/&lt;#(\d+)&gt;/g, (_m, id: string) => `<span class="mention">#${names[id] ?? 'kanal'}</span>`);
  html = html.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a>$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  html = html.replace(/(^|\s)_([^_]+)_(?=\s|$)/g, '$1<i>$2</i>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  return html.replace(/\n/g, '<br>');
}

function embedHtml(e: Embed): string {
  const color = `#${(e.color ?? 0x1e1f22).toString(16).padStart(6, '0')}`;
  const fields = (e.fields ?? [])
    .map((f) => `<div class="field${f.inline ? ' inline' : ''}"><div class="fname">${md(f.name)}</div><div class="fval">${md(f.value)}</div></div>`)
    .join('');
  const time = e.timestamp ? new Date(e.timestamp).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' }) : '';
  return `<div class="embed" style="border-left-color:${color}">
    ${e.author ? `<div class="author"><span class="av"></span>${esc(e.author.name)}</div>` : ''}
    ${e.title ? `<div class="title">${md(e.title)}</div>` : ''}
    ${e.description ? `<div class="desc">${md(e.description)}</div>` : ''}
    ${fields ? `<div class="fields">${fields}</div>` : ''}
    ${e.footer || time ? `<div class="footer">${esc([e.footer?.text, time].filter(Boolean).join(' • '))}</div>` : ''}
  </div>`;
}

const style = `
  body{margin:0;background:#313338;font-family:"gg sans","Segoe UI","Helvetica Neue",Arial,sans-serif;color:#dbdee1}
  .wrap{padding:20px 24px 26px;width:620px}
  .msg{display:flex;gap:16px}
  .avatar{width:40px;height:40px;border-radius:50%;background:#ff7a59;flex-shrink:0;display:grid;place-items:center}
  .name{font-weight:600;color:#ff8f73}.app{background:#5865f2;color:#fff;font-size:10px;font-weight:600;padding:1px 5px;border-radius:4px;margin-left:4px;vertical-align:2px}
  .time{color:#949ba4;font-size:12px;margin-left:6px}
  .embed{margin-top:8px;background:#2b2d31;border-left:4px solid;border-radius:4px;padding:10px 16px 14px 12px;max-width:500px;font-size:14px;line-height:1.4}
  .author{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:#f2f3f5;margin:2px 0 6px}
  .av{width:22px;height:22px;border-radius:50%;background:#5865f2;display:inline-block}
  .title{font-weight:700;color:#f2f3f5;font-size:15px;margin:2px 0 6px}
  .desc{margin-bottom:6px}
  .fields{display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:6px}
  .field{flex:1 1 100%}.field.inline{flex:1 1 30%}
  .fname{font-weight:600;color:#f2f3f5;margin-bottom:2px}
  .footer{margin-top:10px;font-size:12px;color:#b5bac1}
  .mention{background:rgba(88,101,242,.3);color:#c9cdfb;border-radius:3px;padding:0 2px}
  code{background:#1e1f22;border-radius:3px;padding:0 3px;font-size:85%}
  a{color:#00a8fc}
  .caption{font:13px "Segoe UI",sans-serif;color:#949ba4;margin:0 0 12px 56px}
  .row{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
  .btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 14px;border-radius:8px;font:500 14px "Segoe UI",sans-serif;color:#fff;background:#4e5058}
  .btn.success{background:#248046}.btn.danger{background:#da373c}
`;

const logo = (await readFile(path.resolve(import.meta.dirname, '../docs/branding/logo.svg'), 'utf8')).replace(/width="512" height="512"/, 'width="40" height="40" style="border-radius:50%"');
const avatar = logo;

const outDir = path.resolve(values.out);
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 668, height: 400 } });

let i = 0;
for (const sample of mod.previewEmbeds()) {
  i++;
  const html = `<!doctype html><meta charset="utf-8"><style>${style}</style><div class="wrap">
    <p class="caption">${esc(sample.caption)}</p>
    <div class="msg"><div class="avatar">${avatar}</div><div>
      <div><span class="name">Moin_Julia</span><span class="app">APP</span><span class="time">Heute um 21:42 Uhr</span></div>
      ${sample.embeds.map(embedHtml).join('')}
      ${(sample.buttons ?? []).map((row) => `<div class="row">${row.map((b) => `<span class="btn ${b.style ?? ''}">${b.emoji ? `${esc(b.emoji)} ` : ''}${esc(b.label)}</span>`).join('')}</div>`).join('')}
    </div></div></div>`;
  await page.setContent(html);
  const file = path.join(outDir, `discord-${values.module}-${i}.png`);
  await (await page.$('.wrap'))!.screenshot({ path: file });
  console.log(`✓ ${file}`);
}
await browser.close();
