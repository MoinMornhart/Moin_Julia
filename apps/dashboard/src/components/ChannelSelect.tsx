import type { ChannelOption } from '@/lib/discord';

const TYPE_PREFIX: Record<number, string> = { 0: '#', 5: '📢', 2: '🔊', 13: '🎙️', 15: '🗂️' };

/** Kanal-Auswahl, gruppiert nach Discord-Kategorien. */
export function ChannelSelect({
  id,
  name,
  channels,
  defaultValue,
  emptyLabel,
  types = [0, 5],
  className = '',
}: {
  id: string;
  name: string;
  channels: ChannelOption[];
  defaultValue: string | null;
  emptyLabel: string;
  types?: number[];
  className?: string;
}) {
  const visible = channels.filter((c) => types.includes(c.type));
  const groups = new Map<string, ChannelOption[]>();
  for (const channel of visible) {
    const key = channel.group ?? 'Ohne Kategorie';
    groups.set(key, [...(groups.get(key) ?? []), channel]);
  }
  const known = defaultValue === null || visible.some((c) => c.id === defaultValue);

  return (
    <select id={id} name={name} defaultValue={defaultValue ?? ''} className={`input ${className}`}>
      <option value="">{emptyLabel}</option>
      {!known && <option value={defaultValue}>Unbekannter Kanal ({defaultValue})</option>}
      {[...groups].map(([group, list]) => (
        <optgroup key={group} label={group}>
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {TYPE_PREFIX[c.type] ?? '#'} {c.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
