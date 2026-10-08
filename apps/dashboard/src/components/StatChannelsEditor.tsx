'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { fillStatTemplate, STAT_PLACEHOLDER_LABELS, STAT_PLACEHOLDERS, type StatsConfig, type StatValues } from '@moin/shared';
import { createStatChannel, saveStatsSettings } from '@/app/g/[guildId]/statistiken/actions';
import type { ChannelOption } from '@/lib/discord';

const SUGGESTIONS = ['👥 Mitglieder: {members}', '🧑 Menschen: {humans}', '🚀 Boosts: {boosts}', '🔊 Im Voice: {voice}'];

/** Statistik-Kanäle: bestehenden Sprachkanal wählen oder neuen anlegen; Vorlage mit Live-Vorschau */
export function StatChannelsEditor({
  guildId,
  canEdit,
  config,
  channels,
  sample,
}: {
  guildId: string;
  canEdit: boolean;
  config: StatsConfig;
  channels: ChannelOption[];
  sample: StatValues;
}) {
  const router = useRouter();
  const [list, setList] = useState(config.statChannels);
  const [retention, setRetention] = useState(config.retentionDays);
  const [ignored, setIgnored] = useState(config.ignoredChannelIds);
  const [newTemplate, setNewTemplate] = useState(SUGGESTIONS[0]!);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const voice = channels.filter((c) => c.type === 2 || c.type === 13);
  const text = channels.filter((c) => c.type === 0 || c.type === 5);
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const r = await fn();
      setMessage({ ok: r.ok, text: r.message ?? '' });
      if (r.ok) router.refresh();
    });

  return (
    <fieldset disabled={!canEdit || pending} className="grid max-w-4xl gap-6">
      <div className="card grid gap-4 p-6 text-sm">
        <div>
          <p className="font-display text-lg font-semibold">Statistik-Kanäle</p>
          <p className="text-fog-500">
            Sprachkanäle, deren Name die aktuelle Zahl zeigt – ganz oben in der Kanalliste. Discord erlaubt nur 2 Umbenennungen pro 10 Minuten, deshalb aktualisiert Moin_Julia höchstens alle
            10 Minuten.
          </p>
        </div>
        {list.map((c, i) => (
          <div key={`${c.channelId}-${i}`} className="grid gap-2 rounded-xl border border-ink-700 p-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-center">
            <select aria-label={`Kanal ${i + 1}`} value={c.channelId} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, channelId: e.target.value } : x)))} className="input">
              {!voice.some((v) => v.id === c.channelId) && <option value={c.channelId}>Kanal {c.channelId}</option>}
              {voice.map((v) => (
                <option key={v.id} value={v.id}>
                  🔊 {v.name}
                </option>
              ))}
            </select>
            <input aria-label={`Vorlage ${i + 1}`} value={c.template} maxLength={90} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, template: e.target.value } : x)))} className="input" />
            <button type="button" aria-label="Entfernen" className="justify-self-end px-2 text-fog-500 hover:text-danger-500" onClick={() => setList(list.filter((_, j) => j !== i))}>
              ✕
            </button>
            <p className="text-xs text-fog-500 sm:col-span-3">Vorschau: 🔊 {fillStatTemplate(c.template, sample)}</p>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {voice.length > 0 && list.length < 10 && (
            <button type="button" className="btn-ghost" onClick={() => setList([...list, { channelId: voice[0]!.id, template: SUGGESTIONS[0]! }])}>
              + Vorhandenen Kanal nutzen
            </button>
          )}
        </div>
        <div className="grid gap-2 rounded-xl border border-dashed border-ink-600 p-3">
          <span className="font-semibold">Neuen Statistik-Kanal anlegen</span>
          <div className="flex flex-wrap gap-2">
            <input aria-label="Vorlage für neuen Kanal" value={newTemplate} maxLength={90} onChange={(e) => setNewTemplate(e.target.value)} className="input min-w-0 flex-1" />
            <button type="button" className="btn-ghost" onClick={() => run(() => createStatChannel(guildId, newTemplate))}>
              Anlegen
            </button>
          </div>
          <p className="text-xs text-fog-500">Vorschau: 🔊 {fillStatTemplate(newTemplate, sample)}</p>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="rounded-md border border-ink-700 px-2 py-0.5 text-fog-300 hover:border-coral-500" onClick={() => setNewTemplate(s)}>
                {s}
              </button>
            ))}
          </div>
          <p className="text-xs text-fog-500">Platzhalter: {STAT_PLACEHOLDERS.map((p) => `${p} = ${STAT_PLACEHOLDER_LABELS[p]}`).join(' · ')}</p>
        </div>
      </div>

      <div className="card grid gap-4 p-6 text-sm">
        <p className="font-display text-lg font-semibold">Erfassung</p>
        <label className="grid gap-1">
          <span className="text-fog-300">Tageswerte pro Mitglied und Kanal aufbewahren</span>
          <span className="flex items-center gap-2">
            <input type="number" min={30} max={730} value={retention} onChange={(e) => setRetention(Math.max(30, Math.min(730, Number(e.target.value) || 30)))} className="input w-28" />
            <span className="text-fog-500">Tage (Server-Gesamtwerte bleiben immer)</span>
          </span>
        </label>
        <div className="grid gap-1.5">
          <span className="font-semibold">Diese Kanäle nicht mitzählen</span>
          <div className="flex flex-wrap gap-1.5">
            {[...text, ...voice].map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={ignored.includes(c.id)}
                onClick={() => setIgnored(ignored.includes(c.id) ? ignored.filter((x) => x !== c.id) : [...ignored, c.id])}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${ignored.includes(c.id) ? 'border-coral-500 bg-coral-500/15 text-coral-400' : 'border-ink-700 text-fog-300 hover:border-ink-600'}`}
              >
                {c.type === 2 || c.type === 13 ? '🔊' : '#'} {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={() => run(() => saveStatsSettings(guildId, JSON.stringify({ statChannels: list, retentionDays: retention, ignoredChannelIds: ignored })))}>
          {pending ? 'Speichere …' : 'Speichern'}
        </button>
        {message && (
          <p role="status" className={`text-sm ${message.ok ? 'text-sea-400' : 'text-danger-500'}`}>
            {message.text}
          </p>
        )}
      </div>
    </fieldset>
  );
}
