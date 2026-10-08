import { getBotHeartbeat } from '@/lib/redis';

/** Zeigt, ob der Bot gerade online ist (Heartbeat aus Redis, max. 60 s alt). */
export async function BotStatus({ compact = false }: { compact?: boolean }) {
  const heartbeat = await getBotHeartbeat();
  const online = heartbeat !== null;
  return (
    <div className="flex items-center gap-2 text-xs text-fog-500" title={heartbeat ? `Bot ${heartbeat.user}` : undefined}>
      <span className="relative flex size-2.5">
        {online && <span className="absolute inline-flex size-full animate-ping rounded-full bg-sea-400 opacity-60" />}
        <span className={`relative inline-flex size-2.5 rounded-full ${online ? 'bg-sea-500' : 'bg-danger-500'}`} />
      </span>
      <span className="font-semibold text-fog-300">{online ? 'Bot online' : 'Bot offline'}</span>
      {online && !compact && (
        <span>
          · {heartbeat.pingMs} ms · v{heartbeat.version}
        </span>
      )}
    </div>
  );
}
