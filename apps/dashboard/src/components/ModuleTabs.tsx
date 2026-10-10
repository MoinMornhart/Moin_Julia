import Link from 'next/link';

/** Reiter unter dem Modul-Kopf, z. B. „Einstellungen | Fälle“. */
export function ModuleTabs({ tabs, active }: { tabs: { href: string; label: string; key: string }[]; active: string }) {
  // overflow-y-hidden: die aktive Linie ragt 1 px nach unten – sonst zeigt Windows eine Mini-Scrollleiste (▲ ▼)
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-ink-700 [scrollbar-width:none]" aria-label="Bereiche">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? 'page' : undefined}
          className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition sm:px-4 ${
            tab.key === active ? 'border-coral-500 text-coral-400' : 'border-transparent text-fog-500 hover:text-fog-100'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
