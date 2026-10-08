import Link from 'next/link';
import { notFound } from 'next/navigation';
import { APPLICATION_STATUS_LABELS, positionSchema, type ApplicationStatus, type FormAnswer } from '@moin/shared';
import { ApplicationActions } from '@/components/ApplicationActions';
import { canReviewApplications, requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { fetchGuildChannels, type ChannelOption } from '@/lib/discord';
import { teamMembers } from '@/lib/teamMembers';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bewerbung' };

export default async function ApplicationPage({ params }: { params: Promise<{ guildId: string; appId: string }> }) {
  const { guildId, appId } = await params;
  const access = await requireGuildAccess(guildId);
  const app = await db().application.findFirst({ where: { id: appId, guildId } });
  if (!app) notFound();
  const canReview = await canReviewApplications(access);
  const position = await db().jobPosition.findUnique({ where: { id: app.positionId } });
  const parsed = position ? positionSchema.safeParse(position.data) : null;
  const probationDays = parsed?.success ? parsed.data.probationDays : 0;
  let channels: ChannelOption[] = [];
  try {
    channels = await fetchGuildChannels(guildId);
  } catch {
    // leer
  }
  const answers = (Array.isArray(app.answers) ? app.answers : []) as FormAnswer[];
  const notes = (Array.isArray(app.notes) ? app.notes : []) as { byTag: string; text: string; at: string }[];

  return (
    <>
      <Link href={`/g/${guildId}/team?status=${app.status}`} className="text-sm text-coral-400 hover:text-coral-500">
        ← Posteingang
      </Link>
      <div className="mt-3 mb-6 flex flex-wrap items-center gap-4">
        {app.userAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`https://cdn.discordapp.com/avatars/${app.userId}/${app.userAvatar}.png?size=128`} alt="" className="size-14 rounded-2xl" />
        ) : (
          <span className="grid size-14 place-items-center rounded-2xl bg-ink-700 font-bold">{app.userTag.slice(0, 2).toUpperCase()}</span>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold tracking-tight">{app.userTag}</h1>
          <p className="text-sm text-fog-500">
            {app.positionTitle} · eingegangen {app.createdAt.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' })} ·{' '}
            <b className="text-fog-300">{APPLICATION_STATUS_LABELS[app.status as ApplicationStatus] ?? app.status}</b>
          </p>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="card grid gap-5 p-6">
          <h2 className="font-display text-xl font-semibold">Antworten</h2>
          {answers.length === 0 && <p className="text-sm text-fog-500">Keine Antworten (die Stelle hatte keine Fragen).</p>}
          {answers.map((a) => (
            <div key={a.fieldId} className="grid gap-1">
              <p className="text-xs font-bold tracking-wider text-fog-500 uppercase">{a.label}</p>
              {a.files?.length ? (
                <div className="flex flex-wrap gap-2">
                  {a.files.map((f) => (
                    <a key={f.url} href={f.url} target="_blank" rel="noopener">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.url} alt={f.name} className="max-h-48 rounded-lg border border-ink-700" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{a.value}</p>
              )}
            </div>
          ))}
          {app.decisionReason && (
            <div className="rounded-xl border border-danger-500/40 bg-danger-500/5 p-4 text-sm">
              <p className="font-semibold">Begründung der Absage</p>
              <p className="mt-1 whitespace-pre-wrap text-fog-300">{app.decisionReason}</p>
            </div>
          )}
          <div className="grid gap-2 border-t border-ink-700 pt-4">
            <h3 className="font-display text-lg font-semibold">Interne Notizen</h3>
            {notes.length === 0 && <p className="text-sm text-fog-500">Noch keine Notizen – nur das Team sieht sie.</p>}
            {notes.map((n, i) => (
              <div key={i} className="rounded-xl bg-ink-850 p-3 text-sm">
                <p className="text-xs text-fog-500">
                  {n.byTag} · {new Date(n.at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' })}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{n.text}</p>
              </div>
            ))}
          </div>
        </section>

        <ApplicationActions
          guildId={guildId}
          appId={app.id}
          status={app.status as ApplicationStatus}
          canReview={canReview}
          canDelete={access.canEdit}
          isMine={app.handlerId === access.session.userId}
          handlerTag={app.handlerTag}
          tag={app.tag}
          interview={app.interview as { at?: string; place?: string; status?: string } | null}
          probationDays={probationDays}
          members={canReview ? await teamMembers(guildId) : []}
          voiceChannels={channels.filter((c) => c.type === 2).map((c) => c.name)}
        />
      </div>
    </>
  );
}
