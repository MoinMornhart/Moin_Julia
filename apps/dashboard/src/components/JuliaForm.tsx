'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  CLAUDE_MODEL_IDS,
  CLAUDE_MODELS,
  COMPAT_PROVIDER_IDS,
  COMPAT_PROVIDERS,
  DEFAULT_PERSONA,
  isCompatProvider,
  JULIA_TOOL_LABELS,
  JULIA_TOOL_PERMISSION,
  JULIA_TOOLS,
  LIMIT_PERIOD_LABELS,
  LIMIT_PERIODS,
  LIMIT_UNIT_LABELS,
  LIMIT_UNITS,
  type JuliaConfig,
} from '@moin/shared';
import { askJuliaTest, loadProviderModels, saveJuliaSettings } from '@/app/g/[guildId]/julia/actions';
import type { ActionResult } from '@/app/g/[guildId]/actions';
import type { ChannelOption } from '@/lib/discord';
import { ChannelSelect } from './ChannelSelect';
import { ChipPicker, NumberField, RoleSelect, SectionCard, ToggleRow } from './FormParts';
import { KeepForm } from './KeepForm';
import { LimitOverridesEditor } from './LimitOverridesEditor';
import { KeywordRulesEditor } from './KeywordRulesEditor';
import { UserPicker } from './UserPicker';
import { DefaultStyleField } from './ModeStyleFields';

/** Julia → Einstellungen */
export function JuliaForm({
  guildId,
  canEdit,
  config,
  channels,
  roles,
  connected,
  flirtyInfo,
  people,
}: {
  guildId: string;
  canEdit: boolean;
  config: JuliaConfig;
  channels: ChannelOption[];
  roles: { id: string; name: string; color: number }[];
  /** anthropic: Instanz- oder eigener Schlüssel; serverKeys: Anbieter mit eigenem Schlüssel dieses Servers */
  connected: { anthropic: boolean; ollama: { id: string; name: string; model: string }[]; serverKeys: string[] };
  /** Für „warum flirtet Julia (nicht)?“: altersbeschränkte Kanäle und Anzahl Zustimmungen */
  flirtyInfo?: { nsfwChannels: string[]; consents: number };
  /** Namen der gespeicherten Personen (Blacklist/Whitelist) */
  people?: { blocked: { id: string; name: string }[]; allowed: { id: string; name: string }[] };
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>((_p, form) => saveJuliaSettings(guildId, form), null);
  const [provider, setProvider] = useState(config.provider);
  const [persona, setPersona] = useState(config.persona);
  const [models, setModels] = useState<{ provider: string; list: string[]; message: string } | null>(null);
  const [loadingModels, startModels] = useTransition();
  const hasKey = (p: string) => (p === 'anthropic' ? connected.anthropic : p === 'ollama' ? connected.ollama.length > 0 : connected.serverKeys.includes(p));

  return (
    <KeepForm action={action} className="grid max-w-4xl gap-6">
      <fieldset disabled={!canEdit || pending} className="grid gap-6">
        <SectionCard
          title="KI-Anbieter"
          description="Claude ist klug und kostet ein paar Cent pro Gespräch; Ollama läuft kostenlos auf deinem eigenen Rechner. Gemini, ChatGPT & Co. gehen mit einem eigenen Schlüssel dieses Servers (Reiter „Verbindung“)."
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ['anthropic', '🤖 Claude', connected.anthropic ? 'verbunden' : 'noch nicht verbunden'],
                ['ollama', '🦙 Ollama', connected.ollama.length ? `verbunden · ${connected.ollama.length === 1 ? connected.ollama[0]!.model : `${connected.ollama.length} Endpunkte`}` : 'noch nicht verbunden'],
                ...COMPAT_PROVIDER_IDS.filter((id) => id !== 'custom' || hasKey('custom') || config.customBaseUrl || provider === 'custom').map(
                  (id) => [id, `${COMPAT_PROVIDERS[id].icon} ${COMPAT_PROVIDERS[id].label}`, hasKey(id) || (id === 'custom' && config.customBaseUrl) ? 'eigener Schlüssel' : 'noch nicht eingerichtet'] as const,
                ),
              ] as const
            ).map(([id, label, status]) => (
              <label key={id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 has-checked:border-coral-500 has-checked:bg-coral-500/10">
                <input type="radio" name="provider" value={id} checked={provider === id} onChange={() => setProvider(id)} className="accent-coral-500" />
                <span>
                  <span className="block font-semibold">{label}</span>
                  <span className="text-xs text-fog-500">{status}</span>
                </span>
              </label>
            ))}
          </div>
          {provider === 'anthropic' && (
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Modell</span>
              <select name="model" defaultValue={config.model} className="input w-full max-w-2xl">
                {CLAUDE_MODEL_IDS.map((id) => (
                  <option key={id} value={id}>
                    {CLAUDE_MODELS[id].label} · {CLAUDE_MODELS[id].input} $ / {CLAUDE_MODELS[id].output} $ pro Mio. Tokens
                  </option>
                ))}
              </select>
            </label>
          )}
          {provider === 'ollama' && connected.ollama.length > 0 && (
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Ollama-Endpunkt für diesen Server</span>
              <select name="ollamaEndpointId" defaultValue={connected.ollama.some((e) => e.id === config.ollamaEndpointId) ? config.ollamaEndpointId : ''} className="input w-full max-w-2xl">
                <option value="">Automatisch (der erste: {connected.ollama[0]!.name} · {connected.ollama[0]!.model})</option>
                {connected.ollama.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} · {e.model}
                  </option>
                ))}
              </select>
            </label>
          )}
          {isCompatProvider(provider) && (
            <div className="grid gap-2 text-sm">
              <label className="grid gap-1.5">
                <span className="font-semibold">Modell</span>
                <input
                  name="aiModel"
                  list="ai-models"
                  defaultValue={config.aiModel}
                  placeholder={COMPAT_PROVIDERS[provider].defaultModel || 'Modellname'}
                  spellCheck={false}
                  className="input w-full max-w-2xl font-mono"
                />
              </label>
              <datalist id="ai-models">
                {(models?.provider === provider ? models.list : []).map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={loadingModels || (!hasKey(provider) && !(provider === 'custom' && config.customBaseUrl))}
                  onClick={() =>
                    startModels(async () => {
                      const r = await loadProviderModels(guildId, provider);
                      setModels({ provider, list: r.models, message: r.message });
                    })
                  }
                >
                  {loadingModels ? 'Lade …' : 'Modelle laden'}
                </button>
                <span className="text-fog-500">{models?.provider === provider ? models.message : 'Leer lassen = Standard des Anbieters. Kosten rechnet der Anbieter direkt mit euch ab.'}</span>
              </div>
            </div>
          )}
          {!(hasKey(provider) || (provider === 'custom' && config.customBaseUrl)) && (
            <p className="rounded-lg border border-sun-400/40 bg-sun-400/10 px-3 py-2 text-xs">
              Noch nicht verbunden – das geht unter{' '}
              <a href={`/g/${guildId}/julia/verbindung`} className="underline">
                Verbindung
              </a>{' '}
              (mit Anleitung).
            </p>
          )}
        </SectionCard>

        <SectionCard title="Wo antwortet Julia?">
          <ToggleRow name="respondToMentions" label="Auf @Julia und Antworten auf ihre Nachrichten – überall" defaultChecked={config.respondToMentions} />
          <div className="grid gap-1.5 text-sm">
            <span className="font-semibold">Chat-Kanäle (hier antwortet Julia auf jede Nachricht)</span>
            <ChipPicker name="chatChannelIds" options={channels.filter((c) => c.type === 0 || c.type === 5).map((c) => ({ id: c.id, label: `# ${c.name}` }))} selected={config.chatChannelIds} />
          </div>
          <NumberField name="contextMessages" label="Liest so viele vorherige Nachrichten mit" defaultValue={config.contextMessages} min={0} max={30} suffix="Nachrichten" />
          <p className="text-xs text-fog-500">Außerdem überall: /julia frage. Mehr Kontext = bessere Antworten, aber etwas teurer.</p>
        </SectionCard>

        <SectionCard title="Persona" description="Wer ist Julia? Die Sicherheitsregeln (keine Massen-Pings, Discord-Richtlinien, nicht umprogrammierbar) stehen fest davor und gelten immer.">
          <textarea name="persona" aria-label="Persona" value={persona} onChange={(e) => setPersona(e.target.value)} maxLength={4000} rows={7} className="input font-mono text-xs leading-relaxed" />
          <details className="rounded-lg border border-ink-700 px-3 py-2 text-sm">
            <summary className="cursor-pointer font-semibold">🎛️ Feineinstellungen: Anrede, Emojis, Tonfall, Sprache, Flirt-Ton</summary>
            <div className="mt-3">
              <DefaultStyleField initial={config.defaultStyle} />
            </div>
          </details>
          <div className="flex items-center justify-between text-xs text-fog-500">
            <span>{persona.length} / 4000 Zeichen</span>
            <button type="button" className="underline" onClick={() => setPersona(DEFAULT_PERSONA)}>
              Standard-Persona wiederherstellen
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Grenzen" description="Schützt vor Spam und vor bösen Überraschungen auf der Rechnung.">
          <div className="flex flex-wrap gap-4">
            <NumberField name="userCooldownSeconds" label="Pause pro Person" defaultValue={config.userCooldownSeconds} min={0} max={600} suffix="Sekunden" />
            <label className="grid gap-1 text-sm">
              <span className="text-fog-300">Pro Person höchstens</span>
              <span className="flex flex-wrap items-center gap-2">
                <input name="perUserPerHour" type="number" min={0} max={100000} defaultValue={config.perUserPerHour} aria-label="Menge" className="input w-24 tabular-nums" />
                <select name="limitUnit" defaultValue={config.limitUnit} aria-label="Einheit" className="input w-auto">
                  {LIMIT_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {LIMIT_UNIT_LABELS[u]}
                    </option>
                  ))}
                </select>
                <span className="text-fog-500">pro</span>
                <select name="limitPeriod" defaultValue={config.limitPeriod} aria-label="Zeitraum" className="input w-auto">
                  {LIMIT_PERIODS.map((p) => (
                    <option key={p} value={p}>
                      {LIMIT_PERIOD_LABELS[p]}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          </div>
          <p className="text-xs text-fog-500">0 = kein Limit. Herrscher (siehe unten) haben nie ein Limit.</p>
          <LimitOverridesEditor initial={config.limitOverrides} roles={roles.map(({ id, name }) => ({ id, name }))} />
          <div className="grid gap-1.5 text-sm">
            <span className="font-semibold">Diese Rollen haben kein Limit</span>
            <ChipPicker name="unlimitedRoleIds" options={roles.map((r) => ({ id: r.id, label: r.name, color: r.color }))} selected={config.unlimitedRoleIds} />
          </div>
          {provider === 'anthropic' && (
            <div className="flex flex-wrap items-end gap-4">
              <label className="grid gap-1 text-sm">
                <span className="text-fog-300">Monatsbudget (harte Grenze)</span>
                <span className="flex items-center gap-2">
                  <input name="monthlyBudgetUsd" type="number" min={0} max={1000} step="0.5" defaultValue={config.monthlyBudgetUsd} className="input w-28 tabular-nums" />
                  <span className="text-fog-500">$</span>
                </span>
              </label>
              <NumberField name="warnAtPercent" label="Warnen ab" defaultValue={config.warnAtPercent} min={10} max={99} suffix="%" />
              <label className="grid gap-1.5 text-sm">
                <span className="text-fog-300">Warnung in</span>
                <ChannelSelect id="logChannelId" name="logChannelId" channels={channels} defaultValue={config.logChannelId || null} emptyLabel="— keine Warnung —" />
              </label>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Wer darf Julia nutzen?" description="Blacklist: Diese Personen und Rollen ignoriert Julia. Whitelist: Steht hier jemand, antwortet Julia NUR diesen Personen und Rollen. Herrscher dürfen immer.">
          <div className="grid gap-1.5 text-sm">
            <span className="font-semibold">🚫 Blacklist – Rollen</span>
            <ChipPicker name="blockedRoleIds" options={roles.map((r) => ({ id: r.id, label: r.name, color: r.color }))} selected={config.blockedRoleIds} />
          </div>
          <UserPicker guildId={guildId} name="blockedUserIds" label="🚫 Blacklist – Personen" initial={people?.blocked ?? config.blockedUserIds.map((id) => ({ id, name: id }))} />
          <div className="grid gap-1.5 text-sm">
            <span className="font-semibold">✅ Whitelist – Rollen (leer = alle)</span>
            <ChipPicker name="allowRoleIds" options={roles.map((r) => ({ id: r.id, label: r.name, color: r.color }))} selected={config.allowRoleIds} />
          </div>
          <UserPicker guildId={guildId} name="allowUserIds" label="✅ Whitelist – Personen (leer = alle)" initial={people?.allowed ?? config.allowUserIds.map((id) => ({ id, name: id }))} />
        </SectionCard>

        <SectionCard title="🔑 Stichwort-Regeln" description="Wenn bestimmte Wörter fallen, bekommt Julia eine Zusatzanweisung – und antwortet auf Wunsch in einem bestimmten Modus.">
          <KeywordRulesEditor initial={config.keywordRules} modes={config.modes.map((m) => ({ id: m.id, name: m.name }))} />
        </SectionCard>

        <SectionCard
          title="🛠️ Julia darf handeln"
          description="Julia schlägt auf Bitte eine Aktion vor (Privatnachricht, Timeout, Kanal anlegen) – ausgeführt wird erst nach Klick auf „Ja, ausführen“. Nur wer selbst das passende Discord-Recht hat, kann sie darum bitten. Personen müssen in der Nachricht mit @ erwähnt sein."
        >
          <input type="hidden" name="tools.present" value="1" />
          <ToggleRow name="tools.enabled" label="Julia-Werkzeuge erlauben" defaultChecked={config.tools.enabled} />
          <fieldset className="grid gap-1.5 text-sm">
            <legend className="mb-1 font-semibold">Diese Werkzeuge</legend>
            {JULIA_TOOLS.map((tool) => (
              <label key={tool} className="flex items-center gap-2">
                <input type="checkbox" name="tools.allowed" value={tool} defaultChecked={config.tools.allowed.includes(tool)} className="size-4 accent-coral-500" />
                <span>
                  {JULIA_TOOL_LABELS[tool]} <span className="text-fog-500">– braucht „{JULIA_TOOL_PERMISSION[tool] === 'ModerateMembers' ? 'Mitglieder im Timeout' : 'Kanäle verwalten'}“</span>
                </span>
              </label>
            ))}
          </fieldset>
        </SectionCard>

        <SectionCard
          title="🚫 Beleidigungen gegen Julia"
          description="Schreibt jemand Julia eine Beleidigung (per @Julia, als Antwort auf sie oder in ihrem Chat-Kanal), löscht sie die Nachricht und meldet sie im Log. Erkannt wird über eine Wortliste – auch verschleiert wie „1d10t“. Herrscher sind ausgenommen."
        >
          <input type="hidden" name="insultGuard.present" value="1" />
          <ToggleRow name="insultGuard.enabled" label="Beleidigungen löschen und melden" defaultChecked={config.insultGuard.enabled} />
          <ToggleRow
            name="insultGuard.deleteMessage"
            label="Nachricht löschen"
            description="Aus = nur melden. Zum Löschen braucht der Bot das Recht „Nachrichten verwalten“."
            defaultChecked={config.insultGuard.deleteMessage}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Melden in</span>
              <ChannelSelect id="insultGuard.logChannelId" name="insultGuard.logChannelId" channels={channels} defaultValue={config.insultGuard.logChannelId || null} emptyLabel="— wie Julias Warn-Kanal —" />
            </label>
            <label className="grid gap-1.5 text-sm" title="Zusätzlich zur eingebauten Liste, durch Komma getrennt">
              <span className="font-semibold">Eigene Wörter</span>
              <input name="insultGuard.extraWords" defaultValue={config.insultGuard.extraWords} maxLength={1000} placeholder="z. B. Lappen, Pfeife" className="input" />
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Gedächtnis & Modi" description="Mitglieder sehen mit /julia profil, was Julia über sie weiß, und löschen es mit /julia vergessen.">
          <ToggleRow
            name="memoryEnabled"
            label="Gedächtnis an"
            description="Julia merkt sich Dinge nur, wenn man sie ausdrücklich darum bittet („merk dir …“ oder /julia merken) – höchstens 20 pro Person."
            defaultChecked={config.memoryEnabled}
          />
          <div className="grid gap-1.5 text-sm">
            <span className="font-semibold">Diese Rollen dürfen mit „modus Name“ umschalten (Admins immer)</span>
            <ChipPicker name="modeRoleIds" options={roles.map((r) => ({ id: r.id, label: r.name, color: r.color }))} selected={config.modeRoleIds} />
          </div>
        </SectionCard>

        <SectionCard
          title="😉 Flirt-Ton (nur Erwachsene)"
          description="Verspielt-charmant, nie explizit. Der Bot prüft vor jeder Antwort selbst: Rolle + altersbeschränkter Kanal + eigenes Opt-in (/julia flirty an) + keine Alters-Sperre. Wer ein Alter unter 18 angibt, wird dauerhaft gesperrt."
        >
          <ToggleRow name="flirty.enabled" label="Flirt-Ton erlauben" defaultChecked={config.flirty.enabled}>
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">18+-Rolle</span>
              <RoleSelect id="flirty.adultRoleId" name="flirty.adultRoleId" roles={roles} defaultValue={config.flirty.adultRoleId || null} emptyLabel="— Rolle wählen —" />
            </label>
          </ToggleRow>
          {flirtyInfo && (
            <ul className="grid gap-1 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-xs" aria-label="Flirt-Ton Voraussetzungen">
              <li>{config.flirty.enabled ? '✅' : '❌'} Flirt-Ton erlaubt</li>
              <li>{config.flirty.adultRoleId ? '✅' : '❌'} 18+-Rolle gewählt</li>
              <li>
                {flirtyInfo.nsfwChannels.length ? '✅' : '❌'} Altersbeschränkte Kanäle:{' '}
                {flirtyInfo.nsfwChannels.length ? flirtyInfo.nsfwChannels.map((n) => `#${n}`).join(', ') : 'keine – in Discord: Kanal bearbeiten → „Altersbeschränkter Kanal“'}
              </li>
              <li>👥 Zustimmungen: {flirtyInfo.consents} – wer die Rolle hat und Julia in so einem Kanal anschreibt, wird einmal per Knopf gefragt.</li>
              <li className="text-fog-500">In Discord zeigt „/julia flirty prüfen“ jeder Person, was bei ihr noch fehlt.</li>
            </ul>
          )}
        </SectionCard>
      </fieldset>

      <div className="flex items-center gap-4">
        <button type="submit" className="btn-primary" disabled={!canEdit || pending}>
          {pending ? 'Speichere …' : 'Speichern'}
        </button>
        {state?.message && <p className={`text-sm ${state.ok ? 'text-sea-400' : 'text-danger-500'}`}>{state.message}</p>}
      </div>
    </KeepForm>
  );
}

/** „Julia testen“ – eine Frage stellen, ohne nach Discord zu wechseln */
export function JuliaTest({ guildId, canEdit }: { guildId: string; canEdit: boolean }) {
  const [question, setQuestion] = useState('Moin Julia! Stell dich kurz vor.');
  const [result, setResult] = useState<{ ok: boolean; answer?: string; message?: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="card grid gap-3 p-5 text-sm">
      <p className="font-display text-lg font-semibold">💬 Julia testen</p>
      <div className="flex flex-wrap gap-2">
        <input aria-label="Testfrage" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1000} className="input min-w-0 flex-1" />
        <button type="button" className="btn-primary" disabled={!canEdit || pending || !question.trim()} onClick={() => start(async () => setResult(await askJuliaTest(guildId, question)))}>
          {pending ? 'Julia denkt …' : 'Fragen'}
        </button>
      </div>
      {result?.answer && (
        <div className="flex gap-3 rounded-xl bg-ink-850 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- statisches Maskottchen */}
          <img src="/branding/bot-avatar.png" alt="" width={36} height={36} className="size-9 shrink-0 rounded-full" />
          <p className="whitespace-pre-wrap break-words text-fog-100">{result.answer}</p>
        </div>
      )}
      {result?.message && <p className={`text-xs ${result.ok ? 'text-fog-500' : 'text-danger-500'}`}>{result.message}</p>}
    </div>
  );
}
