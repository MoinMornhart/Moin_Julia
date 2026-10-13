import { Logo } from './Logo';

/** Was alle außer dem Instanz-Admin während der Wartung sehen */
export function MaintenanceScreen({ message, loggedIn }: { message: string; loggedIn: boolean }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-lg place-content-center gap-6 px-4 text-center">
      <Logo className="justify-center" />
      <p className="text-5xl" aria-hidden>
        🛠️
      </p>
      <h1 className="font-display text-3xl font-bold">Kurz in Wartung</h1>
      <p className="text-fog-300">Moin_Julia wird gerade gewartet und ist gleich wieder für dich da.</p>
      {message && <p className="rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 text-fog-100">{message}</p>}
      {!loggedIn && (
        <a href="/api/auth/login" className="text-xs text-fog-500 underline hover:text-fog-300">
          Instanz-Admin? Hier anmelden
        </a>
      )}
    </main>
  );
}
