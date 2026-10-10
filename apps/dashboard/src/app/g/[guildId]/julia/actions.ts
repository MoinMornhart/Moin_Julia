'use server';

import { revalidatePath } from 'next/cache';
import { clearSettings, loadGuildSecrets, saveGuildSecret, saveSettings } from '@moin/db';
import { addRuler, COMPAT_PROVIDERS, isCompatProvider, DEFAULT_PERSONA, parseRoyal, removeRuler, juliaRoyalSchema, formatUsd, juliaConfigSchema, ollamaEndpointSchema, parseJuliaConfig, parseOllamaEndpoints, usageMonth, type OllamaEndpoint } from '@moin/shared';
import { requireGuildAccess } from '@/lib/access';
import { appSettings, invalidateSettings } from '@/lib/config';
import { db } from '@/lib/db';
import { checkCompat, checkOllama, testJulia } from '@/lib/julia';
import { formBool, formIds, formString, getModuleRow, saveModuleConfig } from '@/lib/modules';
import { getSession } from '@/lib/session';
import { checkAnthropic } from '@/lib/validate';
import type { ActionResult } from '../actions';

function jsonField(form: FormData, key: string): unknown {
  try {
    return JSON.parse(String(form.get(key) ?? '[]'));
  } catch {
    return 'ungültig';
  }
}

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
    ollamaEndpointId: formString(form, 'ollamaEndpointId') ?? current.ollamaEndpointId,
    chatChannelIds: formIds(form, 'chatChannelIds'),
    respondToMentions: formBool(form, 'respondToMentions'),
    // Feld geleert = zurück zur Standard-Julia (früher blieb dann still die alte Persona stehen)
    persona: form.has('persona') ? (formString(form, 'persona') ?? DEFAULT_PERSONA) : current.persona,
    contextMessages: Math.round(num(form, 'contextMessages', current.contextMessages)),
    userCooldownSeconds: Math.round(num(form, 'userCooldownSeconds', current.userCooldownSeconds)),
    perUserPerHour: Math.round(num(form, 'perUserPerHour', current.perUserPerHour)),
    monthlyBudgetUsd: Math.round(num(form, 'monthlyBudgetUsd', current.monthlyBudgetUsd) * 100) / 100,
    warnAtPercent: Math.round(num(form, 'warnAtPercent', current.warnAtPercent)),
    // Modell für Gemini, OpenAI & Co. (nur sichtbar, wenn so ein Anbieter gewählt ist)
    aiModel: form.has('aiModel') ? (formString(form, 'aiModel') ?? '') : current.aiModel,
    // Nur bei Claude sichtbar – mit Ollama nicht im Formular, dann bleibt der bisherige Wert
    logChannelId: form.has('logChannelId') ? (formString(form, 'logChannelId') ?? '') : current.logChannelId,
    blockedRoleIds: formIds(form, 'blockedRoleIds'),
    unlimitedRoleIds: formIds(form, 'unlimitedRoleIds'),
    limitUnit: formString(form, 'limitUnit') ?? current.limitUnit,
    limitPeriod: formString(form, 'limitPeriod') ?? current.limitPeriod,
    limitOverrides: form.has('limitOverrides') ? jsonField(form, 'limitOverrides') : current.limitOverrides,
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
  const answer = await testJulia(config, guild.name, q, { id: session.userId, name: session.username, guildOwnerId: (guild as { ownerId?: string | null }).ownerId ?? null }, guildId);
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

// ── Eigene Ollama-Endpunkte (instanzweit, nur Instanz-Admin) ───────────────

async function storedEndpoints(): Promise<OllamaEndpoint[]> {
  const s = await appSettings();
  return parseOllamaEndpoints(s.ollamaEndpoints, { url: s.ollamaUrl, model: s.ollamaModel });
}

async function writeEndpoints(guildId: string, list: OllamaEndpoint[]): Promise<void> {
  // Alte Einzel-Einstellung wird durch die Liste ersetzt (sonst tauchte „Standard“ nach dem Löschen wieder auf)
  if (list.length) await saveSettings(db(), { ollamaEndpoints: JSON.stringify(list) });
  await clearSettings(db(), list.length ? ['ollamaUrl', 'ollamaModel'] : ['ollamaEndpoints', 'ollamaUrl', 'ollamaModel']);
  invalidateSettings();
  revalidatePath(`/g/${guildId}/julia/verbindung`);
  revalidatePath(`/g/${guildId}/julia`);
}

/** Eingabe aus dem Formular; `apiKey` leer + `keepKey` = gespeicherten Schlüssel behalten */
export interface OllamaEndpointInput {
  id?: string;
  name: string;
  url: string;
  model: string;
  apiKey: string;
  keepKey: boolean;
  keepAlive: string;
  numCtx: number;
  think: string;
}

/** Modelle eines Endpunkts abrufen (für die Auswahl) – mit eingegebenem oder gespeichertem Schlüssel */
export async function loadOllamaModels(guildId: string, input: { id?: string; url: string; apiKey: string }): Promise<ActionResult & { models?: string[]; version?: string | null }> {
  await requireGuildAccess(guildId);
  if (!(await instanceAdmin())) return { ok: false, message: 'Nur der Instanz-Admin darf Verbindungen ändern.' };
  const url = input.url.trim();
  if (!ollamaEndpointSchema.shape.url.safeParse(url).success) return { ok: false, message: 'Bitte eine Adresse wie http://192.168.1.20:11434 eingeben.' };
  const saved = input.id ? (await storedEndpoints()).find((e) => e.id === input.id) : undefined;
  const result = await checkOllama({ url, apiKey: input.apiKey.trim() || saved?.apiKey || '' });
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, message: result.message, models: result.models, version: result.version };
}

export async function saveOllamaEndpoint(guildId: string, input: OllamaEndpointInput): Promise<ActionResult & { id?: string }> {
  await requireGuildAccess(guildId);
  if (!(await instanceAdmin())) return { ok: false, message: 'Nur der Instanz-Admin darf Verbindungen ändern.' };
  const list = await storedEndpoints();
  const existing = input.id ? list.find((e) => e.id === input.id) : undefined;
  if (input.id && !existing) return { ok: false, message: 'Diesen Endpunkt gibt es nicht mehr – bitte neu laden.' };
  if (!existing && list.length >= 10) return { ok: false, message: 'Höchstens 10 Endpunkte.' };
  const id = existing?.id ?? `o${Date.now().toString(36)}`;
  const apiKey = input.apiKey.trim() || (input.keepKey ? (existing?.apiKey ?? '') : '');
  const parsed = ollamaEndpointSchema.safeParse({ id, name: input.name, url: input.url, model: input.model, apiKey, keepAlive: input.keepAlive || '30m', numCtx: Number.isFinite(input.numCtx) ? Math.round(input.numCtx) : 0, think: input.think });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = { name: 'Name', url: 'Adresse', model: 'Modell', keepAlive: 'Im Speicher halten', numCtx: 'Kontextgröße', think: 'Denk-Modus', apiKey: 'API-Schlüssel' }[String(issue?.path[0])] ?? String(issue?.path[0]);
    return { ok: false, message: `${field}: ${issue?.message}` };
  }
  if (list.some((e) => e.id !== id && e.name.toLowerCase() === parsed.data.name.toLowerCase())) return { ok: false, message: 'Diesen Namen hat schon ein anderer Endpunkt.' };
  const check = await checkOllama(parsed.data, parsed.data.model);
  if (!check.ok) return { ok: false, message: check.message };
  await writeEndpoints(guildId, existing ? list.map((e) => (e.id === id ? parsed.data : e)) : [...list, parsed.data]);
  return { ok: true, id, message: `${check.message} Unter „Einstellungen“ den Anbieter auf Ollama stellen und den Endpunkt wählen.` };
}

export async function deleteOllamaEndpoint(guildId: string, id: string): Promise<ActionResult> {
  await requireGuildAccess(guildId);
  if (!(await instanceAdmin())) return { ok: false, message: 'Nur der Instanz-Admin darf Verbindungen ändern.' };
  const list = await storedEndpoints();
  if (!list.some((e) => e.id === id)) return { ok: false, message: 'Diesen Endpunkt gibt es nicht mehr.' };
  await writeEndpoints(guildId, list.filter((e) => e.id !== id));
  return { ok: true, message: 'Endpunkt entfernt. Server, die ihn nutzten, nehmen jetzt den ersten verbleibenden.' };
}

export async function removeConnection(guildId: string, kind: 'anthropic'): Promise<ActionResult> {
  await requireGuildAccess(guildId);
  if (!(await instanceAdmin())) return { ok: false, message: 'Nur der Instanz-Admin darf Verbindungen ändern.' };
  if (kind !== 'anthropic') return { ok: false, message: 'Unbekannte Verbindung.' };
  await clearSettings(db(), ['anthropicApiKey']);
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
  // Gelöschte Modi → Kanal zurück auf Standard (leere modeId = „Julia“, Umschalt-Zeitpunkt bleibt erhalten)
  await db().juliaChannelMode.updateMany({ where: { guildId, modeId: { notIn: [...parsed.data.modes.map((m) => m.id), ''] } }, data: { modeId: '', setBy: session.userId } });
  revalidatePath(`/g/${guildId}/julia/modi`);
  return { ok: true, message: delivered ? 'Gespeichert – im Chat umschalten mit „modus Name“.' : 'Gespeichert – der Bot übernimmt es beim nächsten Neustart.' };
}

export async function resetChannelMode(guildId: string, channelId: string): Promise<ActionResult> {
  const { canEdit, session } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  // Nicht löschen, sondern auf Standard setzen: so ignoriert Julia ab jetzt ihre Antworten im alten Modus
  await db().juliaChannelMode.updateMany({ where: { guildId, channelId }, data: { modeId: '', setBy: session.userId } });
  revalidatePath(`/g/${guildId}/julia/modi`);
  return { ok: true, message: 'Zurück auf Standard.' };
}

// ── Profile (Modul 11) ──────────────────────────────────────────────────────

/** Fakt über Zeitpunkt + Text erkennen – eine Position könnte sich verschoben haben, wenn Julia inzwischen Neues gemerkt hat */
export async function deleteProfileFact(guildId: string, profileId: string, fact: { at: string; text: string }): Promise<ActionResult> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  const p = await db().juliaProfile.findFirst({ where: { id: profileId, guildId } });
  if (!p) return { ok: false, message: 'Profil nicht gefunden.' };
  const facts = Array.isArray(p.facts) ? [...(p.facts as unknown[])] : [];
  const index = facts.findIndex((f) => {
    const x = f as { at?: unknown; text?: unknown } | null;
    return x?.text === fact.text && String(x?.at ?? '') === fact.at;
  });
  if (index < 0) return { ok: false, message: 'Diesen Eintrag gibt es nicht mehr – bitte Seite neu laden.' };
  facts.splice(index, 1);
  await db().juliaProfile.updateMany({ where: { id: p.id, guildId }, data: { facts: facts as never } });
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

// ── Eigene Schlüssel pro Server (jeder Server-Admin) ───────────────────────

type KeyProvider = 'anthropic' | keyof typeof COMPAT_PROVIDERS;
const isKeyProvider = (p: string): p is KeyProvider => p === 'anthropic' || isCompatProvider(p);

/** Schlüssel prüfen und für diesen Server speichern. „custom“ (eigene Adresse) darf nur der Instanz-Admin. */
export async function saveServerKey(guildId: string, provider: string, form: FormData): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins dürfen Schlüssel eintragen.' };
  if (!isKeyProvider(provider)) return { ok: false, message: 'Unbekannter Anbieter.' };
  const key = String(form.get('apiKey') ?? '').trim();
  if (key.length > 500 || /\s/.test(key)) return { ok: false, message: 'Das sieht nicht wie ein API-Schlüssel aus.' };
  if (provider === 'anthropic') {
    if (!/^sk-ant-[\w-]{20,}$/.test(key)) return { ok: false, message: 'Das sieht nicht wie ein Anthropic-Schlüssel aus (beginnt mit „sk-ant-“).' };
    const check = await checkAnthropic(key);
    if (!check.ok) return { ok: false, message: check.errors.join(' ') };
    await saveGuildSecret(db(), guildId, 'anthropicApiKey', key, session.userId);
    revalidatePath(`/g/${guildId}/julia`, 'layout');
    return { ok: true, message: 'Eigener Claude-Schlüssel gespeichert – dieser Server nutzt ab jetzt ihn (und zahlt selbst).' };
  }
  let customUrl = '';
  if (provider === 'custom') {
    // Sonst könnte ein fremder Server-Admin den Bot Adressen im Heimnetz der Instanz abrufen lassen
    if (!(await instanceAdmin())) return { ok: false, message: 'Eine eigene Adresse darf nur der Instanz-Admin eintragen.' };
    customUrl = String(form.get('baseUrl') ?? '').trim();
    if (!/^https?:\/\/[^\s]{3,290}$/.test(customUrl)) return { ok: false, message: 'Bitte eine Adresse wie https://mein-server.de/v1 eintragen.' };
  } else if (!key) return { ok: false, message: 'Bitte den API-Schlüssel einfügen.' };
  const check = await checkCompat(provider, key, customUrl);
  if (!check.ok) return { ok: false, message: check.message };
  await saveGuildSecret(db(), guildId, `${provider}ApiKey`, key || null, session.userId);
  if (provider === 'custom') {
    const config = parseJuliaConfig((await getModuleRow(guildId, 'julia')).config);
    await saveModuleConfig(guildId, 'julia', { ...config, customBaseUrl: customUrl.replace(/\/+$/, '') }, session.userId);
  }
  revalidatePath(`/g/${guildId}/julia`, 'layout');
  return { ok: true, message: `${check.message} Unter „Einstellungen“ den Anbieter auswählen.` };
}

export async function removeServerKey(guildId: string, provider: string): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  if (!isKeyProvider(provider)) return { ok: false, message: 'Unbekannter Anbieter.' };
  await saveGuildSecret(db(), guildId, `${provider}ApiKey`, null, session.userId);
  if (provider === 'custom') {
    const config = parseJuliaConfig((await getModuleRow(guildId, 'julia')).config);
    await saveModuleConfig(guildId, 'julia', { ...config, customBaseUrl: '' }, session.userId);
  }
  revalidatePath(`/g/${guildId}/julia`, 'layout');
  return { ok: true, message: provider === 'anthropic' ? 'Eigener Claude-Schlüssel entfernt – es gilt wieder der der Instanz (falls vorhanden).' : `${COMPAT_PROVIDERS[provider].label}-Schlüssel entfernt.` };
}

/** Modelle des gewählten Anbieters mit dem gespeicherten Server-Schlüssel laden */
export async function loadProviderModels(guildId: string, provider: string): Promise<{ ok: boolean; message: string; models: string[] }> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.', models: [] };
  if (!isCompatProvider(provider)) return { ok: false, message: 'Unbekannter Anbieter.', models: [] };
  const own = await loadGuildSecrets(db(), guildId);
  const key = own[`${provider}ApiKey`] ?? '';
  if (!key && provider !== 'custom') return { ok: false, message: 'Erst unter „Verbindung“ den Schlüssel eintragen.', models: [] };
  const config = parseJuliaConfig((await getModuleRow(guildId, 'julia')).config);
  return checkCompat(provider, key, config.customBaseUrl);
}

// ── Herrscher (instanzweit – NUR der Instanz-Admin) ─────────────────────────

/** Titel, „nur Herrschern dienen“, weitere Herrscher an/aus */
export async function saveRoyalSettings(guildId: string, form: FormData): Promise<ActionResult> {
  await requireGuildAccess(guildId);
  if (!(await instanceAdmin())) return { ok: false, message: 'Herrscher bestimmt nur der Instanz-Admin.' };
  const royal = parseRoyal((await appSettings()).juliaRoyal);
  const parsed = juliaRoyalSchema.safeParse({
    ...royal,
    ownerTitle: formString(form, 'ownerTitle') ?? royal.ownerTitle,
    onlyRulers: formBool(form, 'onlyRulers'),
    enabled: formBool(form, 'enabled'),
  });
  if (!parsed.success) return { ok: false, message: 'Der Titel braucht 2 bis 40 Zeichen.' };
  await saveSettings(db(), { juliaRoyal: JSON.stringify(parsed.data) });
  invalidateSettings();
  revalidatePath(`/g/${guildId}/julia`);
  return { ok: true, message: 'Gespeichert – gilt sofort auf allen Servern.' };
}

/** Herrscher per Discord-ID ernennen (bequemer: in Discord „/julia herrscher“ oder „@Julia ernenne @Max zum König“) */
export async function addRoyalRuler(guildId: string, form: FormData): Promise<ActionResult> {
  await requireGuildAccess(guildId);
  if (!(await instanceAdmin())) return { ok: false, message: 'Herrscher bestimmt nur der Instanz-Admin.' };
  const id = formString(form, 'rulerId') ?? '';
  if (!/^\d{15,22}$/.test(id)) return { ok: false, message: 'Bitte eine Discord-ID eintragen (Rechtsklick auf die Person → „ID kopieren“).' };
  const royal = parseRoyal((await appSettings()).juliaRoyal);
  if (royal.rulers.length >= 20 && !royal.rulers.some((r) => r.id === id)) return { ok: false, message: 'Höchstens 20 Herrscher.' };
  const next = addRuler(royal, { id, name: (formString(form, 'rulerName') ?? '').slice(0, 40), title: formString(form, 'rulerTitle') ?? 'König' });
  await saveSettings(db(), { juliaRoyal: JSON.stringify(next) });
  invalidateSettings();
  revalidatePath(`/g/${guildId}/julia`);
  return { ok: true, message: 'Ernannt – Julia verehrt die Person ab sofort.' };
}

export async function removeRoyalRuler(guildId: string, id: string): Promise<ActionResult> {
  await requireGuildAccess(guildId);
  if (!(await instanceAdmin())) return { ok: false, message: 'Herrscher bestimmt nur der Instanz-Admin.' };
  const royal = parseRoyal((await appSettings()).juliaRoyal);
  await saveSettings(db(), { juliaRoyal: JSON.stringify(removeRuler(royal, id)) });
  invalidateSettings();
  revalidatePath(`/g/${guildId}/julia`);
  return { ok: true, message: 'Abgesetzt.' };
}
