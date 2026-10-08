'use server';

import type { Prisma } from '@moin/db';
import { UPLOAD_PREFIX, positionSchema, validateAnswers, type FormAnswer } from '@moin/shared';
import { applyGuild, blockerFor } from '@/lib/applications';
import { db } from '@/lib/db';
import { sendModuleAction } from '@/lib/modules';
import { getSession } from '@/lib/session';

/** Bewerbung abschicken (öffentliche Bewerbungsseite) */
export async function submitApplication(guildId: string, positionId: string, raw: Record<string, string>): Promise<{ ok: boolean; message: string }> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'Bitte zuerst mit Discord anmelden.' };
  const target = await applyGuild(guildId);
  if (!target?.enabled) return { ok: false, message: 'Bewerbungen sind auf diesem Server gerade geschlossen.' };
  const row = await db().jobPosition.findFirst({ where: { id: positionId, guildId } });
  const parsed = row ? positionSchema.safeParse(row.data) : null;
  if (!parsed?.success) return { ok: false, message: 'Diese Stelle gibt es nicht (mehr).' };
  const position = parsed.data;
  const blocked = await blockerFor(session, guildId, positionId, position);
  if (blocked) return { ok: false, message: blocked };

  const checked = validateAnswers(position.questions, raw);
  if (!checked.ok) return { ok: false, message: checked.error };
  const answers: FormAnswer[] = [...checked.answers];
  // Datei-Felder: hochgeladene Bilder müssen von dieser Person für diesen Server stammen
  for (const f of position.questions.filter((q) => q.type === 'file')) {
    const ids = (raw[f.id] ?? '')
      .split(',')
      .map((s) => s.trim().replace(UPLOAD_PREFIX, ''))
      .filter((s) => /^[a-z0-9]{20,40}$/.test(s))
      .slice(0, 5);
    if (!ids.length) {
      if (f.required) return { ok: false, message: `„${f.label}“ ist ein Pflichtfeld.` };
      continue;
    }
    const uploads = await db().upload.findMany({ where: { id: { in: ids }, guildId, createdBy: session.userId }, select: { id: true, name: true } });
    if (uploads.length !== ids.length) return { ok: false, message: `Bei „${f.label}“ stimmt etwas mit den Dateien nicht – bitte neu hochladen.` };
    answers.push({ fieldId: f.id, label: f.label, value: `${uploads.length} Datei(en)`, files: uploads.map((u) => ({ name: u.name, url: `/api/uploads/${u.id}` })) });
  }

  const app = await db().application.create({
    data: {
      guildId,
      positionId,
      positionTitle: position.title,
      userId: session.userId,
      userTag: session.username,
      userAvatar: session.avatar,
      answers: answers as unknown as Prisma.InputJsonValue,
    },
  });
  await sendModuleAction(guildId, 'team', `new:${app.id}`, session.userId);
  return { ok: true, message: 'Du bekommst per Discord-DM Bescheid, sobald sie bearbeitet ist.' };
}
