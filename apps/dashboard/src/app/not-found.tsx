import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-lg place-content-center gap-6 px-4 text-center">
      <Logo className="justify-center" />
      <h1 className="font-display text-6xl font-extrabold text-coral-500">404</h1>
      <p className="text-fog-300">
        Hier ist nichts – oder du hast auf diesem Server keine Rechte bzw. der Bot ist dort nicht eingeladen.
      </p>
      <Link href="/servers" className="btn-ghost mx-auto">
        Zur Server-Auswahl
      </Link>
    </main>
  );
}
