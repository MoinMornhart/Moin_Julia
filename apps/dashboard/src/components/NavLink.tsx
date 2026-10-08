'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Eintrag der Seitenleiste. Aktiv: Korallen-Hintergrund + Leiste links (gleitet rein).
 * `state`: Punkt rechts – grün = Modul an, grau = aus. `soon`: noch nicht gebaut (kein Link).
 */
export function NavLink({
  href,
  icon,
  exact = false,
  state,
  soon = false,
  children,
}: {
  href: string;
  icon: string;
  exact?: boolean;
  state?: 'on' | 'off';
  soon?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = !soon && (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  const inner = (
    <>
      <span
        className={`absolute top-1.5 bottom-1.5 left-0 w-1 rounded-full bg-coral-500 transition-all duration-300 ${active ? 'opacity-100' : 'scale-y-0 opacity-0'}`}
        aria-hidden
      />
      <span className={`grid size-7 shrink-0 place-items-center rounded-lg text-base transition ${active ? 'bg-coral-500/20' : 'bg-ink-850 group-hover/nav:bg-ink-800'}`} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {soon && <span className="rounded-md bg-ink-800 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-fog-500 uppercase">bald</span>}
      {state && (
        <span
          className={`size-2 shrink-0 rounded-full transition ${state === 'on' ? 'bg-sea-500 shadow-[0_0_8px] shadow-sea-500/70' : 'bg-ink-600'}`}
          title={state === 'on' ? 'aktiv' : 'aus'}
        />
      )}
    </>
  );
  const cls = `group/nav relative flex items-center gap-2.5 rounded-xl py-1.5 pr-2.5 pl-3 text-sm font-semibold transition`;
  if (soon) {
    return (
      <span className={`${cls} cursor-default text-fog-500/70`} aria-disabled>
        {inner}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`${cls} ${active ? 'bg-coral-500/10 text-coral-400' : 'text-fog-300 hover:translate-x-0.5 hover:bg-ink-850 hover:text-fog-100'}`}
    >
      {inner}
    </Link>
  );
}

/** Überschrift einer Gruppe in der Seitenleiste */
export function NavGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      {title && <p className="mt-4 mb-1 px-3 text-[11px] font-bold tracking-[0.16em] text-fog-500/80 uppercase">{title}</p>}
      {children}
    </div>
  );
}
