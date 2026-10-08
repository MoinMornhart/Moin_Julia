'use client';

import { useEffect, useState, useTransition } from 'react';
import { convertGalaxyPlaceholders } from '@moin/shared';
import { importGalaxyRules, listScanBots, runGalaxyScan } from '@/app/g/[guildId]/vorlagen/actions';
import { importTicketPanel } from '@/app/g/[guildId]/tickets/actions';
import type { BotCandidate, GalaxyScan } from '@/lib/galaxy';
import { SectionCard } from './FormParts';

export function GalaxyImport({ guildId, canEdit }: { guildId: string; canEdit: boolean }) {
  const [scan, setScan] = useState<GalaxyScan | null>(null);
  const [imported, setImported] = useState<Record<string, string>>({});
  const [bots, setBots] = useState<BotCandidate[] | null>(null);
  const [botId, setBotId] = useState('');
  const [manualId, setManualId] = useState('');
  const chosen = manualId.trim() || botId;

  // Kandidaten laden: Bots auf dem Server + Ersteller von AutoMod-Regeln; bester Treffer vorausgewählt
  useEffect(() => {
    void listScanBots(guildId).then((r) => {
      setBots(r.bots ?? []);
      if (r.bots?.[0]) setBotId(r.bots[0].id);
      if (!r.ok) setMessage({ ok: false, text: r.message ?? 'Fehler' });
    });
  }, [guildId]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [text, setText] = useState('Willkommen %MENTION% auf %SERVERNAME%! Du bist Mitglied Nr. %USERCOUNT%.');
  const converted = convertGalaxyPlaceholders(text);

  return (
    <div className="grid max-w-4xl gap-6">
      <SectionCard
        title="1. Welcher Bot war es?"
        description="Dein alter Bot kann einen eigenen Namen haben (z. B. GalaxyBot mit eigenem Branding). Hier stehen alle Bots auf dem Server und alle, die AutoMod-Regeln angelegt haben – auch wenn sie schon entfernt wurden."
      >
        {bots === null ? (
          <p className="text-sm text-fog-500">Lade Bots …</p>
        ) : bots.length === 0 ? (
          <p className="text-sm text-fog-500">Keine anderen Bots gefunden – trag unten die ID deines alten Bots ein.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2" aria-label="Alter Bot">
            {bots.map((b) => (
              <li key={b.id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${botId === b.id && !manualId ? 'border-coral-500 bg-coral-500/10' : 'border-ink-700 bg-ink-850 hover:border-ink-600'}`}
                >
                  <input type="radio" name="scan-bot" value={b.id} checked={botId === b.id && !manualId} onChange={() => (setBotId(b.id), setManualId(''))} className="sr-only" />
                  {b.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.avatarUrl} alt="" className="size-9 rounded-full" />
                  ) : (
                    <span className="grid size-9 place-items-center rounded-full bg-ink-700 text-xs font-bold">{b.name.slice(0, 2).toUpperCase()}</span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{b.name}</span>
                    <span className="block text-xs text-fog-500">
                      {b.present ? 'auf dem Server' : 'nicht mehr auf dem Server'} · {b.rules} AutoMod-Regel{b.rules === 1 ? '' : 'n'}
                      {b.likelyGalaxy ? ' · GalaxyBot?' : ''}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <label className="grid gap-1.5 text-sm sm:max-w-sm">
          <span className="text-fog-300">Oder Bot-ID von Hand (Rechtsklick auf den Bot → „ID kopieren“)</span>
          <input value={manualId} onChange={(e) => setManualId(e.target.value.trim())} placeholder="z. B. 576764876924387328" inputMode="numeric" className="input" />
        </label>
      </SectionCard>

      <SectionCard title="2. Server durchsuchen" description="Liest die AutoMod-Regeln dieses Bots und seine letzten Nachrichten in bis zu 40 Kanälen. Es wird nichts verändert.">
        <button
          type="button"
          className="btn-primary w-fit"
          disabled={!canEdit || pending || !chosen}
          onClick={() =>
            start(async () => {
              const r = await runGalaxyScan(guildId, chosen);
              if (r.ok && r.scan) {
                setScan(r.scan);
                setSelected(r.scan.rules.filter((x) => x.importable).map((x) => x.id));
              } else setMessage({ ok: false, text: r.message ?? 'Fehler' });
            })
          }
        >
          {pending && !scan ? 'Durchsuche …' : scan ? 'Erneut durchsuchen' : 'Bot durchsuchen'}
        </button>
        {scan && (
          <p className="text-sm text-fog-300">
            {scan.botPresent ? `✅ ${scan.botName} ist auf dem Server.` : `⚠️ ${scan.botName} ist nicht (mehr) auf dem Server – gefunden wird nur, was noch da ist.`}{' '}
            {scan.scannedChannels} Kanäle durchsucht · {scan.rules.length} AutoMod-Regeln · {scan.messages.length} Nachrichten.
          </p>
        )}
        {scan && scan.unreadableChannels > 0 && (
          <p className="text-sm text-sun-400">
            ⚠️ {scan.unreadableChannels} Kanal/Kanäle durfte Moin_Julia nicht lesen (Kanal-Rechte „Kanal ansehen“ + „Nachrichtenverlauf anzeigen“). Panels dort fehlen in der Liste.
          </p>
        )}
        {scan?.truncated && (
          <p className="text-sm text-sun-400">⚠️ Sehr viele Kanäle – durchsucht wurden die ersten {scan.scannedChannels}. Fehlt ein Panel, gib Moin_Julia Lesezugriff nur auf den Kanal und scanne erneut.</p>
        )}
      </SectionCard>

      {scan && (
        <SectionCard title="3. AutoMod-Regeln übernehmen" description="Schimpfwort-Listen und Massen-Erwähnungen werden in die Moderation (Automod) übernommen.">
          {scan.rules.length === 0 ? (
            <p className="text-sm text-fog-500">Keine AutoMod-Regeln von diesem Bot gefunden.</p>
          ) : (
            <>
              <ul className="grid gap-2">
                {scan.rules.map((r) => (
                  <li key={r.id}>
                    <label className="flex items-start gap-3 rounded-xl border border-ink-700 bg-ink-850 p-3 text-sm">
                      <input
                        type="checkbox"
                        disabled={!r.importable}
                        checked={selected.includes(r.id)}
                        onChange={(e) => setSelected(e.target.checked ? [...selected, r.id] : selected.filter((x) => x !== r.id))}
                        className="mt-0.5 size-4 accent-coral-500"
                      />
                      <span className="min-w-0">
                        <b>{r.name}</b> <span className="chip bg-ink-700 text-fog-300">{r.typeLabel}</span>
                        {!r.enabled && <span className="chip ml-1 bg-ink-700 text-fog-500">beim alten Bot aus</span>}
                        <span className="block text-fog-500">
                          {r.kind === 'keywords'
                            ? r.keywords.length
                              ? `${r.keywords.length} Wörter: ${r.keywords.slice(0, 8).join(', ')}${r.keywords.length > 8 ? ' …' : ''}`
                              : 'Keine Wörter – nur Muster (siehe unten)'
                            : r.kind === 'mentions'
                              ? `höchstens ${r.mentionLimit} Erwähnungen pro Nachricht`
                              : 'Diese Regel-Art gibt es in Moin_Julia nicht – sie bleibt beim alten Bot bzw. in Discord.'}
                        </span>
                        {r.regexCount > 0 && (
                          <span className="block text-xs text-sun-400">{r.regexCount} Regex-Muster kann Moin_Julia nicht übernehmen. Die Regel selbst bleibt aber in Discord aktiv (AutoMod-Regeln gehören dem Server, nicht dem Bot) – lösch sie nicht, wenn du die Muster behalten willst.</span>
                        )}
                        {r.allowList.length > 0 && <span className="block text-xs text-fog-500">Ausnahmen (erlaubt): {r.allowList.slice(0, 8).join(', ')}</span>}
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
                    const r = await importGalaxyRules(guildId, chosen, selected);
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
          title="4. Gefundene Nachrichten"
          description="Panels und Embeds dieses Bots. Ticket-Panels übernimmst du mit einem Klick – die Auswahl-Optionen werden zu Ticket-Gründen, Platzhalter werden umgewandelt."
        >
          {scan.messages.length === 0 ? (
            <p className="text-sm text-fog-500">Keine Nachrichten von diesem Bot gefunden (nur Nachrichten mit Embed zählen).</p>
          ) : (
            <ul className="grid gap-3">
              {scan.messages.map((m) => (
                <li key={m.messageId} className="rounded-xl border-l-4 bg-ink-850 p-4 text-sm" style={{ borderColor: m.color ? `#${m.color.toString(16).padStart(6, '0')}` : '#5865f2' }}>
                  <p className="text-xs text-fog-500">
                    # {m.channelName}
                    {m.componentsV2 && <span className="chip ml-2 bg-ink-700 text-fog-300">neues Discord-Format</span>}
                  </p>
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
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className="btn-ghost px-3 py-1.5 text-xs"
                      disabled={!canEdit || pending || Boolean(imported[m.messageId])}
                      onClick={() =>
                        start(async () => {
                          const r = await importTicketPanel(guildId, { title: m.title, description: m.description, options: m.options, channelId: m.channelId, color: m.color });
                          if (r.ok && r.id) setImported({ ...imported, [m.messageId]: r.id });
                          setMessage({ ok: r.ok, text: r.message ?? '' });
                        })
                      }
                    >
                      🎫 Als Ticket-Panel übernehmen
                    </button>
                    {imported[m.messageId] && (
                      <a href={`/g/${guildId}/tickets/panels?panel=${imported[m.messageId]}`} className="text-xs font-semibold text-coral-400 underline">
                        Panel ansehen →
                      </a>
                    )}
                  </div>
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
