'use client';

import { useActionState } from 'react';
import { saveGuildSettings, type ActionResult } from '@/app/g/[guildId]/actions';

interface RoleOption {
  id: string;
  name: string;
  color: number;
}

export function SettingsForm({
  guildId,
  canEdit,
  locale,
  modRoleIds,
  roles,
  rolesError,
}: {
  guildId: string;
  canEdit: boolean;
  locale: string;
  modRoleIds: string[];
  roles: RoleOption[];
  rolesError: boolean;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    (_prev, formData) => saveGuildSettings(guildId, formData),
    null,
  );

  return (
    <form action={action} className="grid max-w-3xl gap-6">
      <fieldset disabled={!canEdit || pending} className="card grid gap-6 p-6">
        <div>
          <label htmlFor="locale" className="font-display text-lg font-semibold">
            Sprache der Bot-Texte
          </label>
          <p className="mt-1 mb-3 text-sm text-fog-500">Gilt für Antworten, Embeds und Meldungen des Bots auf diesem Server.</p>
          <select id="locale" name="locale" defaultValue={locale} className="input max-w-xs">
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </div>

        <div>
          <p className="font-display text-lg font-semibold">Mod-Rollen fürs Dashboard</p>
          <p className="mt-1 mb-3 text-sm text-fog-500">
            Mitglieder mit diesen Rollen dürfen das Dashboard ansehen, aber nichts ändern. Owner und Admins (Recht „Server
            verwalten“) haben immer vollen Zugriff.
          </p>
          {rolesError ? (
            <p className="text-sm text-danger-500">Rollen konnten nicht geladen werden – ist der Bot-Token korrekt?</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <label
                  key={role.id}
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-ink-600 bg-ink-850 px-3 py-1.5 text-sm has-checked:border-coral-500 has-checked:bg-coral-500/15"
                >
                  <input type="checkbox" name="modRoleIds" value={role.id} defaultChecked={modRoleIds.includes(role.id)} className="sr-only" />
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#8c96ba' }}
                  />
                  {role.name}
                </label>
              ))}
            </div>
          )}
        </div>
      </fieldset>

      <div className="flex items-center gap-4">
        <button type="submit" className="btn-primary" disabled={!canEdit || pending}>
          {pending ? 'Speichere …' : 'Speichern'}
        </button>
        {state?.message && <p className={`text-sm ${state.ok ? 'text-sea-400' : 'text-danger-500'}`}>{state.message}</p>}
      </div>
    </form>
  );
}
