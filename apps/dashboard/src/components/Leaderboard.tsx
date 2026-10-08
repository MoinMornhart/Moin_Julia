import { levelFromXp } from '@moin/shared';
import { userAvatarUrl } from '@/lib/discord';

export interface LeaderboardRow {
  userId: string;
  userTag: string;
  avatar: string | null;
  xp: number;
  messages: number;
  voiceMinutes: number;
}

const MEDALS = ['🥇', '🥈', '🥉'];

/** Bestenliste – im Dashboard (mit Bearbeiten) und auf der öffentlichen Seite */
export function Leaderboard({ rows, startPlace = 1, places, extra }: { rows: LeaderboardRow[]; startPlace?: number; places?: number[]; extra?: (row: LeaderboardRow) => React.ReactNode }) {
  return (
    <ol className="grid gap-2" aria-label="Bestenliste">
      {rows.map((r, i) => {
        const place = places?.[i] ?? startPlace + i;
        const p = levelFromXp(r.xp);
        const pct = p.needed ? Math.round((p.current / p.needed) * 100) : 0;
        return (
          <li key={r.userId} className="card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
            <span className={`w-9 shrink-0 text-center font-display text-lg font-bold tabular-nums ${place <= 3 ? '' : 'text-fog-500'}`}>{MEDALS[place - 1] ?? `#${place}`}</span>
            {/* eslint-disable-next-line @next/next/no-img-element -- Discord-CDN */}
            <img src={userAvatarUrl({ userId: r.userId, avatar: r.avatar }, 64)} alt="" width={40} height={40} className="size-10 shrink-0 rounded-full bg-ink-800" loading="lazy" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{r.userTag || r.userId}</span>
              <span className="mt-1 block h-1.5 max-w-56 overflow-hidden rounded-full bg-ink-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${pct} % bis Level ${p.level + 1}`}>
                <span className="block h-full rounded-full bg-coral-500" style={{ width: `${pct}%` }} />
              </span>
            </span>
            <span className="hidden text-xs text-fog-500 tabular-nums sm:block">
              💬 {r.messages.toLocaleString('de-DE')} · 🎙️ {Math.round(r.voiceMinutes / 60).toLocaleString('de-DE')} h
            </span>
            <span className="text-right tabular-nums">
              <span className="block font-display text-base font-bold text-coral-400">Level {p.level}</span>
              <span className="block text-xs text-fog-500">{r.xp.toLocaleString('de-DE')} XP</span>
            </span>
            {extra?.(r)}
          </li>
        );
      })}
    </ol>
  );
}
