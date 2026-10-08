'use client';

import { startTransition } from 'react';

/**
 * Formular, das nach dem Speichern NICHT zurückgesetzt wird.
 * React 19 setzt Formulare mit `<form action={…}>` nach dem Absenden automatisch zurück – Auswahlfelder
 * (Kanal, Stil, Rolle …) sprangen dabei auf ihren allerersten Wert zurück, bis man die Seite neu lud.
 * Hier wird die Aktion selbst ausgelöst; was man eingestellt hat, bleibt stehen.
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
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter;
        const data = new FormData(e.currentTarget, submitter instanceof HTMLElement ? submitter : undefined);
        startTransition(() => {
          void action(data);
        });
      }}
    >
      {children}
    </form>
  );
}
