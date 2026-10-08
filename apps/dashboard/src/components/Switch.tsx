/** Schalter als echtes Checkbox-Feld (funktioniert in Formularen ohne JavaScript). */
export function Switch({
  id,
  name,
  defaultChecked,
  label,
}: {
  id: string;
  name: string;
  defaultChecked: boolean;
  label: string;
}) {
  return (
    <span className="relative mt-0.5 inline-flex h-6 w-11 shrink-0">
      <input
        id={id}
        name={name}
        type="checkbox"
        role="switch"
        aria-label={label}
        defaultChecked={defaultChecked}
        className="peer absolute inset-0 z-10 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span className="pointer-events-none absolute inset-0 rounded-full border border-ink-600 bg-ink-800 transition peer-checked:border-sea-400 peer-checked:bg-sea-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-coral-500 peer-disabled:opacity-40" />
      <span className="pointer-events-none absolute top-0.5 left-0.5 size-5 rounded-full bg-fog-500 shadow transition-all peer-checked:left-[calc(100%-1.375rem)] peer-checked:bg-ink-950" />
    </span>
  );
}
