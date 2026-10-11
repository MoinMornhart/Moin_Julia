'use client';

import { useState, useTransition } from 'react';
import type { PermFinding } from '@moin/shared';
import { toggleChannelReadOnly } from '@/app/g/[guildId]/schutz/actions';
import { SectionCard } from './FormParts';

export interface ReadOnlyChannel {
  id: string;
  name: string;
  group: string | null;
  readOnly: boolean;
}

const WHERE: Record<PermFinding['where'], string> = { everyone: 'Alle Mitglieder', rolle: 'Rolle', kanal: 'Kanal' };

/**
 * Rechte-Check: zeigt verständlich, wo normale Mitglieder gefährliche Rechte haben,
 * und schaltet Kanäle per Klick auf „Nur lesen“ (z. B. #regeln, #feedback-Ankündigungen).
 */
export function PermissionCheck({ guildId, canEdit, findings, channels }: { guildId: string; canEdit: boolean; findings: PermFinding[]; channels: ReadOnlyChannel[] }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function toggle(channel: ReadOnlyChannel) {
    setBusy(channel.id);
    start(async () => {
      const res = await toggleChannelReadOnly(guildId, channel.id, !channel.readOnly);
      setMessage({ ok: res.ok, text: res.ok ? `#${channel.name}: ${res.message ?? ''}` : (res.message ?? 'Fehler') });
      setBusy(null);
    });
  }

  return (
    <div className="mb-6 grid grid-cols-1 gap-6">
      <SectionCard
        title="🔐 Rechte-Check"
        description="Moin_Julia prüft, ob normale Mitglieder Rechte haben, mit denen sie Schaden anrichten können – z. B. weil ein Kanal @everyone „Kanäle verwalten“ erlaubt. Ändern kannst du das in Discord; hier steht, wo."
      >
        {findings.length === 0 ? (
          <p className="rounded-xl border border-sea-500/40 bg-sea-500/10 px-4 py-3 text-sm">✅ Keine gefährlichen Rechte für normale Mitglieder gefunden.</p>
        ) : (
          <ul className="grid min-w-0 grid-cols-1 gap-3" aria-label="Funde im Rechte-Check">
            {findings.map((f) => (
              <li
                key={`${f.where}-${f.targetId}`}
                className={`rounded-xl border px-4 py-3 text-sm ${f.severity === 'hoch' ? 'border-danger-500/50 bg-danger-500/10' : 'border-sun-400/40 bg-sun-400/10'}`}
              >
                <p className="font-semibold">
                  <span title={f.severity === 'hoch' ? 'Sollte sofort behoben werden' : 'Bitte prüfen, ob das so gewollt ist'}>{f.severity === 'hoch' ? '⛔' : '⚠️'}</span> {f.title}
                  <span className="ml-2 text-xs font-normal text-fog-500">{WHERE[f.where]}</span>
                </p>
                <p className="mt-1 text-fog-300">{f.detail}</p>
                <p className="mt-1 text-fog-500">👉 {f.fix}</p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="📖 Nur-lesen-Kanäle"
        description="Ein Klick, und Mitglieder können im Kanal nur noch lesen und reagieren, aber nicht schreiben – ideal für #regeln, #ankündigungen oder Feedback-Übersichten. Team-Rollen mit eigenen Rechten können weiter schreiben."
      >
        {message && <p className={`rounded-xl border px-4 py-2 text-sm ${message.ok ? 'border-sea-500/40 bg-sea-500/10' : 'border-danger-500/40 bg-danger-500/10'}`}>{message.text}</p>}
        <ul className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Kanäle: Nur lesen">
          {channels.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-ink-700 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                #{c.name}
                {c.group && <span className="ml-1 text-xs text-fog-500">({c.group})</span>}
              </span>
              <button
                type="button"
                disabled={!canEdit || pending}
                onClick={() => toggle(c)}
                title={c.readOnly ? 'Mitglieder dürfen hier wieder schreiben' : 'Mitglieder dürfen hier nur noch lesen und reagieren'}
                aria-label={`#${c.name}: ${c.readOnly ? 'wieder beschreibbar machen' : 'auf Nur lesen stellen'}`}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ${c.readOnly ? 'bg-sun-400/20 text-sun-400' : 'border border-ink-600 text-fog-300'} disabled:opacity-50`}
              >
                {busy === c.id ? '…' : c.readOnly ? '📖 Nur lesen' : '✏️ Alle schreiben'}
              </button>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
