'use client';

import { startTransition, useEffect, useState } from 'react';

/**
 * Formular, das nach dem Speichern NICHT zurückgesetzt wird.
 * React 19 setzt Formulare mit `<form action={…}>` nach dem Absenden automatisch zurück – Auswahlfelder
 * (Kanal, Stil, Rolle …) sprangen dabei auf ihren allerersten Wert zurück, bis man die Seite neu lud.
 * Hier wird die Aktion selbst ausgelöst; was man eingestellt hat, bleibt stehen.
 *
 * Bis die Seite fertig geladen ist (Hydration), sind die Felder gesperrt – sonst würde der Browser das
 * Formular auf die alte Art abschicken. `method="post"`, damit Einstellungen nie in der Adresszeile landen.
 */
export function KeepForm({
  action,
  className,
  children,
}: {
  action: (form: FormData) => void | Promise<void>;
  className?: string;
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <form
      method="post"
      className={className}
      aria-busy={!ready}
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter;
        const data = new FormData(e.currentTarget, submitter instanceof HTMLElement ? submitter : undefined);
        startTransition(() => {
          void action(data);
        });
      }}
    >
      <fieldset disabled={!ready} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
