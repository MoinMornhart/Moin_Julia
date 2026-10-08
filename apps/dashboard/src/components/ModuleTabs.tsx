import Link from 'next/link';

/** Reiter unter dem Modul-Kopf, z. B. „Einstellungen | Fälle“. */
export function ModuleTabs({ tabs, active }: { tabs: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <nav className="mb-6 flex gap-1 border-b border-ink-700" aria-label="Bereiche">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? 'page' : undefined}
          className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
            tab.key === active ? 'border-coral-500 text-coral-400' : 'border-transparent text-fog-500 hover:text-fog-100'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
