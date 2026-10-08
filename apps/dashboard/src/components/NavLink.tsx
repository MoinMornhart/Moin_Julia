'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({
  href,
  icon,
  exact = false,
  children,
}: {
  href: string;
  icon: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
        active ? 'bg-coral-500/15 text-coral-400' : 'text-fog-300 hover:bg-ink-850 hover:text-fog-100'
      }`}
    >
      <span aria-hidden>{icon}</span>
      {children}
    </Link>
  );
}
