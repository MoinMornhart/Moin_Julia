'use client';

/**
 * „Vorschläge übernehmen“ für geschützte Kanäle & Rollen: hakt die erkannten Rollen (mit Moderationsrechten)
 * und privaten Kanäle in den Auswahl-Chips an. Gespeichert wird erst mit „Speichern“.
 */
export function ProtectionSuggest({ roles, channels }: { roles: { id: string; name: string }[]; channels: { id: string; name: string }[] }) {
  if (!roles.length && !channels.length) return <p className="text-sm text-fog-500">Keine Vorschläge – es gibt keine weiteren Team-Rollen oder privaten Kanäle.</p>;
  function apply() {
    for (const [name, list] of [
      ['protection.roleIds', roles],
      ['protection.channelIds', channels],
    ] as const) {
      for (const item of list) {
        const box = document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${item.id}"]`);
        if (box && !box.checked) box.click();
      }
    }
  }
  return (
    <div className="grid gap-2 rounded-xl border border-sea-500/40 bg-sea-500/10 px-4 py-3 text-sm" aria-label="Vorschläge zum Schützen">
      <p>
        💡 <b>Vorschläge:</b> {roles.map((r) => `@${r.name}`).join(', ')}
        {roles.length && channels.length ? ' · ' : ''}
        {channels.map((c) => `#${c.name}`).join(', ')}
      </p>
      <p className="text-xs text-fog-500">Rollen mit Moderationsrechten und Kanäle, die @everyone schon jetzt nicht sieht.</p>
      <button type="button" className="btn-ghost w-fit" onClick={apply}>
        Vorschläge übernehmen
      </button>
    </div>
  );
}
