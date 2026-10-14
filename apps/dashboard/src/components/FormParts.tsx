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
    <div className="flex items-start gap-3" data-help-scope>
      <Switch id={name} name={name} defaultChecked={defaultChecked} label={label} />
      <div className="min-w-0 flex-1">
        <label htmlFor={name} className="font-semibold">
          {label}
        </label>
        {description && (
          <p className="text-sm text-fog-500" data-help>
            {description}
          </p>
        )}
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
  // Gespeicherte IDs, die Discord gerade nicht (mehr) liefert, nicht still verwerfen – sonst gehen sie beim Speichern verloren
  const unknown = selected.filter((id) => !options.some((o) => o.id === id)).map((id) => ({ id, label: `unbekannt (${id})` }));
  const all: { id: string; label: string; color?: number }[] = [...options, ...unknown];
  if (!all.length) return <p className="text-sm text-fog-500">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {all.map((o) => (
        <label
          key={o.id}
          className="flex cursor-pointer items-center gap-2 rounded-full border border-ink-600 bg-ink-850 px-3 py-1.5 text-sm has-checked:border-coral-500 has-checked:bg-coral-500/15 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-coral-500"
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

/**
 * Karte mit Titel und Erklärung. `advanced`: selten gebraucht – im einfachen Modus ausgeblendet,
 * „🧰 Erweitert anzeigen“ im Modul-Kopf blendet sie ein (siehe ExpertToggle).
 */
export function SectionCard({ title, description, children, advanced = false }: { title: string; description?: React.ReactNode; children: React.ReactNode; advanced?: boolean }) {
  return (
    <section className="card grid gap-5 p-6" {...(advanced ? { 'data-advanced': '' } : {})}>
      <div>
        <h2 className="font-display text-lg font-semibold">
          {title}
          {advanced && <span className="ml-2 align-middle text-xs font-normal text-fog-500">🧰 Erweitert</span>}
        </h2>
        {description && <p className="mt-1 text-sm text-fog-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** Einzelne Rolle wählen */
export function RoleSelect({
  id,
  name,
  roles,
  defaultValue,
  emptyLabel,
  className = '',
}: {
  id: string;
  name: string;
  roles: { id: string; name: string }[];
  defaultValue: string | null;
  emptyLabel: string;
  className?: string;
}) {
  return (
    <select id={id} name={name} defaultValue={defaultValue ?? ''} className={`input ${className}`}>
      <option value="">{emptyLabel}</option>
      {defaultValue && !roles.some((r) => r.id === defaultValue) && <option value={defaultValue}>Unbekannte Rolle ({defaultValue})</option>}
      {roles.map((r) => (
        <option key={r.id} value={r.id}>
          @ {r.name}
        </option>
      ))}
    </select>
  );
}
