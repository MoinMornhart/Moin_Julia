import type { LoopMode } from '@moin/shared';

export interface Track {
  title: string;
  url: string;
  kind: 'radio' | 'file';
  requestedBy: string;
  /** Links ins eigene Netz erlaubt (Einstellung des Instanz-Admins zum Zeitpunkt des Anstellens) */
  allowPrivate?: boolean;
}

/** Warteschlange mit Wiederholen (aus / Titel / ganze Schlange) – ohne Discord, gut testbar */
export class MusicQueue {
  current: Track | null = null;
  upcoming: Track[] = [];
  loop: LoopMode = 'off';

  /** Hinten anstellen; Ergebnis: Platz (1 = läuft gleich) oder 'full' */
  add(track: Track, max: number): number | 'full' {
    if (this.upcoming.length + (this.current ? 1 : 0) >= max) return 'full';
    this.upcoming.push(track);
    return this.upcoming.length + (this.current ? 1 : 0);
  }

  /** Nächster Titel nach dem Ende des aktuellen (beachtet „Titel wiederholen“) */
  next(): Track | null {
    if (this.current && this.loop === 'track') return this.current;
    return this.advance();
  }

  /** Überspringen: geht immer weiter, auch bei „Titel wiederholen“ */
  skip(): Track | null {
    return this.advance();
  }

  private advance(): Track | null {
    if (this.current && this.loop === 'queue') this.upcoming.push(this.current);
    this.current = this.upcoming.shift() ?? null;
    return this.current;
  }

  clear(): void {
    this.current = null;
    this.upcoming = [];
  }
}
