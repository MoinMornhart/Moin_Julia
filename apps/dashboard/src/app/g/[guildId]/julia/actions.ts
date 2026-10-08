'use server';

import { revalidatePath } from 'next/cache';
import { saveSettings } from '@moin/db';
import { formatUsd, juliaConfigSchema, parseJuliaConfig, usageMonth } from '@moin/shared';
import { requireGuildAccess } from '@/lib/access';
import { appSettings, invalidateSettings } from '@/lib/config';
import { db } from '@/lib/db';
import { checkOllama, testJulia } from '@/lib/julia';
import { formBool, formIds, formString, getModuleRow, saveModuleConfig } from '@/lib/modules';
import { getSession } from '@/lib/session';
import { checkAnthropic } from '@/lib/validate';
import type { ActionResult } from '../actions';

function num(form: FormData, key: string, fallback: number): number {
  const raw = formString(form, key);
  const value = Number(raw?.replace(',', '.'));
  return raw !== null && Number.isFinite(value) ? value : fallback;
}

export async function saveJuliaSettings(guildId: string, form: FormData): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins dürfen Einstellungen ändern.' };
  const current = parseJuliaConfig((await getModuleRow(guildId, 'julia')).config);
  const parsed = juliaConfigSchema.safeParse({
    ...current,
    provider: formString(form, 'provider') ?? current.provider,
    model: formString(form, 'model') ?? current.model,
    chatChannelIds: formIds(form, 'chatChannelIds'),
    respondToMentions: formBool(form, 'respondToMentions'),
    persona: formString(form, 'persona') ?? current.persona,
    contextMessages: Math.round(num(form, 'contextMessages', current.contextMessages)),
    userCooldownSeconds: Math.round(num(form, 'userCooldownSeconds', current.userCooldownSeconds)),
    perUserPerHour: Math.round(num(form, 'perUserPerHour', current.perUserPerHour)),
    monthlyBudgetUsd: Math.round(num(form, 'monthlyBudgetUsd', current.monthlyBudgetUsd) * 100) / 100,
    warnAtPercent: Math.round(num(form, 'warnAtPercent', current.warnAtPercent)),
    logChannelId: formString(form, 'logChannelId') ?? '',
    blockedRoleIds: formIds(form, 'blockedRoleIds'),
    modeRoleIds: formIds(form, 'modeRoleIds'),
    memoryEnabled: formBool(form, 'memoryEnabled'),
    flirty: { enabled: formBool(form, 'flirty.enabled'), adultRoleId: formString(form, 'flirty.adultRoleId') ?? '' },
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: `Ungültige Eingabe bei „${issue?.path.join('.')}“: ${issue?.message}` };
  }
  if (parsed.data.flirty.enabled && !parsed.data.flirty.adultRoleId) return { ok: false, message: 'Für den Flirt-Ton bitte eine 18+-Rolle wählen.' };
  const delivered = await saveModuleConfig(guildId, 'julia', parsed.data, session.userId);
  revalidatePath(`/g/${guildId}/julia`);
  const hint = parsed.data.provider === 'anthropic' && parsed.data.monthlyBudgetUsd === 0 ? ' Hinweis: Budget 0 $ – Julia antwortet mit Claude so nicht.' : '';
  return { ok: true, message: (delivered ? 'Gespeichert – gilt ab sofort.' : 'Gespeichert – der Bot übernimmt es beim nächsten Neustart.') + hint };
}

/** Testfrage aus dem Dashboard – kostet wie eine echte Antwort und wird mitgezählt */
export async function askJuliaTest(guildId: string, question: string): Promise<ActionResult & { answer?: string }> {
  const { session, guild, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  const q = question.trim().slice(0, 1000);
  if (!q) return { ok: false, message: 'Bitte eine Frage eingeben.' };
  const config = parseJuliaConfig((await getModuleRow(guildId, 'julia')).config);
  const month = usageMonth(new Date());
  if (config.provider === 'anthropic') {
    const usage = await db().juliaUsage.findUnique({ where: { guildId_month: { guildId, month } } });
    if ((usage?.costMicroUsd ?? 0) >= config.monthlyBudgetUsd * 1_000_000) return { ok: false, message: 'Das Monatsbudget ist aufgebraucht.' };
  }
  const answer = await testJulia(config, guild.name, q, session.username);
  if (!answer.ok) return { ok: false, message: answer.text };
  if (answer.usage) {
    const u = answer.usage;
    await db().juliaUsage.upsert({
      where: { guildId_month: { guildId, month } },
      create: { guildId, month, requests: 1, inputTokens: u.input, outputTokens: u.output, cacheRead: u.cacheRead, cacheWrite: u.cacheWrite, costMicroUsd: answer.costMicro },
      update: { requests: { increment: 1 }, inputTokens: { increment: u.input }, outputTokens: { increment: u.output }, cacheRead: { increment: u.cacheRead }, cacheWrite: { increment: u.cacheWrite }, costMicroUsd: { increment: answer.costMicro } },
    });
    revalidatePath(`/g/${guildId}/julia`);
  }
  return { ok: true, answer: answer.text, message: answer.costMicro ? `Kosten dieser Antwort: ${formatUsd(answer.costMicro)}` : 'Kostenlos.' };
}

// ── Verbindung (instanzweit, nur Instanz-Admin) ─────────────────────────────

async function instanceAdmin(): Promise<boolean> {
  const session = await getSession();
  const { instanceOwnerId } = await appSettings();
  return !!session && !!instanceOwnerId && session.userId === instanceOwnerId;
}

export async function saveAnthropicKey(guildId: string, form: FormData): Promise<ActionResult> {
  await requireGuildAccess(guildId);
  if (!(await instanceAdmin())) return { ok: false, message: 'Nur der Instanz-Admin (wer Moin_Julia eingerichtet hat) darf Verbindungen ändern.' };
  const key = String(form.get('apiKey') ?? '').trim();
  if (!/^sk-ant-[\w-]{20,}$/.test(key)) return { ok: false, message: 'Das sieht nicht wie ein Anthropic-Schlüssel aus (beginnt mit „sk-ant-“).' };
  const check = await checkAnthropic(key);
  if (!check.ok) return { ok: false, message: check.errors.join(' ') };
  await saveSettings(db(), { anthropicApiKey: key });
  invalidateSettings();
  revalidatePath(`/g/${guildId}/julia/verbindung`);
  return { ok: true, message: check.warnings[0] ?? 'Claude ist verbunden. Unter „Einstellungen“ kannst du Julia jetzt testen.' };
}

export async function saveOllama(guildId: string, form: FormData): Promise<ActionResult> {
  await requireGuildAccess(guildId);
  if (!(await instanceAdmin())) return { ok: false, message: 'Nur der Instanz-Admin darf Verbindungen ändern.' };
  const url = String(form.get('url') ?? '').trim().replace(/\/+$/, '');
  const model = String(form.get('model') ?? '').trim();
  if (!/^https?:\/\/[^\s/]+(:\d+)?$/.test(url)) return { ok: false, message: 'Bitte eine Adresse wie http://192.168.1.20:11434 eingeben.' };
  if (!/^[\w.:/-]{2,80}$/.test(model)) return { ok: false, message: 'Bitte einen Modellnamen wie llama3.2 oder qwen2.5:7b eingeben.' };
  const check = await checkOllama(url, model);
  if (!check.ok) return { ok: false, message: check.message };
  await saveSettings(db(), { ollamaUrl: url, ollamaModel: model });
  invalidateSettings();
  revalidatePath(`/g/${guildId}/julia/verbindung`);
  return { ok: true, message: `${check.message} Stell unter „Einstellungen“ den Anbieter auf Ollama.` };
}

export async function removeConnection(guildId: string, kind: 'anthropic' | 'ollama'): Promise<ActionResult> {
  await requireGuildAccess(guildId);
  if (!(await instanceAdmin())) return { ok: false, message: 'Nur der Instanz-Admin darf Verbindungen ändern.' };
  await saveSettings(db(), kind === 'anthropic' ? { anthropicApiKey: null } : { ollamaUrl: null, ollamaModel: null });
  invalidateSettings();
  revalidatePath(`/g/${guildId}/julia/verbindung`);
  return { ok: true, message: 'Verbindung entfernt.' };
}

// ── Modi (Modul 11) ─────────────────────────────────────────────────────────

/** Alle Modi auf einmal speichern (JSON aus dem Editor); Kanäle mit gelöschtem Modus fallen auf den Standard zurück */
export async function saveJuliaModes(guildId: string, json: string): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, message: 'Die Eingaben konnten nicht gelesen werden.' };
  }
  const current = parseJuliaConfig((await getModuleRow(guildId, 'julia')).config);
  const parsed = juliaConfigSchema.safeParse({ ...current, modes: raw });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path[1] !== undefined ? `Modus ${Number(issue.path[1]) + 1}, ${String(issue.path[2] ?? '')}` : String(issue?.path.join('.'));
    return { ok: false, message: `Ungültige Eingabe (${where}): ${issue?.message}` };
  }
  const names = parsed.data.modes.map((m) => m.name.toLowerCase());
  if (new Set(names).size !== names.length) return { ok: false, message: 'Jeder Modus braucht einen eigenen Namen.' };
  if (names.includes('julia') || names.includes('standard')) return { ok: false, message: '„Julia“ und „Standard“ sind für die Standard-Persona reserviert.' };
  const delivered = await saveModuleConfig(guildId, 'julia', parsed.data, session.userId);
  await db().juliaChannelMode.deleteMany({ where: { guildId, modeId: { notIn: parsed.data.modes.map((m) => m.id) } } });
  revalidatePath(`/g/${guildId}/julia/modi`);
  return { ok: true, message: delivered ? 'Gespeichert – im Chat umschalten mit „modus Name“.' : 'Gespeichert – der Bot übernimmt es beim nächsten Neustart.' };
}

export async function resetChannelMode(guildId: string, channelId: string): Promise<ActionResult> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  await db().juliaChannelMode.deleteMany({ where: { guildId, channelId } });
  revalidatePath(`/g/${guildId}/julia/modi`);
  return { ok: true, message: 'Zurück auf Standard.' };
}

// ── Profile (Modul 11) ──────────────────────────────────────────────────────

export async function deleteProfileFact(guildId: string, profileId: string, index: number): Promise<ActionResult> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  const p = await db().juliaProfile.findFirst({ where: { id: profileId, guildId } });
  if (!p) return { ok: false, message: 'Profil nicht gefunden.' };
  const facts = Array.isArray(p.facts) ? [...(p.facts as unknown[])] : [];
  facts.splice(index, 1);
  await db().juliaProfile.update({ where: { id: p.id }, data: { facts: facts as never } });
  revalidatePath(`/g/${guildId}/julia/profile`);
  return { ok: true, message: 'Gelöscht.' };
}

/** Gedächtnis, Spitzname, Anrede und Flirt-Opt-in löschen – Opt-out und Alters-Sperre bleiben */
export async function clearProfile(guildId: string, profileId: string): Promise<ActionResult> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  await db().juliaProfile.updateMany({ where: { id: profileId, guildId }, data: { facts: [], nickname: null, address: null, flirtyOptIn: false } });
  revalidatePath(`/g/${guildId}/julia/profile`);
  return { ok: true, message: 'Profil geleert.' };
}

/** Alters-Sperre aufheben – nur der Instanz-Admin, nur wenn die Volljährigkeit sicher ist */
export async function liftUnderage(guildId: string, profileId: string): Promise<ActionResult> {
  await requireGuildAccess(guildId);
  if (!(await instanceAdmin())) return { ok: false, message: 'Die Alters-Sperre kann nur der Instanz-Admin aufheben.' };
  await db().juliaProfile.updateMany({ where: { id: profileId, guildId }, data: { underage: false } });
  revalidatePath(`/g/${guildId}/julia/profile`);
  return { ok: true, message: 'Sperre aufgehoben – Flirt-Ton muss die Person selbst wieder einschalten.' };
}
