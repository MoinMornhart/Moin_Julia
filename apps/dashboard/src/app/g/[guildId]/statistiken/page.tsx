import Link from 'next/link';
import { changePercent, fillSeries, lastDays } from '@moin/shared';
import { BarChart, LineChart } from '@/components/Charts';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { fetchGuildChannels, type ChannelOption } from '@/lib/discord';
import { getModuleRow } from '@/lib/modules';
import { statsTabs } from '@/lib/tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Server-Statistiken' };

const RANGES = [7, 30, 90] as const;
const fmt = (n: number) => n.toLocaleString('de-DE');

function Kpi({ label, value, change, hint }: { label: string; value: string; change?: number | null; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-fog-500">{label}</p>
      <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
      {change !== undefined && (
        <p className={`text-xs ${change === null ? 'text-fog-500' : change >= 0 ? 'text-sea-400' : 'text-danger-500'}`}>
          {change === null ? 'kein Vergleich' : `${change >= 0 ? '+' : ''}${change} % zum Zeitraum davor`}
        </p>
      )}
      {hint && <p className="text-xs text-fog-500">{hint}</p>}
    </div>
  );
}

export default async function StatsPage({ params, searchParams }: { params: Promise<{ guildId: string }>; searchParams: Promise<{ tage?: string }> }) {
  const { guildId } = await params;
  const sp = await searchParams;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'statistiken');
  const range = (RANGES as readonly number[]).includes(Number(sp.tage)) ? Number(sp.tage) : 30;
  const all = lastDays(range * 2);
  const days = all.slice(range);
  const from = days[0]!;
  const prevFrom = all[0]!;

  const [guildDays, topMembers, topChannels] = await Promise.all([
    db().guildStatDay.findMany({ where: { guildId, day: { gte: prevFrom } }, orderBy: { day: 'asc' } }),
    db().memberStatDay.groupBy({ by: ['userId'], where: { guildId, day: { gte: from } }, _sum: { messages: true, voiceMinutes: true }, _max: { userTag: true }, orderBy: { _sum: { messages: 'desc' } }, take: 10 }),
    db().channelStatDay.groupBy({ by: ['channelId'], where: { guildId, day: { gte: from } }, _sum: { messages: true }, orderBy: { _sum: { messages: 'desc' } }, take: 8 }),
  ]);
  let channels: ChannelOption[] = [];
  try {
    channels = await fetchGuildChannels(guildId);
  } catch {
    // nur Namen fehlen
  }
  const current = guildDays.filter((d) => d.day >= from);
  const previous = guildDays.filter((d) => d.day < from);
  const sum = (rows: typeof guildDays, key: 'messages' | 'joins' | 'leaves' | 'voiceMinutes') => rows.reduce((s, r) => s + r[key], 0);
  const latestCount = [...current].reverse().find((d) => d.memberCount > 0)?.memberCount ?? 0;
  const firstCount = current.find((d) => d.memberCount > 0)?.memberCount ?? 0;
  const messages = sum(current, 'messages');
  const net = sum(current, 'joins') - sum(current, 'leaves');
  const maxChannel = Math.max(1, ...topChannels.map((c) => c._sum.messages ?? 0));
  const channelName = (id: string) => channels.find((c) => c.id === id)?.name ?? 'gelöschter Kanal';

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <ModuleTabs active="overview" tabs={statsTabs(guildId)} />
      {!row.enabled && <p className="mb-6 rounded-xl border border-sun-400/40 bg-sun-400/10 px-4 py-3 text-sm">Das Modul ist aus – es wird nichts gezählt. Schalte es oben ein.</p>}
      <nav className="mb-5 flex gap-2 text-sm" aria-label="Zeitraum">
        {RANGES.map((r) => (
          <Link key={r} href={`?tage=${r}`} className={`chip ${r === range ? 'bg-coral-500 text-ink-950' : 'bg-ink-800 text-fog-300'}`}>
            {r} Tage
          </Link>
        ))}
      </nav>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Mitglieder" value={latestCount ? fmt(latestCount) : '–'} hint={firstCount && latestCount ? `${latestCount - firstCount >= 0 ? '+' : ''}${fmt(latestCount - firstCount)} im Zeitraum` : undefined} />
        <Kpi label="Beitritte − Austritte" value={`${net >= 0 ? '+' : ''}${fmt(net)}`} hint={`${fmt(sum(current, 'joins'))} rein · ${fmt(sum(current, 'leaves'))} raus`} />
        <Kpi label="Nachrichten" value={fmt(messages)} change={changePercent(messages, sum(previous, 'messages'))} />
        <Kpi label="Stunden im Sprachkanal" value={fmt(Math.round(sum(current, 'voiceMinutes') / 60))} change={changePercent(sum(current, 'voiceMinutes'), sum(previous, 'voiceMinutes'))} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">👥 Mitgliederzahl</h2>
          <LineChart days={days} values={fillSeries(days, current, (r) => r.memberCount)} color="#2fd1b8" label="Mitgliederzahl pro Tag" />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">💬 Nachrichten pro Tag</h2>
          <BarChart days={days} series={[{ name: 'Nachrichten', values: fillSeries(days, current, (r) => r.messages), color: '#ff7a59' }]} label="Nachrichten pro Tag" />
        </section>
        <section className="card p-5">
          <h2 className="mb-1 font-display text-lg font-semibold">🚪 Beitritte & Austritte</h2>
          <p className="mb-2 flex gap-4 text-xs text-fog-500">
            <span>
              <span className="mr-1 inline-block size-2 rounded-full bg-[#2fd1b8]" />
              Beitritte
            </span>
            <span>
              <span className="mr-1 inline-block size-2 rounded-full bg-[#ff5c6c]" />
              Austritte
            </span>
          </p>
          <BarChart
            days={days}
            series={[
              { name: 'Beitritte', values: fillSeries(days, current, (r) => r.joins), color: '#2fd1b8' },
              { name: 'Austritte', values: fillSeries(days, current, (r) => r.leaves), color: '#ff5c6c' },
            ]}
            label="Beitritte und Austritte pro Tag"
          />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">🎙️ Sprachminuten pro Tag</h2>
          <BarChart days={days} series={[{ name: 'Minuten', values: fillSeries(days, current, (r) => r.voiceMinutes), color: '#9b8cff' }]} label="Sprachminuten pro Tag" />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">🏅 Aktivste Mitglieder</h2>
          {topMembers.length === 0 ? (
            <p className="text-sm text-fog-500">Noch keine Daten.</p>
          ) : (
            <ol className="grid gap-2 text-sm" aria-label="Aktivste Mitglieder">
              {topMembers.map((m, i) => (
                <li key={m.userId} className="flex items-center gap-3">
                  <span className="w-6 text-right font-bold text-fog-500 tabular-nums">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{m._max.userTag || m.userId}</span>
                  <span className="text-xs text-fog-500 tabular-nums">
                    💬 {fmt(m._sum.messages ?? 0)} · 🎙️ {fmt(Math.round((m._sum.voiceMinutes ?? 0) / 60))} h
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-display text-lg font-semibold"># Aktivste Kanäle</h2>
          {topChannels.length === 0 ? (
            <p className="text-sm text-fog-500">Noch keine Daten.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {topChannels.map((c) => (
                <li key={c.channelId} className="grid gap-1">
                  <span className="flex justify-between gap-3">
                    <span className="truncate">#{channelName(c.channelId)}</span>
                    <span className="text-fog-500 tabular-nums">{fmt(c._sum.messages ?? 0)}</span>
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-ink-800">
                    <span className="block h-full rounded-full bg-coral-500" style={{ width: `${((c._sum.messages ?? 0) / maxChannel) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
