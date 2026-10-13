import { userAvatarUrl } from '@/lib/discord';
import type { DashboardSession } from '@/lib/session';

/** Oben rechts: System (nur Instanz-Admin), Profil-Leiste mit Avatar + Name, Abmelden */
export function UserMenu({ session, isAdmin = false }: { session: DashboardSession; isAdmin?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {isAdmin && (
        <a
          href="/system"
          title="System: Updates, Bot-Profil, Wartung und Selbstheilung"
          className="flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-900/70 px-3 py-1.5 text-xs font-semibold text-fog-300 transition hover:border-coral-500 hover:text-fog-100"
        >
          <span aria-hidden>⚙️</span>
          <span className="hidden sm:inline">System</span>
          <span className="sr-only sm:hidden">System</span>
        </a>
      )}
      <div className="flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900/70 py-1 pr-1 pl-1 sm:pr-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={userAvatarUrl(session)} alt="" className="size-7 rounded-full ring-2 ring-coral-500/40" />
        <span className="hidden max-w-36 truncate text-sm font-semibold sm:inline">{session.username}</span>
        <form action="/api/auth/logout" method="post">
          <button
            title="Abmelden"
            aria-label="Abmelden"
            className="grid size-7 place-items-center rounded-full text-fog-500 transition hover:bg-ink-800 hover:text-coral-400"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4" aria-hidden>
              <path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M12 14l4-4-4-4M16 10H8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
