import { Switch } from './Switch';

/** Schalter mit Titel und Erklärung */
export function ToggleRow({
  name,
  label,
  description,
  defaultChecked,
  children,
}: {
  name: string;
  label: string;
  description?: React.ReactNode;
  defaultChecked: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch id={name} name={name} defaultChecked={defaultChecked} label={label} />
      <div className="min-w-0 flex-1">
        <label htmlFor={name} className="font-semibold">
          {label}
        </label>
        {description && <p className="text-sm text-fog-500">{description}</p>}
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}

/** Mehrfachauswahl als Chips (z. B. Rollen oder Kanäle) */
export function ChipPicker({
  name,
  options,
  selected,
  empty = 'Nichts gefunden.',
}: {
  name: string;
  options: { id: string; label: string; color?: number }[];
  selected: string[];
  empty?: string;
}) {
  if (!options.length) return <p className="text-sm text-fog-500">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label
          key={o.id}
          className="flex cursor-pointer items-center gap-2 rounded-full border border-ink-600 bg-ink-850 px-3 py-1.5 text-sm has-checked:border-coral-500 has-checked:bg-coral-500/15"
        >
          <input type="checkbox" name={name} value={o.id} defaultChecked={selected.includes(o.id)} className="sr-only" />
          {o.color !== undefined && (
            <span className="size-2.5 rounded-full" style={{ backgroundColor: o.color ? `#${o.color.toString(16).padStart(6, '0')}` : '#8c96ba' }} />
          )}
          {o.label}
        </label>
      ))}
    </div>
  );
}

/** Zahlenfeld mit Beschriftung */
export function NumberField({
  name,
  label,
  defaultValue,
  min,
  max,
  suffix,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue: number | null;
  min: number;
  max: number;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-fog-300">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          name={name}
          defaultValue={defaultValue ?? ''}
          min={min}
          max={max}
          placeholder={placeholder}
          className="input w-28 tabular-nums"
        />
        {suffix && <span className="text-fog-500">{suffix}</span>}
      </span>
    </label>
  );
}

export function SectionCard({ title, description, children }: { title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card grid gap-5 p-6">
      <div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-fog-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}
