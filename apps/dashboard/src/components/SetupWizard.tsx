'use client';

import { useState, useTransition } from 'react';
import { checkDiscordStep, finishSetup, verifyCode, type SetupValues } from '@/app/setup/actions';
import type { CheckResult } from '@/lib/validate';

type Step = 'code' | 'discord' | 'url' | 'optional' | 'done';

const STEPS: { key: Step; label: string; hint: string }[] = [
  { key: 'code', label: 'Einrichtungs-Code', hint: 'Zeigt der Installer am Ende' },
  { key: 'discord', label: 'Discord-Bot', hint: 'Token, Application-ID, Secret' },
  { key: 'url', label: 'Adresse', hint: 'Dashboard-URL und Login' },
  { key: 'optional', label: 'Speichern', hint: 'Bot starten' },
  { key: 'done', label: 'Fertig', hint: 'Mit Discord anmelden' },
];

const EMPTY: SetupValues = {
  token: '',
  clientId: '',
  clientSecret: '',
  dashboardUrl: '',
  anthropicApiKey: '',
  twitchClientId: '',
  twitchClientSecret: '',
  youtubeApiKey: '',
};

export function SetupWizard({ initialStep, suggestedUrl, alreadySaved }: { initialStep: Step; suggestedUrl: string; alreadySaved: boolean }) {
  const [step, setStep] = useState<Step>(initialStep);
  const [values, setValues] = useState<SetupValues>({ ...EMPTY, dashboardUrl: suggestedUrl });
  const [saved, setSaved] = useState(alreadySaved);
  const set = (key: keyof SetupValues) => (e: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [key]: e.target.value });
  const index = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_1fr]">
      <ol className="relative grid content-start gap-1 border-l border-ink-700 pl-5" aria-label="Schritte">
        {STEPS.map((s, i) => (
          <li key={s.key} className="relative py-2" aria-current={s.key === step ? 'step' : undefined}>
            <span
              className={`absolute top-3 -left-[1.95rem] grid size-6 place-items-center rounded-full border-2 text-[11px] font-bold ${
                i < index ? 'border-sea-500 bg-sea-500 text-ink-950' : i === index ? 'border-coral-500 bg-coral-500 text-ink-950' : 'border-ink-600 bg-ink-950 text-fog-500'
              }`}
            >
              {i < index ? '✓' : i + 1}
            </span>
            <p className={`font-semibold ${i === index ? 'text-coral-400' : i < index ? 'text-fog-100' : 'text-fog-500'}`}>{s.label}</p>
            <p className="text-xs text-fog-500">{s.hint}</p>
          </li>
        ))}
      </ol>

      <div className="card p-6 sm:p-8">
        {step === 'code' && <CodeStep onDone={() => setStep(saved ? 'done' : 'discord')} />}
        {step === 'discord' && <DiscordStep values={values} set={set} onDone={() => setStep('url')} />}
        {step === 'url' && <UrlStep values={values} set={set} onBack={() => setStep('discord')} onDone={() => setStep('optional')} />}
        {step === 'optional' && (
          <OptionalStep
            values={values}
            set={set}
            onBack={() => setStep('url')}
            onDone={() => {
              setSaved(true);
              setStep('done');
            }}
          />
        )}
        {step === 'done' && <DoneStep />}
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  secret = false,
  placeholder,
  help,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  secret?: boolean;
  placeholder?: string;
  help?: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="grid gap-1.5">
      <span className="font-semibold">{label}</span>
      {help && <span className="text-sm text-fog-500">{help}</span>}
      <input
        id={id}
        name={id}
        type={secret ? 'password' : 'text'}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="input font-mono"
      />
    </label>
  );
}

function Results({ result }: { result: CheckResult | null }) {
  if (!result) return null;
  return (
    <ul className="grid gap-1.5 text-sm" aria-live="polite">
      {result.errors.map((m) => (
        <li key={m} className="rounded-lg bg-danger-500/10 px-3 py-2 text-fog-100">
          ❌ {m}
        </li>
      ))}
      {result.warnings.map((m) => (
        <li key={m} className="rounded-lg bg-sun-400/10 px-3 py-2 text-fog-100">
          ⚠️ {m}
        </li>
      ))}
      {result.info.map((m) => (
        <li key={m} className="rounded-lg bg-sea-500/10 px-3 py-2 text-fog-100">
          ✅ {m}
        </li>
      ))}
    </ul>
  );
}

function CodeStep({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await verifyCode(code);
          if (r.ok) onDone();
          else setError(r.message);
        });
      }}
    >
      <div>
        <h2 className="font-display text-2xl font-semibold">Einrichtungs-Code</h2>
        <p className="mt-1 text-fog-300">
          Damit nur du die Einrichtung machen kannst. Der Code stand am Ende der Installation. Vergessen? Im Container{' '}
          <code>moin-julia setup-code</code> eingeben.
        </p>
      </div>
      <Field id="setupCode" label="Code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="z. B. MOIN-7K4P-2QXB" />
      {error && <p className="rounded-lg bg-danger-500/10 px-3 py-2 text-sm">❌ {error}</p>}
      <button className="btn-primary w-fit" disabled={pending || !code.trim()}>
        {pending ? 'Prüfe …' : 'Weiter'}
      </button>
    </form>
  );
}

function DiscordStep({
  values,
  set,
  onDone,
}: {
  values: SetupValues;
  set: (k: keyof SetupValues) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDone: () => void;
}) {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [pending, start] = useTransition();
  const filled = values.token && values.clientId && values.clientSecret;
  return (
    <div className="grid gap-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Discord-Bot verbinden</h2>
        <p className="mt-1 text-fog-300">So legst du die Anwendung an (einmalig):</p>
      </div>
      <ol className="grid list-decimal gap-2 pl-5 text-sm text-fog-300 marker:font-bold marker:text-coral-400">
        <li>
          Öffne{' '}
          <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-coral-400 underline">
            discord.com/developers/applications
          </a>{' '}
          und klicke <b>New Application</b> (Name z. B. „Moin_Julia“).
        </li>
        <li>
          <b>General Information</b>: die <b>Application ID</b> kopieren.
        </li>
        <li>
          <b>Bot</b>: <b>Reset Token</b> → Token kopieren. Darunter <b>Server Members Intent</b> und <b>Message Content Intent</b> einschalten
          und speichern.
        </li>
        <li>
          <b>OAuth2</b>: <b>Reset Secret</b> → Client Secret kopieren.
        </li>
      </ol>
      <div className="grid gap-4">
        <Field id="token" label="Bot-Token" value={values.token} onChange={set('token')} secret />
        <Field id="clientId" label="Application ID" value={values.clientId} onChange={set('clientId')} placeholder="123456789012345678" />
        <Field id="clientSecret" label="Client Secret" value={values.clientSecret} onChange={set('clientSecret')} secret />
      </div>
      <Results result={result} />
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-ghost"
          disabled={pending || !filled}
          onClick={() => start(async () => setResult(await checkDiscordStep(values)))}
        >
          {pending ? 'Prüfe bei Discord …' : 'Bei Discord prüfen'}
        </button>
        <button type="button" className="btn-primary" disabled={!result?.ok} onClick={onDone}>
          Weiter
        </button>
      </div>
      <p className="text-xs text-fog-500">
        Die Werte werden verschlüsselt in deiner eigenen Datenbank gespeichert und nie an Dritte geschickt – geprüft wird nur direkt bei Discord.
      </p>
    </div>
  );
}

function UrlStep({
  values,
  set,
  onBack,
  onDone,
}: {
  values: SetupValues;
  set: (k: keyof SetupValues) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const base = values.dashboardUrl.trim().replace(/\/+$/, '');
  const redirect = `${base}/api/auth/callback`;
  const valid = /^https?:\/\/[^\s/]+/.test(base);
  return (
    <div className="grid gap-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Adresse des Dashboards</h2>
        <p className="mt-1 text-fog-300">
          Unter dieser Adresse meldest du dich später an. Vorgeschlagen ist die, über die du gerade hier bist. Hast du schon eine Domain mit
          Reverse-Proxy (z. B. <code>https://bot.deine-domain.de</code>), trag sie ein.
        </p>
      </div>
      <Field id="dashboardUrl" label="Dashboard-URL" value={values.dashboardUrl} onChange={set('dashboardUrl')} placeholder="http://192.168.1.50:3000" />
      <div className="grid gap-2 rounded-xl border border-ink-700 bg-ink-850 p-4">
        <p className="font-semibold">Diese Redirect-URL im Developer Portal eintragen</p>
        <p className="text-sm text-fog-500">Developer Portal → deine Anwendung → OAuth2 → Redirects → Add Redirect → speichern</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-lg bg-ink-950 px-3 py-2 text-sm break-all text-sea-400">{valid ? redirect : '–'}</code>
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            disabled={!valid}
            onClick={() => {
              navigator.clipboard.writeText(redirect).then(
                () => setCopied(true),
                () => setCopied(false),
              );
            }}
          >
            {copied ? 'Kopiert ✓' : 'Kopieren'}
          </button>
        </div>
      </div>
      <Results result={result} />
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-ghost" onClick={onBack}>
          Zurück
        </button>
        <button type="button" className="btn-ghost" disabled={pending || !valid} onClick={() => start(async () => setResult(await checkDiscordStep(values)))}>
          {pending ? 'Prüfe …' : 'Redirect prüfen'}
        </button>
        <button type="button" className="btn-primary" disabled={!valid} onClick={onDone}>
          Weiter
        </button>
      </div>
    </div>
  );
}

/**
 * Abschluss vor dem Speichern. Twitch-, YouTube- und KI-Schlüssel fragt der Assistent bewusst NICHT mehr ab –
 * wie bei GalaxyBot muss man so etwas nicht vorab eintragen. YouTube braucht gar keinen Schlüssel (RSS),
 * Twitch und Julia fragen ihn per Assistent, wenn man das jeweilige Modul einschaltet.
 */
function OptionalStep({
  values,
  onBack,
  onDone,
}: {
  values: SetupValues;
  set: (k: keyof SetupValues) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Alles bereit</h2>
        <p className="mt-1 text-fog-300">
          Discord-Bot und Adresse sind geprüft. Mehr braucht es nicht – Module wie Social Media oder Julia fragen später selbst, falls sie noch etwas brauchen.
        </p>
      </div>
      {error && <p className="rounded-lg bg-danger-500/10 px-3 py-2 text-sm">❌ {error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-ghost" onClick={onBack}>
          Zurück
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await finishSetup(values);
              if (r.ok) onDone();
              else setError(r.message);
            })
          }
        >
          {pending ? 'Speichere …' : 'Speichern & Bot starten'}
        </button>
      </div>
    </div>
  );
}

function DoneStep() {
  return (
    <div className="grid gap-5">
      <h2 className="font-display text-2xl font-semibold">Fast geschafft! 🎉</h2>
      <p className="text-fog-300">
        Die Zugangsdaten sind gespeichert und der Bot startet gerade neu. Melde dich jetzt mit Discord an – du wirst dabei automatisch
        <b> Instanz-Admin</b> und kannst danach den Bot auf deinen Server einladen.
      </p>
      <a href="/api/auth/login" className="btn-primary w-fit px-6 py-3 text-base">
        Mit Discord anmelden
      </a>
    </div>
  );
}
