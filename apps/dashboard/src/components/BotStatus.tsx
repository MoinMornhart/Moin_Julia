import { getBotHeartbeat } from '@/lib/redis';

const STATES = {
  online: { label: 'Bot online', dot: 'bg-sea-500', ping: true },
  setup: { label: 'Bot wartet auf Einrichtung', dot: 'bg-sun-400', ping: false },
  'token-invalid': { label: 'Bot-Token ungültig – unter „System“ ändern', dot: 'bg-danger-500', ping: false },
  'intents-missing': { label: 'Intents fehlen – Developer Portal → Bot', dot: 'bg-danger-500', ping: false },
} as const;

/** Zeigt, ob der Bot gerade online ist bzw. was fehlt (Heartbeat aus Redis, max. 60 s alt). */
export async function BotStatus({ compact = false }: { compact?: boolean }) {
  const heartbeat = await getBotHeartbeat();
  const info = heartbeat ? STATES[heartbeat.state ?? 'online'] : { label: 'Bot offline', dot: 'bg-danger-500', ping: false };
  const online = heartbeat?.state === 'online' || (heartbeat !== null && heartbeat.state === undefined);
  return (
    <div className="flex items-center gap-2 text-xs text-fog-500" title={heartbeat?.user ? `Bot ${heartbeat.user}` : undefined}>
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
