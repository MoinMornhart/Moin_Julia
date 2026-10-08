'use client';

import { useRef, useState, useTransition } from 'react';
import { ACTIVITY_LABELS, ACTIVITY_TYPES, BOT_STATUSES, presenceText, STATUS_LABELS, type BotPresence } from '@moin/shared';
import { saveBotProfile } from '@/app/system/actions';
import { saveGuildBotProfile } from '@/app/g/[guildId]/einstellungen/actions';

const MAX_IMAGE = 10 * 1024 * 1024;

/** Datei → Data-URL (für Discords Bild-Felder) */
function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Bild wählen/entfernen mit Vorschau. value: undefined = unverändert (zeigt `current`), null = entfernen. */
function ImagePick({
  label,
  current,
  value,
  onChange,
  wide = false,
  mascot = false,
}: {
  label: string;
  current: string | null;
  value: string | null | undefined;
  onChange: (v: string | null | undefined) => void;
  wide?: boolean;
  mascot?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = value === undefined ? current : value;

  async function pick(file: File) {
    setError(null);
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) return setError('Nur PNG, JPG, GIF oder WebP.');
    if (file.size > MAX_IMAGE) return setError('Höchstens 10 MB.');
    onChange(await readAsDataUrl(file));
  }

  return (
    <div className="grid gap-2 text-sm">
      <span className="font-semibold">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`grid shrink-0 place-items-center overflow-hidden border border-ink-700 bg-ink-850 ${wide ? 'h-16 w-40 rounded-xl' : 'size-16 rounded-full'}`}>
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-xs text-fog-500">keins</span>
          )}
        </span>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => input.current?.click()}>
            📁 Bild wählen
          </button>
          {mascot && (
            <button
              type="button"
              className="btn-ghost px-3 py-1.5 text-xs"
              onClick={async () => onChange(await readAsDataUrl(await (await fetch('/branding/bot-avatar.png')).blob()))}
            >
              👩‍✈️ Kapitänin Julia
            </button>
          )}
          {shown && (
            <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => onChange(null)}>
              Entfernen
            </button>
          )}
          {value !== undefined && (
            <button type="button" className="px-2 text-xs text-fog-500 underline" onClick={() => onChange(undefined)}>
              zurücksetzen
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          data-testid={`pick-${label}`}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void pick(f);
          }}
        />
      </div>
      {error && <span className="text-danger-500">{error}</span>}
    </div>
  );
}

const STATUS_DOT: Record<string, string> = { online: 'bg-[#23a55a]', idle: 'bg-[#f0b232]', dnd: 'bg-[#f23f43]', invisible: 'bg-[#80848e]' };
const ACTIVITY_PREFIX: Record<string, string> = { playing: 'Spielt', listening: 'Hört', watching: 'Schaut', competing: 'Tritt an in' };

/** Profilkarte wie in Discord – Live-Vorschau */
function ProfileCard({ name, avatar, banner, about, presence, version }: { name: string; avatar: string | null; banner: string | null; about: string; presence?: BotPresence; version: string }) {
  const text = presence ? presenceText(presence, { version, servers: 3 }) : '';
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-[#232428] text-[#dbdee1] shadow-2xl">
      <div className="h-24 bg-gradient-to-br from-[#ffa062] via-[#ff6b5b] to-[#ee3f82]" style={banner ? { background: `center / cover url("${banner.replace(/["\\\n]/g, '')}")` } : undefined} />
      <div className="px-4 pb-4">
        <div className="relative -mt-11 mb-2 w-fit">
          <span className="block size-20 overflow-hidden rounded-full border-[6px] border-[#232428] bg-[#313338]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {avatar && <img src={avatar} alt="" className="size-full object-cover" />}
          </span>
          {presence && <span className={`absolute right-0.5 bottom-0.5 size-5 rounded-full border-4 border-[#232428] ${STATUS_DOT[presence.status]}`} />}
        </div>
        <p className="flex items-center gap-1.5 text-xl font-bold text-white">
          {name || 'Moin_Julia'}
          <span className="rounded bg-[#5865f2] px-1 text-[10px] font-semibold text-white">APP</span>
        </p>
        {presence && presence.type !== 'none' && text && (
          <p className="mt-1 text-sm">{presence.type === 'custom' ? text : `${ACTIVITY_PREFIX[presence.type]} ${text}`}</p>
        )}
        {about && (
          <div className="mt-3 rounded-lg bg-[#111214] p-3">
            <p className="text-xs font-bold text-white uppercase">Über mich</p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{about}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Result({ result }: { result: { ok: boolean; messages: string[] } | null }) {
  if (!result) return null;
  return (
    <ul className={`grid gap-1 text-sm ${result.ok ? 'text-sea-400' : 'text-danger-500'}`} role="status">
      {result.messages.map((m) => (
        <li key={m}>
          {result.ok ? '✓ ' : '✗ '}
          {m}
        </li>
      ))}
    </ul>
  );
}

/** System → Bot-Profil (global) */
export function BotProfileForm({
  initial,
  presence: initialPresence,
  version,
  loadError,
}: {
  initial: { username: string; avatarUrl: string | null; bannerUrl: string | null; description: string };
  presence: BotPresence;
  version: string;
  loadError?: string;
}) {
  const [username, setUsername] = useState(initial.username);
  const [description, setDescription] = useState(initial.description);
  const [avatar, setAvatar] = useState<string | null | undefined>(undefined);
  const [banner, setBanner] = useState<string | null | undefined>(undefined);
  const [presence, setPresence] = useState<BotPresence>(initialPresence);
  const [result, setResult] = useState<{ ok: boolean; messages: string[] } | null>(null);
  const [pending, start] = useTransition();

  return (
    <section id="bot-profil" className="card mt-8 grid gap-6 p-6">
      <div>
        <h2 className="font-display text-xl font-semibold">Bot-Profil</h2>
        <p className="mt-1 text-sm text-fog-300">So sieht dein Bot überall in Discord aus. Pro Server gibt es zusätzlich ein eigenes Profil unter Einstellungen.</p>
        {loadError && <p className="mt-2 text-sm text-sun-400">Aktuelles Profil nicht geladen ({loadError}) – Änderungen gehen trotzdem.</p>}
      </div>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid gap-5">
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Name</span>
            <input value={username} maxLength={32} onChange={(e) => setUsername(e.target.value)} className="input" />
            <span className="text-xs text-fog-500">Discord erlaubt nur 2 Namensänderungen pro Stunde.</span>
          </label>
          <ImagePick label="Profilbild" current={initial.avatarUrl} value={avatar} onChange={setAvatar} mascot />
          <ImagePick label="Banner" current={initial.bannerUrl} value={banner} onChange={setBanner} wide />
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Über mich</span>
            <textarea value={description} maxLength={400} rows={4} onChange={(e) => setDescription(e.target.value)} className="input" />
            <span className="text-xs text-fog-500">{description.length}/400 · steht im Profil des Bots</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Status</span>
              <select value={presence.status} onChange={(e) => setPresence({ ...presence, status: e.target.value as BotPresence['status'] })} className="input">
                {BOT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Aktivität</span>
              <select value={presence.type} onChange={(e) => setPresence({ ...presence, type: e.target.value as BotPresence['type'] })} className="input">
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ACTIVITY_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {presence.type !== 'none' && (
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Aktivitäts-Text</span>
              <input value={presence.text} maxLength={128} onChange={(e) => setPresence({ ...presence, text: e.target.value })} className="input" />
              <span className="text-xs text-fog-500">Platzhalter: {'{version}'} = Bot-Version, {'{server}'} = Anzahl Server</span>
            </label>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setResult(await saveBotProfile({ username, description, avatar, banner, presence }));
                })
              }
            >
              {pending ? 'Speichere …' : 'Profil speichern'}
            </button>
          </div>
          <Result result={result} />
        </div>
        <div className="grid justify-items-center gap-2 lg:sticky lg:top-6">
          <p className="text-xs font-bold tracking-[0.2em] text-fog-500 uppercase">Vorschau</p>
          <ProfileCard
            name={username}
            avatar={avatar === undefined ? initial.avatarUrl : avatar}
            banner={banner === undefined ? initial.bannerUrl : banner}
            about={description}
            presence={presence}
            version={version}
          />
        </div>
      </div>
    </section>
  );
}

/** Einstellungen → Bot auf diesem Server */
export function GuildBotProfileForm({
  guildId,
  canEdit,
  botName,
  initial,
  loadError,
}: {
  guildId: string;
  canEdit: boolean;
  botName: string;
  initial: { nick: string; avatarUrl: string | null; bannerUrl: string | null; globalAvatarUrl: string | null };
  loadError?: string;
}) {
  const [nick, setNick] = useState(initial.nick);
  const [bio, setBio] = useState<string | undefined>(undefined);
  const [avatar, setAvatar] = useState<string | null | undefined>(undefined);
  const [banner, setBanner] = useState<string | null | undefined>(undefined);
  const [result, setResult] = useState<{ ok: boolean; messages: string[] } | null>(null);
  const [pending, start] = useTransition();
  const shownAvatar = (avatar === undefined ? initial.avatarUrl : avatar) ?? initial.globalAvatarUrl;

  return (
    <section className="card mt-8 grid gap-6 p-6">
      <div>
        <h2 className="font-display text-xl font-semibold">Bot auf diesem Server</h2>
        <p className="mt-1 text-sm text-fog-300">Eigener Spitzname, eigenes Bild, Banner und Bio – nur auf diesem Server. Leer lassen = das globale Profil gilt.</p>
        {loadError && <p className="mt-2 text-sm text-sun-400">Aktuelles Server-Profil nicht geladen ({loadError}).</p>}
      </div>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid gap-5">
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Spitzname</span>
            <input value={nick} maxLength={32} placeholder={botName} disabled={!canEdit} onChange={(e) => setNick(e.target.value)} className="input" />
          </label>
          <ImagePick label="Server-Profilbild" current={initial.avatarUrl} value={avatar} onChange={setAvatar} mascot />
          <ImagePick label="Server-Banner" current={initial.bannerUrl} value={banner} onChange={setBanner} wide />
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Bio auf diesem Server</span>
            <textarea value={bio ?? ''} maxLength={190} rows={3} disabled={!canEdit} placeholder="leer = „Über mich“ aus dem globalen Profil" onChange={(e) => setBio(e.target.value)} className="input" />
          </label>
          <div className="rounded-xl border border-ink-700 bg-ink-850 p-3 text-xs text-fog-300">
            <b className="text-fog-100">Server-Tag?</b> Das Kürzel neben Namen (Discords „Server Tags“) legt nur der Server-Owner in den Server-Einstellungen
            von Discord fest – Bots können es nicht setzen.
          </div>
          <div>
            <button
              type="button"
              className="btn-primary"
              disabled={!canEdit || pending}
              onClick={() => start(async () => setResult(await saveGuildBotProfile(guildId, { nick, bio, avatar, banner })))}
            >
              {pending ? 'Speichere …' : 'Server-Profil speichern'}
            </button>
          </div>
          <Result result={result} />
        </div>
        <div className="grid justify-items-center gap-2">
          <p className="text-xs font-bold tracking-[0.2em] text-fog-500 uppercase">Vorschau</p>
          <ProfileCard name={nick || botName} avatar={shownAvatar} banner={banner === undefined ? initial.bannerUrl : banner} about={bio ?? ''} version="" />
        </div>
      </div>
    </section>
  );
}
