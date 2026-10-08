import { userAvatarUrl } from '@/lib/discord';
import type { DashboardSession } from '@/lib/session';

export function UserMenu({ session, isAdmin = false }: { session: DashboardSession; isAdmin?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {isAdmin && (
        <a href="/system" className="text-xs font-semibold text-fog-500 transition hover:text-coral-400">
          System
        </a>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={userAvatarUrl(session)} alt="" className="size-8 rounded-full border border-ink-600" />
      <span className="hidden text-sm font-semibold sm:inline">{session.username}</span>
      <form action="/api/auth/logout" method="post">
        <button className="text-xs font-semibold text-fog-500 transition hover:text-coral-400">Abmelden</button>
      </form>
    </div>
  );
}
