'use client';

import { useActionState, useState, useTransition } from 'react';
import { CLAUDE_MODEL_IDS, CLAUDE_MODELS, DEFAULT_PERSONA, type JuliaConfig } from '@moin/shared';
import { askJuliaTest, saveJuliaSettings } from '@/app/g/[guildId]/julia/actions';
import type { ActionResult } from '@/app/g/[guildId]/actions';
import type { ChannelOption } from '@/lib/discord';
import { ChannelSelect } from './ChannelSelect';
import { ChipPicker, NumberField, RoleSelect, SectionCard, ToggleRow } from './FormParts';
import { KeepForm } from './KeepForm';

/** Julia → Einstellungen */
export function JuliaForm({
  guildId,
  canEdit,
  config,
  channels,
  roles,
  connected,
}: {
  guildId: string;
  canEdit: boolean;
  config: JuliaConfig;
  channels: ChannelOption[];
  roles: { id: string; name: string; color: number }[];
  connected: { anthropic: boolean; ollama: { id: string; name: string; model: string }[] };
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>((_p, form) => saveJuliaSettings(guildId, form), null);
  const [provider, setProvider] = useState(config.provider);
  const [persona, setPersona] = useState(config.persona);

  return (
    <KeepForm action={action} className="grid max-w-4xl gap-6">
      <fieldset disabled={!canEdit || pending} className="grid gap-6">
        <SectionCard title="KI-Anbieter" description="Claude ist klüger und kostet ein paar Cent pro Gespräch; Ollama läuft kostenlos auf deinem eigenen Rechner.">
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['anthropic', '🤖 Claude', connected.anthropic ? 'verbunden' : 'noch nicht verbunden'],
                ['ollama', '🦙 Ollama', connected.ollama.length ? `verbunden · ${connected.ollama.length === 1 ? connected.ollama[0]!.model : `${connected.ollama.length} Endpunkte`}` : 'noch nicht verbunden'],
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
          {!(provider === 'anthropic' ? connected.anthropic : connected.ollama.length > 0) && (
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
            <NumberField name="perUserPerHour" label="Pro Person und Stunde höchstens" defaultValue={config.perUserPerHour} min={0} max={500} suffix="Antworten" />
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
          <div className="grid gap-1.5 text-sm">
            <span className="font-semibold">Diese Rollen dürfen Julia nicht nutzen</span>
            <ChipPicker name="blockedRoleIds" options={roles.map((r) => ({ id: r.id, label: r.name, color: r.color }))} selected={config.blockedRoleIds} />
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
          <p className="whitespace-pre-wrap text-fog-100">{result.answer}</p>
        </div>
      )}
      {result?.message && <p className={`text-xs ${result.ok ? 'text-fog-500' : 'text-danger-500'}`}>{result.message}</p>}
    </div>
  );
}
