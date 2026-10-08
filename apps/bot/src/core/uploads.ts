import { AttachmentBuilder, type APIEmbed } from 'discord.js';
import type { PrismaClient } from '@moin/db';
import { UPLOAD_TYPES, uploadIdOf, type RenderedEmbed, type UploadMime } from '@moin/shared';

/** Hochgeladenes Bild aus der Datenbank (nur vom selben Server). */
export async function loadUpload(prisma: PrismaClient, guildId: string, ref: string | null | undefined): Promise<{ data: Buffer; fileName: string } | null> {
  const id = uploadIdOf(ref);
  if (!id) return null;
  const row = await prisma.upload.findFirst({ where: { id, guildId }, select: { data: true, mime: true } });
  if (!row) return null;
  return { data: Buffer.from(row.data), fileName: `bild-${id}.${UPLOAD_TYPES[row.mime as UploadMime] ?? 'png'}` };
}

/**
 * Ersetzt ein hochgeladenes Embed-Bild („upload:<id>“) durch einen Datei-Anhang.
 * Fehlt das Bild (gelöscht), wird es einfach weggelassen statt die ganze Nachricht scheitern zu lassen.
 */
export async function attachEmbedUpload(
  prisma: PrismaClient,
  guildId: string,
  embed: RenderedEmbed | null,
): Promise<{ embed: APIEmbed | null; files: AttachmentBuilder[] }> {
  if (!embed?.image || !uploadIdOf(embed.image.url)) return { embed: embed as APIEmbed | null, files: [] };
  const upload = await loadUpload(prisma, guildId, embed.image.url);
  if (!upload) {
    const { image: _missing, ...rest } = embed;
    return { embed: rest as APIEmbed, files: [] };
  }
  return {
    embed: { ...(embed as APIEmbed), image: { url: `attachment://${upload.fileName}` } },
    files: [new AttachmentBuilder(upload.data, { name: upload.fileName })],
  };
}
