import { appSettings } from '@/lib/config';
import { getBotHeartbeat } from '@/lib/redis';

const STATES = {
  online: { label: 'Bot online', dot: 'bg-sea-500', ping: true },
  connecting: { label: 'Bot verbindet sich mit Discord …', dot: 'bg-sun-400', ping: false },
  setup: { label: 'Bot wartet auf Einrichtung', dot: 'bg-sun-400', ping: false },
  'token-invalid': { label: 'Bot-Token ungültig – unter „System“ ändern', dot: 'bg-danger-500', ping: false },
  'intents-missing': { label: 'Intents fehlen – Developer Portal → Bot', dot: 'bg-danger-500', ping: false },
  error: { label: 'Bot-Fehler', dot: 'bg-danger-500', ping: false },
} as const;

/** Zeigt, ob der Bot gerade online ist bzw. was fehlt (Heartbeat aus Redis, max. 60 s alt). */
export async function BotStatus({ compact = false }: { compact?: boolean }) {
  const heartbeat = await getBotHeartbeat();
  const info = heartbeat ? (STATES[heartbeat.state ?? 'online'] ?? STATES.error) : { label: 'Bot offline', dot: 'bg-danger-500', ping: false };
  const online = heartbeat?.state === 'online' || (heartbeat !== null && heartbeat.state === undefined);
  return (
    <div className="flex items-center gap-2 text-xs text-fog-500" title={heartbeat?.user ? `Bot ${heartbeat.user}` : heartbeat?.error}>
      <span className="relative flex size-2.5 shrink-0">
        {info.ping && <span className="absolute inline-flex size-full animate-ping rounded-full bg-sea-400 opacity-60" />}
        <span className={`relative inline-flex size-2.5 rounded-full ${info.dot}`} />
      </span>
      <span className="font-semibold text-fog-300">{info.label}</span>
      {online && !compact && heartbeat && (
        <span>
          · {heartbeat.pingMs} ms · v{heartbeat.version}
        </span>
      )}
    </div>
  );
}

/** Erklärt, was zu tun ist, wenn der Bot nicht online ist (nichts, solange alles läuft). */
export async function BotHint() {
  const heartbeat = await getBotHeartbeat();
  if (heartbeat?.state === 'online' || heartbeat?.state === 'setup' || heartbeat?.state === 'connecting') return null;

  let title: string;
  let body: React.ReactNode;
  if (!heartbeat) {
    title = 'Der Bot meldet sich nicht';
    body = (
      <>
        Das Dashboard läuft, aber der Bot-Prozess sendet kein Lebenszeichen. Server, auf die du ihn eingeladen hast, werden trotzdem erkannt – nur
        reagiert er in Discord gerade nicht. Auf dem Proxmox-Container:
        <code className="mt-2 block rounded-lg bg-ink-900 p-2 text-xs">moin-julia logs bot</code>
        zeigt den Grund, <code>moin-julia restart</code> startet neu. Schick mir gern die letzten Zeilen der Logs.
      </>
    );
  } else if (heartbeat.state === 'token-invalid') {
    title = 'Bot-Token ungültig';
    body = (
      <>
        Discord lehnt den Token ab. Unter <a href="/system" className="text-coral-400 underline">System</a> einen neuen eintragen (Developer Portal → Bot →
        „Reset Token“).
      </>
    );
  } else if (heartbeat.state === 'intents-missing') {
    const clientId = (await appSettings()).discordClientId;
    const portal = clientId ? `https://discord.com/developers/applications/${clientId}/bot` : 'https://discord.com/developers/applications';
    title = 'Discord verweigert die Anmeldung: Intents fehlen';
    body = (
      <>
        Im{' '}
        <a href={portal} target="_blank" rel="noopener noreferrer" className="text-coral-400 underline">
          Developer Portal → Bot
        </a>{' '}
        unter „Privileged Gateway Intents“ <b>Server Members Intent</b> und <b>Message Content Intent</b> einschalten und „Save Changes“ klicken. Der Bot
        versucht es jede Minute automatisch erneut – ein Neustart ist nicht nötig.
      </>
    );
  } else {
    title = 'Der Bot konnte sich nicht verbinden';
    body = (
      <>
        Fehler: <code>{heartbeat.error ?? 'unbekannt'}</code>. Der Bot versucht es in einer Minute automatisch erneut. Hält das an: <code>moin-julia logs bot</code>.
      </>
    );
  }
  return (
    <div className="card mb-8 border-danger-500/50 p-5">
      <p className="font-display text-lg font-semibold">{title}</p>
      <div className="mt-1 text-sm text-fog-300">{body}</div>
    </div>
  );
}
