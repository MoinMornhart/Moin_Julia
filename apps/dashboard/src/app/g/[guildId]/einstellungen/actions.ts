'use server';

import { requireGuildAccess } from '@/lib/access';
import { updateGuildBotProfile, validImage } from '@/lib/botProfile';

export interface GuildBotProfileInput {
  nick: string;
  /** undefined = unverändert */
  bio?: string;
  /** undefined = unverändert, null = entfernen, Data-URL = neues Bild */
  avatar?: string | null;
  banner?: string | null;
}

/** Profil des Bots nur auf diesem Server (Spitzname, Bild, Banner, Bio). */
export async function saveGuildBotProfile(guildId: string, input: GuildBotProfileInput): Promise<{ ok: boolean; messages: string[] }> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, messages: ['Nur Owner und Admins.'] };
  const nick = input.nick.trim();
  if (nick.length > 32) return { ok: false, messages: ['Der Spitzname darf höchstens 32 Zeichen haben.'] };
  if (input.bio !== undefined && input.bio.length > 190) return { ok: false, messages: ['Die Bio darf höchstens 190 Zeichen haben.'] };
  if (!validImage(input.avatar) || !validImage(input.banner)) return { ok: false, messages: ['Bilder bitte als PNG, JPG, GIF oder WebP bis 10 MB.'] };
  try {
    return { ok: true, messages: [await updateGuildBotProfile(guildId, { nick, bio: input.bio, avatar: input.avatar, banner: input.banner })] };
  } catch (error) {
    return { ok: false, messages: [error instanceof Error ? error.message : 'Discord nicht erreichbar.'] };
  }
}
