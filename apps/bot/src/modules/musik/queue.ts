import type { LoopMode, TrackKind } from '@moin/shared';

export interface Track {
  title: string;
  url: string;
  kind: TrackKind;
  requestedBy: string;
  /** Links ins eigene Netz erlaubt (Einstellung des Instanz-Admins zum Zeitpunkt des Anstellens) */
  allowPrivate?: boolean;
  durationMs?: number;
  author?: string;
  thumbnail?: string;
  /** Von Autoplay angestellt (nicht von einer Person) */
  auto?: boolean;
}

const HISTORY_MAX = 25;

/** Warteschlange mit Wiederholen (aus / Titel / ganze Schlange) – ohne Discord, gut testbar */
export class MusicQueue {
  current: Track | null = null;
  upcoming: Track[] = [];
  /** Zuletzt gespielte Titel (neueste zuletzt) – für „zurück“ und Autoplay */
  history: Track[] = [];
  loop: LoopMode = 'off';

  /** Hinten anstellen; Ergebnis: Platz (1 = läuft gleich) oder 'full' */
  add(track: Track, max: number): number | 'full' {
    if (this.upcoming.length + (this.current ? 1 : 0) >= max) return 'full';
    this.upcoming.push(track);
    return this.upcoming.length + (this.current ? 1 : 0);
  }

  /** Mehrere Titel (Playlist) – so viele wie passen; Ergebnis: Anzahl angestellt */
  addMany(tracks: Track[], max: number): number {
    let added = 0;
    for (const track of tracks) {
      if (this.add(track, max) === 'full') break;
      added++;
    }
    return added;
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

  /** Zurück zum vorherigen Titel; der aktuelle kommt wieder vorne in die Schlange */
  back(): Track | null {
    const previous = this.history.pop();
    if (!previous) return null;
    if (this.current) this.upcoming.unshift(this.current);
    this.current = previous;
    return previous;
  }

  /** Zu Platz n springen (1 = nächster Titel); die übersprungenen fallen weg */
  jump(position: number): Track | null {
    if (position < 1 || position > this.upcoming.length) return null;
    this.upcoming.splice(0, position - 1);
    return this.advance();
  }

  /** Platz n entfernen (1 = nächster Titel) */
  remove(position: number): Track | null {
    if (position < 1 || position > this.upcoming.length) return null;
    return this.upcoming.splice(position - 1, 1)[0] ?? null;
  }

  shuffle(random: () => number = Math.random): void {
    const list = this.upcoming;
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j]!, list[i]!];
    }
  }

  private advance(): Track | null {
    if (this.current) {
      if (this.loop === 'queue') this.upcoming.push(this.current);
      this.history.push(this.current);
      if (this.history.length > HISTORY_MAX) this.history.shift();
    }
    this.current = this.upcoming.shift() ?? null;
    return this.current;
  }

  clear(): void {
    this.current = null;
    this.upcoming = [];
  }
}
