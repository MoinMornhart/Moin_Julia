'use client';

import { useState, useTransition } from 'react';
import { convertGalaxyPlaceholders } from '@moin/shared';
import { importGalaxyRules, runGalaxyScan } from '@/app/g/[guildId]/vorlagen/actions';
import type { GalaxyScan } from '@/lib/galaxy';
import { SectionCard } from './FormParts';

export function GalaxyImport({ guildId, canEdit }: { guildId: string; canEdit: boolean }) {
  const [scan, setScan] = useState<GalaxyScan | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [text, setText] = useState('Willkommen %MENTION% auf %SERVERNAME%! Du bist Mitglied Nr. %USERCOUNT%.');
  const converted = convertGalaxyPlaceholders(text);

  return (
    <div className="grid max-w-4xl gap-6">
      <SectionCard title="1. Server durchsuchen" description="Liest die AutoMod-Regeln und die letzten 50 Nachrichten in bis zu 40 Kanälen. Es wird nichts verändert.">
        <button
          type="button"
          className="btn-primary w-fit"
          disabled={!canEdit || pending}
          onClick={() =>
            start(async () => {
              const r = await runGalaxyScan(guildId);
              if (r.ok && r.scan) {
                setScan(r.scan);
                setSelected(r.scan.rules.filter((x) => x.kind !== 'other').map((x) => x.id));
              } else setMessage({ ok: false, text: r.message ?? 'Fehler' });
            })
          }
        >
          {pending && !scan ? 'Durchsuche …' : scan ? 'Erneut durchsuchen' : 'GalaxyBot-Spuren suchen'}
        </button>
        {scan && (
          <p className="text-sm text-fog-300">
            {scan.galaxyPresent ? '✅ GalaxyBot ist auf dem Server.' : '⚠️ GalaxyBot ist nicht (mehr) auf dem Server – gefunden wird nur, was noch da ist.'}{' '}
            {scan.scannedChannels} Kanäle durchsucht · {scan.rules.length} AutoMod-Regeln · {scan.messages.length} Nachrichten.
          </p>
        )}
      </SectionCard>

      {scan && (
        <SectionCard title="2. AutoMod-Regeln übernehmen" description="Schimpfwort-Listen und Massen-Erwähnungen werden in die Moderation (Automod) übernommen.">
          {scan.rules.length === 0 ? (
            <p className="text-sm text-fog-500">Keine AutoMod-Regeln von GalaxyBot gefunden.</p>
          ) : (
            <>
              <ul className="grid gap-2">
                {scan.rules.map((r) => (
                  <li key={r.id}>
                    <label className="flex items-start gap-3 rounded-xl border border-ink-700 bg-ink-850 p-3 text-sm">
                      <input
                        type="checkbox"
                        disabled={r.kind === 'other'}
                        checked={selected.includes(r.id)}
                        onChange={(e) => setSelected(e.target.checked ? [...selected, r.id] : selected.filter((x) => x !== r.id))}
                        className="mt-0.5 size-4 accent-coral-500"
                      />
                      <span>
                        <b>{r.name}</b>
                        <span className="block text-fog-500">
                          {r.kind === 'keywords'
                            ? `${r.keywords.length} Wörter: ${r.keywords.slice(0, 8).join(', ')}${r.keywords.length > 8 ? ' …' : ''}`
                            : r.kind === 'mentions'
                              ? `höchstens ${r.mentionLimit} Erwähnungen pro Nachricht`
                              : 'Diese Regel-Art wird nicht übernommen'}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn-primary w-fit"
                disabled={!canEdit || pending || selected.length === 0}
                onClick={() =>
                  start(async () => {
                    const r = await importGalaxyRules(guildId, selected);
                    setMessage({ ok: r.ok, text: r.message });
                  })
                }
              >
                Ausgewählte übernehmen
              </button>
            </>
          )}
        </SectionCard>
      )}

      {scan && (
        <SectionCard
          title="3. Gefundene Nachrichten"
          description="Panels und Embeds von GalaxyBot. Ticket-Panels übernimmt das Ticket-Modul (kommt als Nächstes) direkt aus dieser Liste – bis dahin kannst du die Texte hier ansehen."
        >
          {scan.messages.length === 0 ? (
            <p className="text-sm text-fog-500">Keine Nachrichten von GalaxyBot gefunden.</p>
          ) : (
            <ul className="grid gap-3">
              {scan.messages.map((m) => (
                <li key={m.messageId} className="rounded-xl border-l-4 bg-ink-850 p-4 text-sm" style={{ borderColor: m.color ? `#${m.color.toString(16).padStart(6, '0')}` : '#5865f2' }}>
                  <p className="text-xs text-fog-500"># {m.channelName}</p>
                  {m.title && <p className="font-semibold">{m.title}</p>}
                  {m.description && <p className="mt-1 whitespace-pre-wrap text-fog-300">{m.description}</p>}
                  {m.options.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.options.map((o) => (
                        <span key={o} className="chip bg-ink-700 text-fog-300">
                          {o}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      <SectionCard title="Texte umwandeln" description="GalaxyBot-Texte mit Platzhaltern einfügen – hier kommt die Moin_Julia-Version zum Kopieren raus (z. B. für die Willkommensnachricht).">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">GalaxyBot-Text</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="input font-mono text-xs" />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Für Moin_Julia</span>
            <textarea readOnly value={converted.text} rows={4} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
          </label>
        </div>
        {converted.unknown.length > 0 && <p className="text-sm text-sun-400">Ohne Entsprechung (bitte von Hand anpassen): {converted.unknown.join(', ')}</p>}
      </SectionCard>

      {message && <p className={`text-sm ${message.ok ? 'text-sea-400' : 'text-danger-500'}`}>{message.ok ? '✅ ' : '❌ '}{message.text}</p>}
    </div>
  );
}
