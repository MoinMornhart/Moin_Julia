/**
 * Transcript eines Tickets als eigenständige HTML-Datei (Discord-Look, ohne externe Abhängigkeiten).
 * Alle Inhalte werden escaped – das Dashboard zeigt die Datei zusätzlich in einem abgeschotteten iframe.
 */

export interface TranscriptMessage {
  author: string;
  bot: boolean;
  avatarUrl: string | null;
  content: string;
  createdAt: Date;
  attachments: { name: string; url: string }[];
  embeds: { title?: string | null; description?: string | null }[];
}

export interface TranscriptMeta {
  server: string;
  number: number;
  reason: string;
  opener: string;
  openedAt: Date;
  closedAt: Date;
  closedBy: string;
  closeReason: string | null;
  answers: { label: string; value: string }[];
}

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const time = (d: Date) => d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' });

/** Nur http(s)-Links zulassen (keine javascript:-Adressen in Anhängen) */
const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? esc(u) : '#');

/** Einfache Formatierung wie in Discord: **fett**, *kursiv*, `code`, Zeilenumbrüche – nach dem Escapen */
function format(text: string): string {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

export function renderTranscript(meta: TranscriptMeta, messages: TranscriptMessage[]): string {
  const rows = messages
    .map((m) => {
      const avatar = m.avatarUrl ? `<img class="av" src="${safeUrl(m.avatarUrl)}" alt="">` : `<span class="av ph">${esc(m.author.slice(0, 1).toUpperCase())}</span>`;
      const files = m.attachments.map((a) => `<a class="file" href="${safeUrl(a.url)}">📎 ${esc(a.name)}</a>`).join('');
      const embeds = m.embeds
        .map((e) => `<div class="embed">${e.title ? `<b>${esc(e.title)}</b>` : ''}${e.description ? `<p>${format(e.description)}</p>` : ''}</div>`)
        .join('');
      return `<div class="msg">${avatar}<div><div class="head"><span class="name">${esc(m.author)}</span>${m.bot ? '<span class="tag">BOT</span>' : ''}<span class="time">${esc(time(m.createdAt))}</span></div>${m.content ? `<div class="text">${format(m.content)}</div>` : ''}${embeds}${files}</div></div>`;
    })
    .join('\n');
  const answers = meta.answers.length
    ? `<dl>${meta.answers.map((a) => `<dt>${esc(a.label)}</dt><dd>${format(a.value)}</dd>`).join('')}</dl>`
    : '';
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ticket #${meta.number} – ${esc(meta.server)}</title>
<style>
body{margin:0;background:#313338;color:#dbdee1;font:15px/1.45 "Segoe UI",system-ui,sans-serif}
header{padding:20px 24px;background:#2b2d31;border-bottom:1px solid #1e1f22}
h1{margin:0 0 6px;font-size:20px;color:#f2f3f5}
.meta{color:#b5bac1;font-size:13px}.meta b{color:#f2f3f5}
dl{margin:12px 0 0;display:grid;gap:4px 12px;grid-template-columns:max-content 1fr;font-size:14px}dt{color:#b5bac1}dd{margin:0}
main{padding:12px 24px 40px}
.msg{display:flex;gap:14px;padding:8px 0}
.av{width:40px;height:40px;border-radius:50%;flex:none;object-fit:cover}.ph{display:grid;place-items:center;background:#5865f2;color:#fff;font-weight:700}
.head{display:flex;gap:8px;align-items:baseline}.name{font-weight:600;color:#f2f3f5}.time{font-size:12px;color:#949ba4}
.tag{background:#5865f2;color:#fff;font-size:10px;font-weight:600;border-radius:3px;padding:0 4px}
.text{white-space:normal;word-wrap:break-word}
.embed{margin-top:6px;border-left:4px solid #ff7a59;background:#2b2d31;border-radius:4px;padding:8px 12px;max-width:520px}.embed p{margin:4px 0 0}
.file{display:inline-block;margin-top:6px;color:#00a8fc}
code{background:#1e1f22;border-radius:3px;padding:0 4px;font-size:85%}
footer{padding:16px 24px;color:#949ba4;font-size:12px;border-top:1px solid #1e1f22}
</style></head><body>
<header><h1>🎫 Ticket #${meta.number} · ${esc(meta.reason)}</h1>
<div class="meta">${esc(meta.server)} · geöffnet von <b>${esc(meta.opener)}</b> am ${esc(time(meta.openedAt))} · geschlossen von <b>${esc(meta.closedBy)}</b> am ${esc(time(meta.closedAt))}${meta.closeReason ? ` · Grund: ${esc(meta.closeReason)}` : ''}</div>
${answers}</header>
<main>
${rows || '<p class="meta">Keine Nachrichten.</p>'}
</main>
<footer>${messages.length} Nachrichten · erstellt von Moin_Julia</footer>
</body></html>`;
}
