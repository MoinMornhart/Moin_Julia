'use client';

import { useEffect, useState } from 'react';

const KEY = 'moin:expert';

/**
 * Einfach/Erweitert (Issue #5): Selten gebrauchte Bereiche (SectionCard mit `advanced`) sind im einfachen
 * Modus ausgeblendet. Der Knopf blendet sie ein; die Wahl merkt sich der Browser.
 * Erscheint nur, wenn die Seite erweiterte Bereiche hat.
 */
export function ExpertToggle() {
  const [expert, setExpert] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    setExpert(document.documentElement.classList.contains('expert'));
    const update = () => setCount(document.querySelectorAll('[data-advanced]').length);
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!count) return null;

  function toggle() {
    const next = !expert;
    setExpert(next);
    document.documentElement.classList.toggle('expert', next);
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      // privates Fenster: gilt dann nur bis zum Neuladen
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={expert}
      title={expert ? 'Selten gebrauchte Einstellungen wieder ausblenden – die Seite wird übersichtlicher' : `${count} Bereich(e) mit selten gebrauchten Einstellungen einblenden`}
      className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${expert ? 'border-coral-500 bg-coral-500/10 text-fog-100' : 'border-ink-700 bg-ink-900 text-fog-300 hover:border-coral-500'}`}
    >
      🧰 {expert ? 'Erweitert: an' : `Erweitert anzeigen (${count})`}
    </button>
  );
}
