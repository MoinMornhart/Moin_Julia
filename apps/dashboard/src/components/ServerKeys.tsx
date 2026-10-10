'use client';

import { useState, useTransition } from 'react';
import { COMPAT_PROVIDER_IDS, COMPAT_PROVIDERS, type CompatProvider } from '@moin/shared';
import { removeServerKey, saveServerKey } from '@/app/g/[guildId]/julia/actions';
import type { ActionResult } from '@/app/g/[guildId]/actions';

type Provider = 'anthropic' | CompatProvider;

const INFO: Record<Provider, { label: string; icon: string; keyUrl: string; keyHint: string }> = {
  anthropic: { label: 'Claude (Anthropic)', icon: '🤖', keyUrl: 'https://console.anthropic.com/settings/keys', keyHint: 'sk-ant-…' },
  ...(Object.fromEntries(COMPAT_PROVIDER_IDS.map((id) => [id, COMPAT_PROVIDERS[id]])) as Record<CompatProvider, (typeof COMPAT_PROVIDERS)[CompatProvider]>),
};

/**
 * Eigene KI-Schlüssel nur für diesen Server: Jeder Server-Admin kann hier seinen eigenen Schlüssel
 * eintragen und zahlt dann selbst beim Anbieter. Schlüssel kommen nie zurück in den Browser (nur ••••1234).
 */
export function ServerKeys({
  guildId,
  canEdit,
  isAdmin,
  masked,
  customBaseUrl,
}: {
  guildId: string;
  canEdit: boolean;
  isAdmin: boolean;
  masked: Partial<Record<Provider, string>>;
  customBaseUrl: string;
}) {
  const providers: Provider[] = ['anthropic', ...COMPAT_PROVIDER_IDS.filter((p) => p !== 'custom' || isAdmin || masked.custom || customBaseUrl)];
  return (
    <section className="card grid gap-4 p-5 text-sm" aria-labelledby="server-keys-title">
      <div>
        <p id="server-keys-title" className="font-display text-lg font-semibold">
          🔑 Eigene Schlüssel für diesen Server
        </p>
        <p className="text-fog-300">
          Jeder Server kann seinen eigenen KI-Schlüssel nutzen und zahlt dann selbst beim Anbieter. Danach unter „Einstellungen“ den Anbieter wählen. Schlüssel werden verschlüsselt
          gespeichert und nie wieder angezeigt.
        </p>
      </div>
      <ul className="grid gap-2" aria-label="Anbieter">
        {providers.map((p) => (
          <ProviderRow key={p} guildId={guildId} provider={p} canEdit={canEdit} masked={masked[p] ?? null} customBaseUrl={customBaseUrl} />
        ))}
      </ul>
    </section>
  );
}

function ProviderRow({ guildId, provider, canEdit, masked, customBaseUrl }: { guildId: string; provider: Provider; canEdit: boolean; masked: string | null; customBaseUrl: string }) {
  const info = INFO[provider];
  const connected = provider === 'custom' ? !!customBaseUrl : !!masked;
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<ActionResult | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [pending, start] = useTransition();
  const save = (form: FormData) =>
    start(async () => {
      const r = await saveServerKey(guildId, provider, form);
      setMessage(r);
      if (r.ok) {
        setInputKey((k) => k + 1);
        setOpen(false);
      }
    });
  return (
    <li className="grid gap-3 rounded-xl border border-ink-700 bg-ink-900 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xl" aria-hidden>
          {info.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{info.label}</span>
          <span className="block text-xs break-words text-fog-500">
            {connected ? (provider === 'custom' ? `${customBaseUrl}${masked ? ` · Schlüssel ${masked}` : ''}` : `eigener Schlüssel ${masked}`) : 'kein eigener Schlüssel'}
          </span>
        </span>
        <span className={`chip ${connected ? 'bg-sea-400/15 text-sea-400' : 'bg-ink-800 text-fog-500'}`}>{connected ? 'eigener' : '—'}</span>
        {canEdit && (
          <button type="button" className="text-xs text-fog-300 underline" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? 'zuklappen' : connected ? 'ändern' : 'eintragen'}
          </button>
        )}
      </div>
      {open && canEdit && (
        <form action={save} className="grid gap-3">
          {info.keyUrl && (
            <p className="text-xs text-fog-300">
              Schlüssel bekommst du bei{' '}
              <a href={info.keyUrl} target="_blank" rel="noopener" className="text-coral-400 underline">
                {new URL(info.keyUrl).hostname}
              </a>
              . Tipp: dort ein Ausgabelimit setzen.
            </p>
          )}
          <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
            {provider === 'custom' && (
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="font-semibold">Adresse (OpenAI-kompatibel, bis …/v1)</span>
                <input name="baseUrl" defaultValue={customBaseUrl} placeholder="https://mein-server.de/v1" spellCheck={false} className="input font-mono" />
              </label>
            )}
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="font-semibold">API-Schlüssel{provider === 'custom' ? ' (falls nötig)' : ''}</span>
              <input key={inputKey} name="apiKey" type="password" autoComplete="new-password" placeholder={info.keyHint || '…'} className="input font-mono" />
            </label>
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? 'Prüfe …' : 'Prüfen und speichern'}
            </button>
            {connected && (
              <button
                type="button"
                className="text-xs text-fog-500 hover:text-danger-500"
                disabled={pending}
                onClick={() => start(async () => setMessage(await removeServerKey(guildId, provider)))}
              >
                {info.label} entfernen
              </button>
            )}
          </div>
        </form>
      )}
      {message?.message && <p className={`text-sm ${message.ok ? 'text-sea-400' : 'text-danger-500'}`}>{message.message}</p>}
    </li>
  );
}
