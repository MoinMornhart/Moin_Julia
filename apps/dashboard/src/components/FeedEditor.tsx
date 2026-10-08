'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { ALERT_PLACEHOLDERS, END_MODE_LABELS, END_MODES, PLATFORM_LABELS, PLATFORMS, type FeedData, type Platform } from '@moin/shared';
import { deleteFeed, saveFeed, sendTestAlert } from '@/app/g/[guildId]/alerts/actions';
import type { ChannelOption } from '@/lib/discord';

export type FeedDraft = Omit<FeedData, 'channelKey' | 'displayName'>;

const PLATFORM_STYLE: Record<Platform, string> = {
  twitch: 'has-checked:border-[#9146ff] has-checked:bg-[#9146ff]/15',
  youtube: 'has-checked:border-[#ff0033] has-checked:bg-[#ff0033]/12',
  kick: 'has-checked:border-[#53fc18] has-checked:bg-[#53fc18]/10',
};
const PLATFORM_ICON: Record<Platform, string> = { twitch: '🟣', youtube: '▶️', kick: '🟢' };
const INPUT_HINT: Record<Platform, string> = {
  twitch: 'Name oder Link, z. B. twitch.tv/deinname',
  youtube: 'Link zum Kanal, @Handle oder Kanal-ID – z. B. youtube.com/@deinkanal',
  kick: 'Name oder Link, z. B. kick.com/deinname',
};

/** Einen Twitch-/YouTube-/Kick-Kanal einrichten: Ziel, Pings, Texte, Live-Rolle, „war live“ */
export function FeedEditor({
  guildId,
  feedId,
  canEdit,
  initial,
  channels,
  roles,
  connected,
}: {
  guildId: string;
  feedId: string | null;
  canEdit: boolean;
  initial: FeedDraft;
  channels: ChannelOption[];
  roles: { id: string; name: string; color: number }[];
  connected: Record<'twitch' | 'kick', boolean>;
}) {
  const router = useRouter();
  const [f, setF] = useState<FeedDraft>(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const focused = useRef<{ key: 'liveText' | 'videoText' | 'shortText'; el: HTMLTextAreaElement } | null>(null);
  const set = (patch: Partial<FeedDraft>) => setF({ ...f, ...patch });
  const isYoutube = f.platform === 'youtube';
  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5);

  const insert = (token: string) => {
    const target = focused.current;
    if (!target) return;
    const { key, el } = target;
    const start = el.selectionStart ?? f[key].length;
    const end = el.selectionEnd ?? start;
    set({ [key]: f[key].slice(0, start) + token + f[key].slice(end) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const textField = (key: 'liveText' | 'videoText' | 'shortText', label: string) => (
    <label className="grid gap-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      <textarea
        value={f[key]}
        maxLength={1000}
        rows={2}
        className="input"
        onFocus={(e) => (focused.current = { key, el: e.currentTarget })}
        onChange={(e) => set({ [key]: e.target.value })}
      />
    </label>
  );

  return (
    <fieldset disabled={!canEdit || pending} className="grid gap-6">
      <div className="card grid gap-4 p-6">
        <div className="grid gap-1.5 text-sm">
          <span className="font-semibold">Plattform</span>
          <div className="grid grid-cols-3 gap-2">
            {PLATFORMS.map((p) => (
              <label key={p} className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-ink-700 bg-ink-900 px-3 py-3 font-semibold transition ${PLATFORM_STYLE[p]} ${feedId ? 'cursor-not-allowed opacity-60' : ''}`}>
                <input type="radio" name="platform" value={p} checked={f.platform === p} disabled={!!feedId} onChange={() => set({ platform: p })} className="sr-only" />
                <span aria-hidden>{PLATFORM_ICON[p]}</span> {PLATFORM_LABELS[p]}
              </label>
            ))}
          </div>
          {f.platform !== 'youtube' && !connected[f.platform] && (
            <p className="rounded-lg border border-sun-400/40 bg-sun-400/10 px-3 py-2 text-xs">
              {PLATFORM_LABELS[f.platform]} ist noch nicht verbunden. Du kannst den Kanal schon anlegen – Meldungen kommen, sobald die Verbindung unter{' '}
              <a href={`/g/${guildId}/alerts/verbindungen`} className="underline">
                Verbindungen
              </a>{' '}
              steht.
            </p>
          )}
        </div>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">{PLATFORM_LABELS[f.platform]}-Kanal</span>
          <input name="input" value={f.input} maxLength={200} placeholder={INPUT_HINT[f.platform]} className="input" spellCheck={false} onChange={(e) => set({ input: e.target.value })} />
          <span className="text-xs text-fog-500">{INPUT_HINT[f.platform]}</span>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">Meldungen in diesen Discord-Kanal</span>
          <select name="discordChannelId" value={f.discordChannelId} className="input max-w-md" onChange={(e) => set({ discordChannelId: e.target.value })}>
            <option value="">— Kanal wählen —</option>
            {textChannels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.type === 5 ? '📢' : '#'} {c.name}
                {c.group ? ` (${c.group})` : ''}
              </option>
            ))}
          </select>
        </label>
        {isYoutube && (
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {(
              [
                ['notifyVideos', 'Neue Videos'],
                ['notifyShorts', 'Shorts'],
                ['notifyLive', 'Livestreams'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 font-semibold">
                <input type="checkbox" checked={f[key]} onChange={(e) => set({ [key]: e.target.checked })} className="size-4 accent-coral-500" />
                {label}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="card grid gap-4 p-6">
        <p className="font-display text-lg font-semibold">Nachricht</p>
        <div className="grid gap-1.5 text-sm">
          <span className="font-semibold">Rollen pingen</span>
          <div className="flex flex-wrap gap-1.5">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={f.pingRoleIds.includes(r.id)}
                onClick={() => set({ pingRoleIds: f.pingRoleIds.includes(r.id) ? f.pingRoleIds.filter((x) => x !== r.id) : [...f.pingRoleIds, r.id] })}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${f.pingRoleIds.includes(r.id) ? 'border-coral-500 bg-coral-500/15 text-coral-400' : 'border-ink-700 text-fog-300 hover:border-ink-600'}`}
              >
                @ {r.name}
              </button>
            ))}
          </div>
        </div>
        {(!isYoutube || f.notifyLive) && textField('liveText', 'Text, wenn der Stream startet')}
        {isYoutube && f.notifyVideos && textField('videoText', 'Text bei neuem Video')}
        {isYoutube && f.notifyShorts && textField('shortText', 'Text bei neuem Short')}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-fog-500">
          Platzhalter (ins zuletzt angeklickte Feld):
          {ALERT_PLACEHOLDERS.map((p) => (
            <button key={p} type="button" onClick={() => insert(p)} className="rounded-md border border-ink-700 px-1.5 py-0.5 font-mono text-fog-300 hover:border-coral-500">
              {p}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={f.embed} onChange={(e) => set({ embed: e.target.checked })} className="size-4 accent-coral-500" />
          Schöne Karte mit Titel, Kategorie und Vorschaubild anhängen
        </label>
      </div>

      {(!isYoutube || f.notifyLive) && (
        <div className="card grid gap-4 p-6">
          <p className="font-display text-lg font-semibold">Während und nach dem Stream</p>
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Nach dem Stream die Meldung …</span>
            <select value={f.endMode} className="input max-w-xs" onChange={(e) => set({ endMode: e.target.value as FeedDraft['endMode'] })}>
              {END_MODES.map((m) => (
                <option key={m} value={m}>
                  {END_MODE_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Live-Rolle</span>
              <select value={f.liveRoleId} className="input" onChange={(e) => set({ liveRoleId: e.target.value })}>
                <option value="">— keine —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    @ {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">… für dieses Mitglied (User-ID)</span>
              <input value={f.liveMemberId} inputMode="numeric" placeholder="z. B. 123456789012345678" className="input font-mono" onChange={(e) => set({ liveMemberId: e.target.value.replace(/\D/g, '') })} />
            </label>
          </div>
          <p className="text-xs text-fog-500">
            Die Person bekommt die Rolle, solange der Kanal live ist – praktisch für eine eigene „🔴 Live“-Anzeige in der Mitgliederliste. User-ID: in Discord Rechtsklick auf die Person → „User-ID kopieren“
            (Entwicklermodus).
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            start(async () => {
              const r = await saveFeed(guildId, feedId, JSON.stringify(f));
              setMessage({ ok: r.ok, text: r.message ?? '' });
              if (r.ok && !feedId && r.id) router.replace(`/g/${guildId}/alerts?feed=${r.id}`);
              else router.refresh();
            })
          }
        >
          {pending ? 'Speichere …' : 'Speichern'}
        </button>
        {feedId && (
          <button type="button" className="btn-ghost" onClick={() => start(async () => { const r = await sendTestAlert(guildId, feedId); setMessage({ ok: r.ok, text: r.message ?? '' }); })}>
            🧪 Test senden
          </button>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.paused} onChange={(e) => set({ paused: e.target.checked })} className="size-4 accent-coral-500" />
          pausiert
        </label>
        {feedId && (
          <button
            type="button"
            className="ml-auto text-sm text-fog-500 hover:text-danger-500"
            onClick={() =>
              start(async () => {
                const r = await deleteFeed(guildId, feedId);
                if (r.ok) router.replace(`/g/${guildId}/alerts`);
                else setMessage({ ok: false, text: r.message ?? '' });
              })
            }
          >
            Entfernen
          </button>
        )}
      </div>
      {message && (
        <p role="status" className={`text-sm ${message.ok ? 'text-sea-400' : 'text-danger-500'}`}>
          {message.text}
        </p>
      )}
    </fieldset>
  );
}
